using System;
using System.Collections.Generic;
using System.Text;

namespace ImpactTheory.Core.Logging
{
    /// <summary>
    /// A fixed-size in-memory buffer of the most recent records.
    /// </summary>
    /// <remarks>
    /// This is the sink that matters for the Web target. When a structure collapses wrongly in
    /// Chrome, attaching a debugger is awkward and reproducing it is worse; the useful artefact is
    /// the last few hundred records plus the seed, which a tester can copy out in one action
    /// (<c>Docs/Logging.md</c> §4).
    /// </remarks>
    public sealed class RingBufferSink : ILogSink
    {
        private readonly LogRecord[] _records;
        private int _next;
        private int _count;

        public RingBufferSink(int capacity = 512)
        {
            _records = new LogRecord[capacity < 1 ? 1 : capacity];
        }

        public int Capacity => _records.Length;

        public int Count => _count;

        public void Write(LogRecord record)
        {
            _records[_next] = record;
            _next = (_next + 1) % _records.Length;
            if (_count < _records.Length)
            {
                _count++;
            }
        }

        /// <summary>The buffered records, oldest first.</summary>
        public IReadOnlyList<LogRecord> Snapshot()
        {
            List<LogRecord> ordered = new List<LogRecord>(_count);
            int start = _count == _records.Length ? _next : 0;

            for (int i = 0; i < _count; i++)
            {
                ordered.Add(_records[(start + i) % _records.Length]);
            }

            return ordered;
        }

        /// <summary>The buffer as text, ready to paste into a bug report.</summary>
        public string Dump()
        {
            StringBuilder builder = new StringBuilder(_count * 96);
            foreach (LogRecord record in Snapshot())
            {
                builder.AppendLine(record.Format());
            }

            return builder.ToString();
        }

        public void Clear()
        {
            _next = 0;
            _count = 0;
        }
    }

    /// <summary>Routes records to an arbitrary callback - the Unity console, a browser console, a test.</summary>
    public sealed class DelegateSink : ILogSink
    {
        private readonly Action<LogRecord> _write;

        public DelegateSink(Action<LogRecord> write)
        {
            _write = write ?? throw new ArgumentNullException(nameof(write));
        }

        public void Write(LogRecord record) => _write(record);
    }

    /// <summary>
    /// The logging entry point.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Logging is mandatory on this project, not an optional post-development feature
    /// (<c>Docs/GameDesign.md</c> §49, Addendum 005 §10).
    /// </para>
    /// <para>
    /// Static because a logger threaded through every constructor is a logger that ends up not
    /// being called from the places that matter. The cost of that convenience is that it needs
    /// resetting between tests, which <see cref="Reset"/> provides.
    /// </para>
    /// <para>
    /// The clock is injected rather than read from Unity, so that <c>Core</c> stays engine-free.
    /// The Unity layer points <see cref="FrameProvider"/> and <see cref="FixedStepProvider"/> at
    /// <c>Time.frameCount</c> and its own fixed-step counter during bootstrap.
    /// </para>
    /// </remarks>
    public static class Log
    {
        private static readonly List<ILogSink> Sinks = new List<ILogSink>();
        private static readonly object Gate = new object();

        /// <summary>Records below this level are discarded before a record is even built.</summary>
        public static LogLevel MinimumLevel { get; set; } = LogLevel.Info;

        /// <summary>Supplies the render frame count. Defaults to zero outside Unity.</summary>
        public static Func<int> FrameProvider { get; set; }

        /// <summary>Supplies the physics step count. Defaults to zero outside Unity.</summary>
        public static Func<int> FixedStepProvider { get; set; }

        /// <summary>Supplies the wall clock. Injectable so tests are not time-dependent.</summary>
        public static Func<DateTime> ClockProvider { get; set; }

        /// <summary>
        /// Stamped onto physics and structure records.
        /// </summary>
        /// <remarks>
        /// <c>Docs/Logging.md</c> §3 requires it, and the reason is reconstruction: a logged
        /// collapse that cannot be tied to a physics configuration cannot be reproduced, and
        /// Addendum 001 §14 requires any structure involved in a failed validation to be
        /// reproducible.
        /// </remarks>
        public static int PhysicsConfigVersion { get; set; }

