using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Reflection;
using System.Text;
using ImpactTheory.Core.Math;

namespace ImpactTheory.CoreTests
{
    /// <summary>Marks a method as a test case. Discovered by reflection.</summary>
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class TestAttribute : Attribute
    {
        public TestAttribute(string name)
        {
            Name = name;
        }

        /// <summary>
        /// A sentence describing the behaviour under test, not a method name.
        /// </summary>
        /// <remarks>
        /// These strings are the readable output of a validation run, and validation output gets
        /// pasted into <c>Operations/VALIDATION_MATRIX.md</c>. "a 90% overhang is not removed" is
        /// evidence; "TestOverhang3" is not.
        /// </remarks>
        public string Name { get; }

        /// <summary>Optional link to the requirement this proves, e.g. <c>VAL-015</c>.</summary>
        public string Requirement { get; set; }
    }

    /// <summary>Raised when an assertion fails. Distinguished from a crash, which is a different kind of bug.</summary>
    public sealed class TestFailure : Exception
    {
        public TestFailure(string message)
            : base(message)
        {
        }
    }

    /// <summary>Assertions.</summary>
    public static class Check
    {
        public static void True(bool condition, string what)
        {
            if (!condition)
            {
                throw new TestFailure($"expected true: {what}");
            }
        }

        public static void False(bool condition, string what)
        {
            if (condition)
            {
                throw new TestFailure($"expected false: {what}");
            }
        }

        public static void Equal(int expected, int actual, string what)
        {
            if (expected != actual)
            {
                throw new TestFailure($"{what}: expected {expected}, got {actual}");
            }
        }

        public static void Equal(string expected, string actual, string what)
        {
            if (!string.Equals(expected, actual, StringComparison.Ordinal))
            {
                throw new TestFailure($"{what}: expected \"{expected}\", got \"{actual}\"");
            }
        }

        public static void Equal<TEnum>(TEnum expected, TEnum actual, string what)
            where TEnum : struct, Enum
        {
            if (!expected.Equals(actual))
            {
                throw new TestFailure($"{what}: expected {expected}, got {actual}");
            }
        }

        public static void Near(float expected, float actual, float tolerance, string what)
        {
            if (MathUtil.Abs(expected - actual) > tolerance)
            {
                throw new TestFailure(string.Format(
                    CultureInfo.InvariantCulture,
                    "{0}: expected {1:0.######} +/- {2:0.######}, got {3:0.######}",
                    what, expected, tolerance, actual));
            }
        }

        public static void Near(Vec3 expected, Vec3 actual, float tolerance, string what)
        {
            if (!MathUtil.Approximately(expected, actual, tolerance))
            {
                throw new TestFailure($"{what}: expected {expected} +/- {tolerance}, got {actual}");
            }
        }

        public static void Near(Vec2 expected, Vec2 actual, float tolerance, string what)
        {
            if (!MathUtil.Approximately(expected, actual, tolerance))
            {
                throw new TestFailure($"{what}: expected {expected} +/- {tolerance}, got {actual}");
            }
        }

        public static void Throws<TException>(Action action, string what)
            where TException : Exception
        {
            try
            {
                action();
            }
            catch (TException)
            {
                return;
            }
            catch (Exception e)
            {
                throw new TestFailure(
                    $"{what}: expected {typeof(TException).Name}, got {e.GetType().Name}");
            }

            throw new TestFailure($"{what}: expected {typeof(TException).Name}, nothing was thrown");
        }
    }

    /// <summary>The outcome of one test case.</summary>
    public sealed class TestResult
    {
        public string Suite;
        public string Name;
        public string Requirement;
        public bool Passed;
        public string Failure;
        public bool Crashed;

        /// <summary>One line, shared by both runners so their output stays comparable.</summary>
        public string Describe()
        {
            string tag = string.IsNullOrEmpty(Requirement) ? string.Empty : $" [{Requirement}]";
            return Passed
                ? $"PASS  {Name}{tag}"
                : $"FAIL  {Name}{tag}{Environment.NewLine}        {Failure}";
        }
    }

