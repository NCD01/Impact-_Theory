using System;

namespace ImpactTheory.Gameplay
{
    /// <summary>Where a level is in its lifecycle.</summary>
    public enum LevelPhase
    {
        /// <summary>Nothing loaded yet.</summary>
        Loading = 0,

        /// <summary>
        /// The structure is spawned and physics is being allowed to settle before play begins.
        /// </summary>
        /// <remarks>
        /// A structure dropped into a scene always twitches as contacts resolve. Letting the player
        /// aim during that would mean aiming at a target that is still moving, and it would also
        /// make the first shot's settle detection ambiguous.
        /// </remarks>
        Settling = 1,

        /// <summary>Settled and waiting for the player.</summary>
        Ready = 2,

        /// <summary>The player is choosing direction and power.</summary>
        Aiming = 3,

        /// <summary>A ball is in flight or the structure is still moving.</summary>
        Resolving = 4,

        /// <summary>Every required piece has left the platform.</summary>
        Won = 5,

        /// <summary>The allowance was exhausted and the structure remained.</summary>
        Failed = 6,
    }

    /// <summary>
    /// Owns the level lifecycle: aim, fire, resolve, and win or fail.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Deliberately free of Unity and of physics. It is handed the answer to "is the structure
    /// cleared?" and decides what that means for the level, which keeps the rules of the game
    /// testable without a running simulation.
    /// </para>
    /// <para>
    /// The one rule worth stating explicitly, from <c>Docs/GameDesign.md</c> §23: the level fails
    /// when the structure remains <em>after the final allowed shot resolves</em>. Firing the last
    /// ball is not losing. The state machine therefore never transitions to
    /// <see cref="LevelPhase.Failed"/> on <see cref="Fire"/>, only on
    /// <see cref="ResolveShot"/>.
    /// </para>
    /// </remarks>
    public sealed class LevelStateMachine
    {
        private readonly ScoreCalculator _scoreCalculator;

        public LevelStateMachine(ScoreCalculator scoreCalculator = null)
        {
            _scoreCalculator = scoreCalculator ?? new ScoreCalculator();
            Balls = new BallAllowance(0);
            Phase = LevelPhase.Loading;
        }

        /// <summary>Raised on every phase change, for logging and UI.</summary>
        public event Action<LevelPhase, LevelPhase> PhaseChanged;

        public LevelPhase Phase { get; private set; }

        public string LevelId { get; private set; }

        public BallAllowance Balls { get; }

        public float DifficultyMultiplier { get; private set; } = 1f;

        /// <summary>The score once the level has ended. Zero before that.</summary>
        public ScoreResult Score { get; private set; }

        /// <summary>True once the level has reached a terminal phase.</summary>
        public bool IsOver => Phase == LevelPhase.Won || Phase == LevelPhase.Failed;

        /// <summary>Loads a level and puts it into <see cref="LevelPhase.Settling"/>.</summary>
        public void BeginLevel(string levelId, int ballAllowance, float difficultyMultiplier = 1f)
        {
            LevelId = levelId;
            DifficultyMultiplier = difficultyMultiplier <= 0f ? 1f : difficultyMultiplier;
            Balls.Reset(ballAllowance);
            Score = default;
            SetPhase(LevelPhase.Settling);
        }

        /// <summary>The initial structure has come to rest; play may begin.</summary>
        public void StructureSettled()
        {
            if (Phase == LevelPhase.Settling)
            {
                SetPhase(LevelPhase.Ready);
            }
        }

        /// <summary>The player began aiming.</summary>
        public void BeginAim()
        {
            if (Phase == LevelPhase.Ready)
            {
                SetPhase(LevelPhase.Aiming);
            }
        }

        /// <summary>The player abandoned the current aim.</summary>
        public void CancelAim()
        {
            if (Phase == LevelPhase.Aiming)
            {
                SetPhase(LevelPhase.Ready);
            }
        }

        /// <summary>
        /// Fires a ball. Returns false when firing is not currently legal.
        /// </summary>
        /// <remarks>
        /// Firing is allowed from <see cref="LevelPhase.Ready"/> as well as
        /// <see cref="LevelPhase.Aiming"/>, because a quick tap on touch is a fire without a
        /// separate aim step, and forcing an artificial aim phase for it would make the input
        /// abstraction leak into the rules.
        /// </remarks>
        public bool Fire()
        {
            if (Phase != LevelPhase.Aiming && Phase != LevelPhase.Ready)
            {
                return false;
            }

            if (!Balls.RecordShot())
            {
                return false;
            }

            SetPhase(LevelPhase.Resolving);
            return true;
        }

        /// <summary>
        /// Reports the outcome once the shot has settled.
        /// </summary>
        /// <param name="structureCleared">
        /// Whether every required piece has left the platform, as decided by
        /// <c>OffPlatformEvaluator</c>.
        /// </param>
        public void ResolveShot(bool structureCleared)
        {
            if (Phase != LevelPhase.Resolving)
            {
                return;
            }

            if (structureCleared)
            {
                Score = _scoreCalculator.Calculate(
                    true, Balls.Allowed, Balls.Used, DifficultyMultiplier);
                SetPhase(LevelPhase.Won);
                return;
            }

            // The structure survived. Only now, with the shot fully resolved, does an exhausted
            // allowance become a loss.
            if (Balls.IsExhausted)
            {
                Score = _scoreCalculator.Calculate(
                    false, Balls.Allowed, Balls.Used, DifficultyMultiplier);
                SetPhase(LevelPhase.Failed);
                return;
            }

            SetPhase(LevelPhase.Ready);
        }

        /// <summary>Restarts the current level from the beginning.</summary>
        public void Restart()
        {
            Balls.Reset();
            Score = default;
            SetPhase(LevelPhase.Settling);
        }

        private void SetPhase(LevelPhase next)
        {
            if (Phase == next)
            {
                return;
            }

            LevelPhase previous = Phase;
            Phase = next;
            PhaseChanged?.Invoke(previous, next);
        }
    }
}
