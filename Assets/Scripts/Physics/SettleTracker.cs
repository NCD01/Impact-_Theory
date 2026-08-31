using System.Collections.Generic;
using System.Globalization;

namespace ImpactTheory.Physics
{
    /// <summary>The settling rule's thresholds.</summary>
    public readonly struct SettleSettings
    {
        public SettleSettings(float linearThreshold, float angularThreshold, float dwellTime, float timeout)
        {
            LinearThreshold = linearThreshold;
            AngularThreshold = angularThreshold;
            DwellTime = dwellTime;
            Timeout = timeout;
        }

        /// <summary>m/s.</summary>
        public float LinearThreshold { get; }

        /// <summary>rad/s.</summary>
        public float AngularThreshold { get; }

        /// <summary>How long a body must stay below both thresholds, seconds.</summary>
        public float DwellTime { get; }

        /// <summary>Hard cap on the wait, seconds.</summary>
        public float Timeout { get; }
    }

    /// <summary>One rigid body's motion at a single physics step.</summary>
    public readonly struct BodyMotion
    {
        public BodyMotion(string bodyId, float linearSpeed, float angularSpeed)
        {
            BodyId = bodyId;
            LinearSpeed = linearSpeed;
            AngularSpeed = angularSpeed;
        }

        public string BodyId { get; }

        /// <summary>Magnitude of linear velocity, m/s.</summary>
        public float LinearSpeed { get; }

        /// <summary>Magnitude of angular velocity, rad/s.</summary>
        public float AngularSpeed { get; }
    }

    /// <summary>The outcome of a settling check at one step.</summary>
    public readonly struct SettleReport
    {
        public SettleReport(
            bool isResolved,
            bool timedOut,
            float elapsed,
            int bodyCount,
            int movingCount,
            int aboveLinear,
            int aboveAngular)
        {
            IsResolved = isResolved;
            TimedOut = timedOut;
            Elapsed = elapsed;
            BodyCount = bodyCount;
            MovingCount = movingCount;
            AboveLinearThreshold = aboveLinear;
            AboveAngularThreshold = aboveAngular;
        }

        /// <summary>The shot may be scored: either everything settled, or the timeout expired.</summary>
        public bool IsResolved { get; }

        /// <summary>Resolved by timeout rather than by everything coming to rest.</summary>
        public bool TimedOut { get; }

        public float Elapsed { get; }

        public int BodyCount { get; }

        /// <summary>Bodies that have not yet held still for the full dwell time.</summary>
        public int MovingCount { get; }

        public int AboveLinearThreshold { get; }

        public int AboveAngularThreshold { get; }

        /// <summary>
        /// A log line that explains the decision.
        /// </summary>
        /// <remarks>
        /// Written to the shape <c>Docs/Logging.md</c> §6 asks for. A record reading
        /// "physics settled" is nearly useless; one that names the elapsed time, the body count, and
        /// what was still moving at timeout is what diagnoses a bug.
        /// </remarks>
        public string Describe()
        {
            if (!IsResolved)
            {
                return string.Format(
                    CultureInfo.InvariantCulture,
                    "settling: {0:0.##}s elapsed, {1} of {2} bodies still moving",
                    Elapsed, MovingCount, BodyCount);
            }

            if (!TimedOut)
            {
                return string.Format(
                    CultureInfo.InvariantCulture,
                    "settled after {0:0.##}s, {1} bodies",
                    Elapsed, BodyCount);
            }

            return string.Format(
                CultureInfo.InvariantCulture,
                "settle TIMEOUT after {0:0.##}s, {1} bodies, {2} still moving " +
                "({3} above linear threshold, {4} above angular threshold)",
                Elapsed, BodyCount, MovingCount, AboveLinearThreshold, AboveAngularThreshold);
        }

        public override string ToString() => Describe();
    }

    /// <summary>
    /// Decides when a shot has finished resolving.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Docs/GameDesign.md</c> §24 requires the game to know when a shot has settled before
    /// scoring or allowing dependent actions, and <c>Docs/Physics.md</c> §7 gives the rule: a body
    /// is settled once its linear and angular speeds stay below thresholds for a continuous dwell
    /// time, and the scene is settled once every tracked body is, or a hard timeout expires.
    /// </para>
    /// <para>
    /// Tracked explicitly rather than deferring to Unity's own sleep mechanism. The moment a shot
    /// resolves is gameplay-visible - it is when the win condition is tested and the score moves -
    /// so it needs to be deterministic and loggable, and engine sleep is neither of those from the
    /// game's point of view.
    /// </para>
    /// <para>
    /// The dwell time is what makes this robust. Without it, a block momentarily at rest at the top
    /// of a bounce would read as settled, and the level would be scored mid-collapse.
    /// </para>
    /// </remarks>
    public sealed class SettleTracker
    {
        private readonly Dictionary<string, float> _dwell = new Dictionary<string, float>();
        private SettleSettings _settings;
        private float _elapsed;
        private bool _resolved;
        private bool _timedOut;

        public SettleTracker(SettleSettings settings)
        {
            _settings = settings;
        }

        public bool IsResolved => _resolved;

        public bool TimedOut => _timedOut;

        public float Elapsed => _elapsed;

        /// <summary>Starts a fresh observation. Call when a shot is fired.</summary>
        public void Begin()
        {
            _dwell.Clear();
            _elapsed = 0f;
            _resolved = false;
            _timedOut = false;
        }

        /// <summary>Replaces the thresholds, for example after a physics configuration reload.</summary>
        public void Configure(SettleSettings settings)
        {
            _settings = settings;
        }

        /// <summary>Advances the tracker by one step.</summary>
        public SettleReport Step(float deltaTime, IReadOnlyList<BodyMotion> bodies)
        {
            if (_resolved)
            {
                return new SettleReport(true, _timedOut, _elapsed, bodies?.Count ?? 0, 0, 0, 0);
            }

            _elapsed += deltaTime;

            int bodyCount = bodies?.Count ?? 0;
            int moving = 0;
            int aboveLinear = 0;
            int aboveAngular = 0;

            for (int i = 0; i < bodyCount; i++)
            {
                BodyMotion body = bodies[i];

                bool linearStill = body.LinearSpeed < _settings.LinearThreshold;
                bool angularStill = body.AngularSpeed < _settings.AngularThreshold;

                if (!linearStill)
                {
                    aboveLinear++;
                }

                if (!angularStill)
                {
                    aboveAngular++;
                }

                if (linearStill && angularStill)
                {
                    _dwell.TryGetValue(body.BodyId, out float held);
                    held += deltaTime;
                    _dwell[body.BodyId] = held;

                    if (held < _settings.DwellTime)
                    {
                        moving++;
                    }
                }
                else
                {
                    // Any motion above threshold restarts the clock. A body that twitches after
                    // holding still for 0.4 s has not settled - it was mid-bounce.
                    _dwell[body.BodyId] = 0f;
                    moving++;
                }
            }

            // An empty scene is trivially settled; without this the tracker would wait out the
            // whole timeout after the last piece despawns.
            bool everythingStill = moving == 0;

            if (everythingStill)
            {
                _resolved = true;
                _timedOut = false;
            }
            else if (_elapsed >= _settings.Timeout)
            {
                _resolved = true;
                _timedOut = true;
            }

            return new SettleReport(
                _resolved, _timedOut, _elapsed, bodyCount, moving, aboveLinear, aboveAngular);
        }
    }
}