    /// <summary>Everything one run produced.</summary>
    public sealed class TestRunSummary
    {
        public List<TestResult> Results = new List<TestResult>();
        public long ElapsedMilliseconds;

        public int Passed => Results.Count(r => r.Passed);

        public int Failed => Results.Count - Passed;

        public int Crashed => Results.Count(r => r.Crashed);

        public bool AllPassed => Failed == 0;

        public string Headline() => string.Format(
            CultureInfo.InvariantCulture,
            "{0} test(s): {1} passed, {2} failed{3}  ({4} ms)",
            Results.Count,
            Passed,
            Failed,
            Crashed > 0 ? $", {Crashed} crashed" : string.Empty,
            ElapsedMilliseconds);

        /// <summary>Only the failures, for an assertion message.</summary>
        public string DescribeFailures()
        {
            StringBuilder builder = new StringBuilder();
            foreach (TestResult result in Results.Where(r => !r.Passed))
            {
                builder.AppendLine($"{result.Suite}: {result.Describe()}");
            }

            return builder.ToString();
        }
    }

    /// <summary>
    /// Discovers and runs every <see cref="TestAttribute"/> method in the assembly.
    /// </summary>
    /// <remarks>
    /// Hand-rolled rather than xunit or NUnit, for one reason that matters on this project: it has
    /// no package dependencies, so a validation run cannot be blocked by a NuGet restore. The
    /// project has already lost sessions to environment problems, and the test suite is the one
    /// thing that must keep working.
    /// <para>
    /// <strong>Running is separated from reporting on purpose.</strong> These files live under
    /// <c>Assets/Tests/EditMode</c> and are compiled twice: once by the .NET console harness in
    /// <c>Tests/DotNet/ImpactTheory.CoreTests</c>, and once by Unity's Test Framework via
    /// <c>UnityTestBridge</c>. One copy of every assertion, two runners, and no chance of the two
    /// drifting apart - which is exactly what would happen if the Unity suite were a hand-written
    /// duplicate.
    /// </para>
    /// </remarks>
    public static class TestRunner
    {
        /// <summary>Discovers and runs every test in the calling assembly. Produces no output.</summary>
        public static TestRunSummary Run()
        {
            TestRunSummary summary = new TestRunSummary();
            Stopwatch clock = Stopwatch.StartNew();

            IEnumerable<Type> suites = typeof(TestRunner).Assembly
                .GetTypes()
                .Where(t => t.GetMethods(BindingFlags.Public | BindingFlags.Static)
                    .Any(m => m.GetCustomAttribute<TestAttribute>() != null))
                .OrderBy(t => t.Name, StringComparer.Ordinal);

            foreach (Type suite in suites)
            {
                IEnumerable<MethodInfo> methods = suite
                    .GetMethods(BindingFlags.Public | BindingFlags.Static)
                    .Where(m => m.GetCustomAttribute<TestAttribute>() != null);

                foreach (MethodInfo method in methods)
                {
                    TestAttribute attribute = method.GetCustomAttribute<TestAttribute>();
                    TestResult result = new TestResult
                    {
                        Suite = suite.Name,
                        Name = attribute.Name,
                        Requirement = attribute.Requirement,
                    };

                    try
                    {
                        method.Invoke(null, null);
                        result.Passed = true;
                    }
                    catch (TargetInvocationException invocation)
                        when (invocation.InnerException is TestFailure failure)
                    {
                        result.Passed = false;
                        result.Failure = failure.Message;
                    }
                    catch (TargetInvocationException invocation)
                    {
                        result.Passed = false;
                        result.Crashed = true;
                        result.Failure = invocation.InnerException?.ToString() ?? invocation.ToString();
                    }

                    summary.Results.Add(result);
                }
            }

            clock.Stop();
            summary.ElapsedMilliseconds = clock.ElapsedMilliseconds;
            return summary;
        }
    }
}
