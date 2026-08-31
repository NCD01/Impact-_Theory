using ImpactTheory.Core.Logging;
using UnityEngine;

namespace ImpactTheory.Runtime.Core
{
    /// <summary>
    /// Routes Impact Theory log records to the Unity console, and in a Web build to the browser console.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Severity is mapped rather than flattened: warnings arrive as warnings and errors as errors,
    /// so Unity's console filters and the browser's own severity filters both work. Flattening
    /// everything to <c>Debug.Log</c> is the common shortcut and it makes a console full of
    /// physics tracing useless during a collapse investigation.
    /// </para>
    /// <para>
    /// <c>Debug.LogError</c> is deliberately not used for <see cref="LogLevel.Error"/> in a
    /// development build where the debug overlay is present, because Unity's error pause would stop
    /// play mid-collapse and destroy the state being investigated. It is used for
    /// <see cref="LogLevel.Fatal"/>, where stopping is the point.
    /// </para>
    /// </remarks>
    public sealed class UnityLogSink : ILogSink
    {
        public void Write(LogRecord record)
        {
            string line = record.Format();

            switch (record.Level)
            {
                case LogLevel.Fatal:
                    Debug.LogError(line);
                    break;

                case LogLevel.Error:
                case LogLevel.Warn:
                    Debug.LogWarning(line);
                    break;

                default:
                    Debug.Log(line);
                    break;
            }
        }
    }
}
