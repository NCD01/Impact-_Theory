using ImpactTheory.Gameplay;

namespace ImpactTheory.CoreTests
{
    /// <summary>
    /// Proves the level lifecycle, ball allowance, and scoring rules.
    /// </summary>
    public static class LevelRuleTests
    {
        // ---------------------------------------------------------------- ball allowance

        [Test("a level cannot fire more balls than its allowance")]
        public static void AllowanceIsEnforced()
        {
            BallAllowance balls = new BallAllowance(3);

            Check.True(balls.RecordShot(), "shot 1 refused");
            Check.True(balls.RecordShot(), "shot 2 refused");
            Check.True(balls.RecordShot(), "shot 3 refused");
            Check.False(balls.RecordShot(), "a fourth shot was allowed against an allowance of 3");

            Check.Equal(3, balls.Used, "used");
            Check.Equal(0, balls.Remaining, "remaining");
            Check.True(balls.IsExhausted, "allowance not reported as exhausted");
        }

        [Test("resetting an allowance restores every ball")]
        public static void AllowanceResets()
        {
            BallAllowance balls = new BallAllowance(2);
            balls.RecordShot();
            balls.Reset();

            Check.Equal(0, balls.Used, "used after reset");
            Check.Equal(2, balls.Remaining, "remaining after reset");
            Check.True(balls.CanFire, "cannot fire after reset");
        }

        // ---------------------------------------------------------------- scoring

        [Test("a failed level scores nothing")]
        public static void FailedLevelScoresZero()
        {
            // No partial credit, because there is no partial destruction. A consolation score would
            // quietly reintroduce the percentage-destruction model the specification rules out.
            ScoreResult score = new ScoreCalculator().Calculate(false, 8, 8);

            Check.Equal(0, score.Total, "failed level total");
            Check.False(score.Cleared, "cleared flag");
        }

        [Test("using fewer balls always scores higher")]
        public static void FewerBallsScoresHigher()
        {
            // The primary scoring rule from Docs/GameDesign.md section 25, asserted as a strict
            // monotonic property rather than at a couple of sample points - that is what stops a
            // future bonus from accidentally inverting it.
            ScoreCalculator calculator = new ScoreCalculator();
            int previous = int.MaxValue;

            for (int used = 1; used <= 8; used++)
            {
                int total = calculator.Calculate(true, 8, used).Total;
                Check.True(
                    total < previous,
                    $"score did not decrease when going from {used - 1} to {used} balls " +
                    $"({previous} then {total})");
                previous = total;
            }
        }

        [Test("the one-shot bonus applies only to a genuine one-ball clear")]
        public static void OneShotBonusIsExact()
        {
            ScoreCalculator calculator = new ScoreCalculator();

            Check.True(calculator.Calculate(true, 8, 1).OneShotBonus > 0, "no bonus for a one-shot clear");
            Check.Equal(0, calculator.Calculate(true, 8, 2).OneShotBonus, "bonus leaked to a two-ball clear");
        }

        [Test("difficulty scales the score without inverting the efficiency signal")]
        public static void DifficultyScalesWithoutInverting()
        {
            ScoreCalculator calculator = new ScoreCalculator();

            int easyEfficient = calculator.Calculate(true, 8, 1, 1f).Total;
            int easyWasteful = calculator.Calculate(true, 8, 8, 1f).Total;
            int hardEfficient = calculator.Calculate(true, 8, 1, 2f).Total;
            int hardWasteful = calculator.Calculate(true, 8, 8, 2f).Total;

            Check.True(hardEfficient > easyEfficient, "difficulty did not raise the score");
            Check.True(easyEfficient > easyWasteful, "efficiency signal lost at difficulty 1");
            Check.True(hardEfficient > hardWasteful, "efficiency signal lost at difficulty 2");
        }

        [Test("clearing on the very last ball still scores the base award")]
        public static void LastBallClearStillScores()
        {
            ScoreResult score = new ScoreCalculator().Calculate(true, 5, 5);

            Check.True(score.Total > 0, "a last-ball clear scored nothing");
            Check.Equal(0, score.EfficiencyBonus, "efficiency bonus with no balls left");
        }

        // ---------------------------------------------------------------- level lifecycle

        [Test("the happy path runs settling, ready, aiming, resolving, won")]
        public static void HappyPathReachesWon()
        {
            LevelStateMachine level = new LevelStateMachine();

            level.BeginLevel("REGRESSION_TOWER", 5);
            Check.Equal(LevelPhase.Settling, level.Phase, "phase after BeginLevel");

            level.StructureSettled();
            Check.Equal(LevelPhase.Ready, level.Phase, "phase after the structure settled");

            level.BeginAim();
            Check.Equal(LevelPhase.Aiming, level.Phase, "phase after BeginAim");

            Check.True(level.Fire(), "Fire refused from Aiming");
            Check.Equal(LevelPhase.Resolving, level.Phase, "phase after Fire");

            level.ResolveShot(true);
            Check.Equal(LevelPhase.Won, level.Phase, "phase after clearing the structure");
            Check.True(level.Score.Total > 0, "no score recorded on a win");
            Check.True(level.IsOver, "IsOver false after a win");
        }