        /// <summary>The current structure's seed, once generation exists.</summary>
        public static string StructureSeed { get; set; }

        public static void AddSink(ILogSink sink)
        {
            if (sink == null)
            {
                return;
            }

            lock (Gate)
            {
                Sinks.Add(sink);
            }
        }

        public static void RemoveSink(ILogSink sink)
        {
            lock (Gate)
            {
                Sinks.Remove(sink);
            }
        }

        /// <summary>Drops every sink and restores defaults. Call between tests.</summary>
        public static void Reset()
        {
            lock (Gate)
            {
                Sinks.Clear();
            }

            MinimumLevel = LogLevel.Info;
            FrameProvider = null;
            FixedStepProvider = null;
            ClockProvider = null;
            PhysicsConfigVersion = 0;
            StructureSeed = null;
        }

        public static bool IsEnabled(LogLevel level) => level >= MinimumLevel;

        public static void Trace(LogCategory category, string message,
            IReadOnlyDictionary<string, string> context = null) =>
            Write(LogLevel.Trace, category, message, context);

        public static void Debug(LogCategory category, string message,
            IReadOnlyDictionary<string, string> context = null) =>
            Write(LogLevel.Debug, category, message, context);

        public static void Info(LogCategory category, string message,
            IReadOnlyDictionary<string, string> context = null) =>
            Write(LogLevel.Info, category, message, context);

        public static void Warn(LogCategory category, string message,
            IReadOnlyDictionary<string, string> context = null) =>
            Write(LogLevel.Warn, category, message, context);

        /// <summary>
        /// Records a failure.
        /// </summary>
        /// <remarks>
        /// Written twice: once under its originating category so the trail is intact, and once
        /// under <see cref="LogCategory.Error"/> so a single filter finds every failure in the
        /// session. That duplication is the behaviour <c>Docs/Logging.md</c> §1 asks for.
        /// </remarks>
        public static void Error(LogCategory category, string message,
            IReadOnlyDictionary<string, string> context = null)
        {
            Write(LogLevel.Error, category, message, context);
            if (category != LogCategory.Error)
            {
                Write(LogLevel.Error, LogCategory.Error, message, context);
            }
        }

        public static void Fatal(LogCategory category, string message,
            IReadOnlyDictionary<string, string> context = null)
        {
            Write(LogLevel.Fatal, category, message, context);
            if (category != LogCategory.Error)
            {
                Write(LogLevel.Fatal, LogCategory.Error, message, context);
            }
        }

        /// <summary>Convenience for building a context payload without ceremony at the call site.</summary>
        public static Dictionary<string, string> Context(params string[] keyValuePairs)
        {
            Dictionary<string, string> context = new Dictionary<string, string>();
            for (int i = 0; i + 1 < keyValuePairs.Length; i += 2)
            {
                context[keyValuePairs[i]] = keyValuePairs[i + 1];
            }

            return context;
        }

        private static void Write(
            LogLevel level,
            LogCategory category,
            string message,
            IReadOnlyDictionary<string, string> context)
        {
            if (!IsEnabled(level))
            {
                return;
            }

            // Physics and structure records carry the configuration version, because without it a
            // logged failure cannot be reconstructed.
            if (PhysicsConfigVersion != 0 &&
                (category == LogCategory.Physics || category == LogCategory.Structure))
            {
                Dictionary<string, string> enriched = context == null
                    ? new Dictionary<string, string>()
                    : new Dictionary<string, string>((IDictionary<string, string>)context);

                enriched["physicsConfigVersion"] =
                    PhysicsConfigVersion.ToString(System.Globalization.CultureInfo.InvariantCulture);

                if (!string.IsNullOrEmpty(StructureSeed))
                {
                    enriched["seed"] = StructureSeed;
                }

                context = enriched;
            }

            LogRecord record = new LogRecord(
                ClockProvider != null ? ClockProvider() : DateTime.UtcNow,
                FrameProvider != null ? FrameProvider() : 0,
                FixedStepProvider != null ? FixedStepProvider() : 0,
                level,
                category,
                message,
                context);

            lock (Gate)
            {
                for (int i = 0; i < Sinks.Count; i++)
                {
                    Sinks[i].Write(record);
                }
            }
        }
    }
}
