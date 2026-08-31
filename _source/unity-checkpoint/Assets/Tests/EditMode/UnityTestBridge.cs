using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace ImpactTheory.CoreTests
{
    /// <summary>
    /// Runs the Impact Theory rule suite inside Unity's Test Framework.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The mirror image of <c>Tests/DotNet/ImpactTheory.CoreTests/Program.cs</c>. Every assertion
    /// lives in this folder and is compiled by both, so there is exactly one copy of the rules'
    /// tests and no possibility of a Unity suite silently drifting from the .NET one.
    /// </para>
    /// <para>
    /// Running inside Unity buys two things the console runner cannot. The tests are compiled by
    /// Unity's own compiler at its own language level, so any incompatibility surfaces here rather
    /// than in a build; and they appear in the Test Runner window, where a developer working in the
    /// editor will actually see them.
    /// </para>
    /// <para>
    /// Presented as one test per suite rather than one per case. Unity discovers NUnit methods, and
    /// these cases are discovered reflectively by <see cref="TestRunner"/> - bridging every case
    /// individually would mean either duplicating the attribute on each method or generating them,
    /// and neither is worth it to make the Test Runner window list them separately. A failure still
    /// names the exact case and its message.
    /// </para>
    /// </remarks>
    [TestFixture]
    public sealed class UnityTestBridge
    {
        private static TestRunSummary _summary;

        private static TestRunSummary Summary => _summary ?? (_summary = TestRunner.Run());

        [NUnit.Framework.Test]
        public void AllCoreRulesPass()
        {
            TestRunSummary summary = Summary;

            Debug.Log($"[Impact Theory] {summary.Headline()}");

            Assert.That(
                summary.AllPassed,
                Is.True,
                "Core rule failures:\n" + summary.DescribeFailures());
        }

        [NUnit.Framework.Test]
        public void TheSuiteActuallyRanSomething()
        {
            // Guards against the failure mode where reflective discovery silently finds nothing -
            // an empty run reports "0 failed" and looks exactly like success.
            Assert.That(
                Summary.Results.Count,
                Is.GreaterThan(50),
                "Reflective test discovery found almost nothing, which means the suite is not " +
                "running rather than passing.");
        }

        [NUnit.Framework.Test]
        public void NoTestCrashed()
        {
            // A crash is a different kind of bug from a failed assertion: it means the code under
            // test threw where it was not expected to, and the distinction is worth keeping.
            string crashed = string.Join(
                "\n", Summary.Results.Where(r => r.Crashed).Select(r => r.Describe()));

            Assert.That(string.IsNullOrEmpty(crashed), Is.True, "Crashed tests:\n" + crashed);
        }

        [NUnit.Framework.Test]
        public void EveryOffPlatformEdgeCaseIsCovered()
        {
            // VAL-015 names the edge cases that must be proven. This asserts the suite still
            // contains them, so that deleting a test is a failure rather than a quiet reduction in
            // coverage.
            int offPlatformTests = Summary.Results.Count(r => r.Requirement == "VAL-015");

            Assert.That(
                offPlatformTests,
                Is.GreaterThanOrEqualTo(15),
                $"Only {offPlatformTests} tests are tagged VAL-015. The off-platform edge-case " +
                "suite has shrunk.");
        }
    }
}
