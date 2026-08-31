using System.Globalization;

namespace ImpactTheory.Gameplay
{
    /// <summary>Tunable scoring constants.</summary>
    /// <remarks>
    /// Data, not constants scattered through gameplay code (<c>Docs/GameDesign.md</c> §24).
    /// </remarks>
    public sealed class ScoreSettings
    {
        /// <summary>Awarded for clearing the platform at all.</summary>
        public int BaseClearScore { get; set; } = 1000;

        /// <summary>Awarded per ball left unused. This is the primary scoring lever.</summary>
        public int PerUnusedBall { get; set; } = 250;

        /// <summary>Extra for clearing the structure with a single ball.</summary>
        public int OneShotBonus { get; set; } = 500;
    }

    /// <summary>A scored result, broken into its parts.</summary>
    /// <remarks>
    /// The breakdown is kept rather than just the total so the HUD can show why a score is what it
    /// is. A player who cannot see that the efficiency term dominates will not understand that
    /// fewer balls is the objective.
    /// </remarks>
    public readonly struct ScoreResult
    {
        public ScoreResult(
            bool cleared,
            int ballsAllowed,
            int ballsUsed,
            int baseScore,
            int efficiencyBonus,
            int oneShotBonus,
            float difficultyMultiplier,
            int total)
        {
            Cleared = cleared;
            BallsAllowed = ballsAllowed;
            BallsUsed = ballsUsed;
            BaseScore = baseScore;
            EfficiencyBonus = efficiencyBonus;
            OneShotBonus = oneShotBonus;
            DifficultyMultiplier = difficultyMultiplier;
            Total = total;
        }

        public bool Cleared { get; }

        public int BallsAllowed { get; }

        public int BallsUsed { get; }

        public int BaseScore { get; }

        /// <summary>The unused-ball reward. Dominant by design.</summary>
        public int EfficiencyBonus { get; }

        public int OneShotBonus { get; }

        public float DifficultyMultiplier { get; }

        public int Total { get; }

        public int BallsUnused => BallsAllowed - BallsUsed;

        public string Describe() => Cleared
            ? string.Format(
                CultureInfo.InvariantCulture,
                "cleared with {0}/{1} balls: base {2} + efficiency {3} + one-shot {4}, " +
                "x{5:0.##} difficulty = {6}",
                BallsUsed, BallsAllowed, BaseScore, EfficiencyBonus, OneShotBonus,
                DifficultyMultiplier, Total)
            : string.Format(
                CultureInfo.InvariantCulture,
                "not cleared after {0}/{1} balls: 0", BallsUsed, BallsAllowed);

        public override string ToString() => Describe();
    }

    /// <summary>
    /// Turns a completed level into a score.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The primary rule is fixed by <c>Docs/GameDesign.md</c> §25: <strong>fewer balls used means a
    /// higher score</strong>. Everything else is secondary, and the same section warns that
    /// secondary rules must not obscure the primary objective - so the efficiency term is
    /// deliberately the largest movable component, and a one-shot clear is a bonus on top of
    /// already having spent the fewest balls rather than a separate way to win.
    /// </para>
    /// <para>
    /// Difficulty is a multiplier rather than an additive term, so that a hard level cleared
    /// wastefully still scores below an easy level cleared well at the same difficulty - the
    /// efficiency signal survives scaling.
    /// </para>
    /// </remarks>
    public sealed class ScoreCalculator
    {
        private readonly ScoreSettings _settings;

        public ScoreCalculator(ScoreSettings settings = null)
        {
            _settings = settings ?? new ScoreSettings();
        }

        /// <param name="cleared">Whether every required piece left the platform.</param>
        /// <param name="ballsAllowed">The level's allowance.</param>
        /// <param name="ballsUsed">How many were actually fired.</param>
        /// <param name="difficultyMultiplier">Level difficulty, 1.0 being nominal.</param>
        public ScoreResult Calculate(
            bool cleared, int ballsAllowed, int ballsUsed, float difficultyMultiplier = 1f)
        {
            if (ballsAllowed < 0)
            {
                ballsAllowed = 0;
            }

            if (ballsUsed < 0)
            {
                ballsUsed = 0;
            }

            // A failed level scores nothing. There is no partial credit, because there is no
            // partial destruction - the win condition is all-or-nothing by design
            // (Docs/GameDesign.md section 10), and a consolation score would quietly reintroduce
            // the percentage-destruction model the specification rules out.
            if (!cleared)
            {
                return new ScoreResult(
                    false, ballsAllowed, ballsUsed, 0, 0, 0, difficultyMultiplier, 0);
            }

            int unused = ballsAllowed - ballsUsed;
            if (unused < 0)
            {
                unused = 0;
            }

            int efficiency = unused * _settings.PerUnusedBall;
            int oneShot = ballsUsed == 1 ? _settings.OneShotBonus : 0;

            int subtotal = _settings.BaseClearScore + efficiency + oneShot;
            int total = (int)System.Math.Round(subtotal * (double)difficultyMultiplier);

            return new ScoreResult(
                true,
                ballsAllowed,
                ballsUsed,
                _settings.BaseClearScore,
                efficiency,
                oneShot,
                difficultyMultiplier,
                total);
        }
    }
}
