using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace ImpactTheory.Core.Logging
{
    /// <summary>
    /// Severity. Production builds drop <see cref="Trace"/> and <see cref="Debug"/> entirely.
    /// </summary>
    public enum LogLevel
    {
        /// <summary>Per-frame or per-step detail. Off by default even in development.</summary>
        Trace = 0,

        /// <summary>Developer diagnostics.</summary>
        Debug = 1,

        /// <summary>Meaningful state changes.</summary>
        Info = 2,

        /// <summary>Recoverable anomaly; play continues.</summary>
        Warn = 3,

        /// <summary>An operation failed.</summary>
        Error = 4,

        /// <summary>Cannot continue safely.</summary>
        Fatal = 5,
    }

    /// <summary>
    /// The fixed category set from <c>Docs/Logging.md</c> §1. Every record belongs to exactly one.
    /// </summary>
    /// <remarks>
    /// <see cref="Error"/> is deliberately both a category and adjacent to a level. A failure is
    /// routed here <em>and</em> keeps its originating category in the record, so one filter finds
    /// every failure in a session without losing the trail back to what was actually going on.
    /// </remarks>
    public enum LogCategory
    {
        Game = 0,
        Physics = 1,
        Structure = 2,
        Input = 3,
        Generator = 4,
        Solver = 5,
        Save = 6,
        UI = 7,
        Asset = 8,
        Build = 9,
        Error = 10,
    }

    /// <summary>
    /// One log record.
    /// </summary>
    /// <remarks>
    /// The field set is fixed by <c>Docs/Logging.md</c> §3. <see cref="FixedStep"/> is separate from
    /// <see cref="Frame"/> on purpose: physics events happen on the fixed clock, and correlating a
    /// collapse against render frames instead of physics steps makes an ordering bug impossible to
    /// see.
    /// </remarks>
    public readonly struct LogRecord
    {
        public LogRecord(
            DateTime timestampUtc,
            int frame,
            int fixedStep,
            LogLevel level,
            LogCategory category,
            string message,
            IReadOnlyDictionary<string, string> context)
        {
            TimestampUtc = timestampUtc;
            Frame = frame;
            FixedStep = fixedStep;
            Level = level;
            Category = category;
            Message = message;
            Context = context;
        }

        public DateTime TimestampUtc { get; }

        /// <summary>Render frame count.</summary>
        public int Frame { get; }

        /// <summary>Physics step count - the meaningful clock for physics events.</summary>
        public int FixedStep { get; }

        public LogLevel Level { get; }

        public LogCategory Category { get; }

        public string Message { get; }

        /// <summary>Optional structured payload. Null when there is none.</summary>
        public IReadOnlyDictionary<string, string> Context { get; }

        /// <summary>Renders the record as one line, for a console or a copied bug report.</summary>
        public string Format()
        {
            StringBuilder builder = new StringBuilder(128);
            builder.Append(TimestampUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture));
            builder.Append(" [").Append(Level.ToString().ToUpperInvariant()).Append(']');
            builder.Append(" [").Append(Category.ToString().ToUpperInvariant()).Append(']');
            builder.Append(" f=").Append(Frame.ToString(CultureInfo.InvariantCulture));
            builder.Append(" s=").Append(FixedStep.ToString(CultureInfo.InvariantCulture));
            builder.Append(' ').Append(Message);

            if (Context != null && Context.Count > 0)
            {
                builder.Append(" {");
                bool first = true;
                foreach (KeyValuePair<string, string> pair in Context)
                {
                    if (!first)
                    {
                        builder.Append(", ");
                    }

                    builder.Append(pair.Key).Append('=').Append(pair.Value);
                    first = false;
                }

                builder.Append('}');
            }

            return builder.ToString();
        }

        public override string ToString() => Format();
    }

    /// <summary>A destination for log records.</summary>
    public interface ILogSink
    {
        void Write(LogRecord record);
    }
}