        [Test("a missed shot returns the level to ready with a ball spent")]
        public static void MissReturnsToReady()
        {
            LevelStateMachine level = new LevelStateMachine();
            level.BeginLevel("L", 3);
            level.StructureSettled();

            level.Fire();
            level.ResolveShot(false);

            Check.Equal(LevelPhase.Ready, level.Phase, "phase after a miss");
            Check.Equal(1, level.Balls.Used, "balls used after a miss");
            Check.Equal(2, level.Balls.Remaining, "balls remaining after a miss");
        }

        [Test("firing the last ball does not fail the level until the shot resolves")]
        public static void LastBallDoesNotFailUntilResolved()
        {
            // The drama of the final shot, and an explicit requirement: Docs/GameDesign.md section
            // 23 fails the level only "if the structure remains after the final allowed shot
            // resolves". A state machine that failed on Fire would cut the last collapse short.
            LevelStateMachine level = new LevelStateMachine();
            level.BeginLevel("L", 1);
            level.StructureSettled();

            level.Fire();

            Check.True(level.Balls.IsExhausted, "fixture error: the allowance should be spent");
            Check.Equal(LevelPhase.Resolving, level.Phase, "the level failed before the shot resolved");
            Check.False(level.IsOver, "the level ended while the ball was still in flight");
        }

        [Test("the last ball can still win after the allowance is exhausted")]
        public static void LastBallCanStillWin()
        {
            LevelStateMachine level = new LevelStateMachine();
            level.BeginLevel("L", 1);
            level.StructureSettled();
            level.Fire();

            level.ResolveShot(true);

            Check.Equal(LevelPhase.Won, level.Phase, "a clearing final shot did not win");
            Check.True(level.Score.OneShotBonus > 0, "no one-shot bonus for a single-ball clear");
        }

        [Test("the level fails when the structure survives the final resolved shot")]
        public static void StructureSurvivingFinalShotFails()
        {
            LevelStateMachine level = new LevelStateMachine();
            level.BeginLevel("L", 2);
            level.StructureSettled();

            level.Fire();
            level.ResolveShot(false);
            level.Fire();
            level.ResolveShot(false);

            Check.Equal(LevelPhase.Failed, level.Phase, "phase after the final shot missed");
            Check.Equal(0, level.Score.Total, "a failed level scored something");
            Check.True(level.IsOver, "IsOver false after a failure");
        }

        [Test("firing is refused while a shot is still resolving")]
        public static void CannotFireWhileResolving()
        {
            LevelStateMachine level = new LevelStateMachine();
            level.BeginLevel("L", 5);
            level.StructureSettled();

            level.Fire();
            Check.False(level.Fire(), "a second ball was fired while the first was resolving");
            Check.Equal(1, level.Balls.Used, "an extra ball was consumed");
        }

        [Test("firing is refused once the level is over")]
        public static void CannotFireAfterTheLevelEnds()
        {
            LevelStateMachine level = new LevelStateMachine();
            level.BeginLevel("L", 5);
            level.StructureSettled();
            level.Fire();
            level.ResolveShot(true);

            Check.False(level.Fire(), "a ball was fired after winning");
        }

        [Test("restarting returns the level to settling with a full allowance")]
        public static void RestartResetsTheLevel()
        {
            LevelStateMachine level = new LevelStateMachine();
            level.BeginLevel("L", 4);
            level.StructureSettled();
            level.Fire();
            level.ResolveShot(false);

            level.Restart();

            Check.Equal(LevelPhase.Settling, level.Phase, "phase after restart");
            Check.Equal(0, level.Balls.Used, "balls used after restart");
            Check.Equal(4, level.Balls.Remaining, "balls remaining after restart");
            Check.Equal(0, level.Score.Total, "score survived a restart");
        }

        [Test("every phase change is announced exactly once")]
        public static void PhaseChangesAreAnnounced()
        {
            // The logging layer and the HUD both subscribe to this. A duplicated or missing event
            // shows up as a HUD that disagrees with the game.
            LevelStateMachine level = new LevelStateMachine();
            int changes = 0;
            level.PhaseChanged += (from, to) => changes++;

            level.BeginLevel("L", 2);      // Loading  -> Settling
            level.StructureSettled();      // Settling -> Ready
            level.BeginAim();              // Ready    -> Aiming
            level.CancelAim();             // Aiming   -> Ready
            level.Fire();                  // Ready    -> Resolving
            level.ResolveShot(true);       // Resolving-> Won

            Check.Equal(6, changes, "phase change count");
        }

        [Test("redundant transitions do not raise phase changes")]
        public static void RedundantTransitionsAreIgnored()
        {
            LevelStateMachine level = new LevelStateMachine();
            level.BeginLevel("L", 2);
            level.StructureSettled();

            int changes = 0;
            level.PhaseChanged += (from, to) => changes++;

            level.StructureSettled();   // already Ready
            level.CancelAim();          // not aiming
            level.ResolveShot(true);    // not resolving

            Check.Equal(0, changes, "a no-op transition raised a phase change");
            Check.Equal(LevelPhase.Ready, level.Phase, "phase drifted on a no-op transition");
        }
    }
}
