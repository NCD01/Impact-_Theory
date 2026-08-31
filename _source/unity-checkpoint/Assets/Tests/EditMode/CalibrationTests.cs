using System.Collections.Generic;
using ImpactTheory.Core.Math;
using ImpactTheory.Physics;
using ImpactTheory.Structure;

namespace ImpactTheory.CoreTests
{
    /// <summary>
    /// Proves the calibration baseline comparison, and validates the scenario catalogue.
    /// </summary>
    /// <remarks>
    /// The comparison policy is the interesting part and comes straight from
    /// <c>Docs/Testing.md</c> §3: settled positions are compared within a tolerance, because
    /// rigid-body simulation is not bit-deterministic across platforms, but the removal verdict is
    /// asserted strictly, because it is the gameplay-visible outcome.
    /// </remarks>
    public static class CalibrationTests
    {
        private static CalibrationBaseline Baseline(int configVersion = 1)
        {
            CalibrationBaseline baseline = new CalibrationBaseline("CAL_TEST", configVersion)
            {
                SettleTime = 2.4f,
            };

            baseline.Add(new PieceSnapshot("a", new Vec3(0f, 0f, 0f), Quat.Identity, false));
            baseline.Add(new PieceSnapshot("b", new Vec3(9f, -8f, 0f), Quat.Identity, true));
            return baseline;
        }

        [Test("an identical run matches its baseline", Requirement = "VAL-014")]
        public static void IdenticalRunMatches()
        {
            BaselineComparison result = CalibrationComparer.Compare(Baseline(), Baseline());

            Check.True(result.Passed, "an identical run did not match: " + result.Describe());
            Check.Equal(0, result.PositionDrifts.Count, "position drifts");
        }

        [Test("small settling differences do not fail the comparison", Requirement = "VAL-014")]
        public static void SmallDriftIsTolerated()
        {
            // Rigid-body simulation is not bit-deterministic across platforms. Exact equality would
            // fail on a different machine for no real reason, which would make the suite noise.
            CalibrationBaseline observed = new CalibrationBaseline("CAL_TEST", 1);
            observed.Add(new PieceSnapshot("a", new Vec3(0.02f, 0f, 0.01f), Quat.Identity, false));
            observed.Add(new PieceSnapshot("b", new Vec3(9.03f, -8f, 0f), Quat.Identity, true));

            BaselineComparison result = CalibrationComparer.Compare(Baseline(), observed);

            Check.True(result.Passed, "a 3 cm drift failed the comparison: " + result.Describe());
        }

        [Test("large drift is reported even when it changes no outcome", Requirement = "VAL-014")]
        public static void LargeDriftIsReported()
        {
            CalibrationBaseline observed = new CalibrationBaseline("CAL_TEST", 1);
            observed.Add(new PieceSnapshot("a", new Vec3(1.5f, 0f, 0f), Quat.Identity, false));
            observed.Add(new PieceSnapshot("b", new Vec3(9f, -8f, 0f), Quat.Identity, true));

            BaselineComparison result = CalibrationComparer.Compare(Baseline(), observed);

            Check.True(result.Passed, "drift alone should not fail the comparison");
            Check.Equal(1, result.PositionDrifts.Count, "drift report count");
            Check.True(
                result.Describe().Contains("worth a look"),
                "a 1.5 m drift was not surfaced to a human at all");
        }

        [Test("a changed removal verdict is always a regression", Requirement = "VAL-014")]
        public static void VerdictChangeFails()
        {
            // The strict half of the policy. A piece that flips between removed and not removed has
            // changed the outcome of the level, however small the positional difference was.
            CalibrationBaseline observed = new CalibrationBaseline("CAL_TEST", 1);
            observed.Add(new PieceSnapshot("a", new Vec3(0f, 0f, 0f), Quat.Identity, true));
            observed.Add(new PieceSnapshot("b", new Vec3(9f, -8f, 0f), Quat.Identity, true));

            BaselineComparison result = CalibrationComparer.Compare(Baseline(), observed);

            Check.False(result.Passed, "a flipped removal verdict passed");
            Check.Equal(1, result.VerdictChanges.Count, "verdict change count");
            Check.True(result.Describe().Contains("REGRESSION"), "the report does not say regression");
        }

        [Test("a baseline from a different physics configuration is refused, not compared",
            Requirement = "VAL-014")]
        public static void ConfigVersionChangeInvalidatesBaseline()
        {
            // Addendum 002 section 3: a physics configuration change invalidates every recorded
            // result by definition. Quietly comparing across versions - or quietly re-baselining -
            // is the failure this guards against.
            BaselineComparison result = CalibrationComparer.Compare(Baseline(1), Baseline(2));

            Check.False(result.Passed, "a cross-version comparison passed");
            Check.True(result.ConfigVersionChanged, "the version change was not flagged");
            Check.True(
                result.Describe().Contains("BASELINE INVALID"),
                "the report does not make the invalidation unmissable: " + result.Describe());
        }

        [Test("a missing or extra piece fails the comparison", Requirement = "VAL-014")]
        public static void PieceCountMismatchFails()
        {
            CalibrationBaseline missing = new CalibrationBaseline("CAL_TEST", 1);
            missing.Add(new PieceSnapshot("a", new Vec3(0f, 0f, 0f), Quat.Identity, false));

            BaselineComparison dropped = CalibrationComparer.Compare(Baseline(), missing);
            Check.False(dropped.Passed, "a run that lost a piece passed");

            CalibrationBaseline extra = Baseline();
            extra.Add(new PieceSnapshot("c", Vec3.Zero, Quat.Identity, false));

            BaselineComparison gained = CalibrationComparer.Compare(Baseline(), extra);
            Check.False(gained.Passed, "a run that gained a piece passed");
        }

        // ---------------------------------------------------------------- scenario catalogue

        [Test("every calibration scenario references pieces that exist", Requirement = "VAL-014")]
        public static void ScenariosReferenceRealPieces()
        {
            foreach (CalibrationScenario scenario in CalibrationScenario.All())
            {
                Check.True(scenario.Pieces.Count > 0, $"{scenario.Id} places no pieces");

                foreach (CalibrationPiece piece in scenario.Pieces)
                {
                    Check.True(
                        PieceLibrary.Get(piece.DefinitionId) != null,
                        $"{scenario.Id} references unknown piece {piece.DefinitionId}");
                }
            }
        }

        [Test("every calibration scenario states what it expects to see", Requirement = "VAL-014")]
        public static void ScenariosDeclareExpectations()
        {
            // Docs/GameDesign.md section 17: "Record expected behaviour. This becomes a
            // regression-testing environment." A scenario with no stated expectation cannot be
            // judged wrong by a human, only by a diff.
            foreach (CalibrationScenario scenario in CalibrationScenario.All())
            {
                Check.True(
                    scenario.ExpectedBehaviour.Length > 30,
                    $"{scenario.Id} has no meaningful expected-behaviour description");
            }
        }

        [Test("the calibration set covers every behaviour the specification lists",
            Requirement = "VAL-014")]
        public static void ScenariosCoverTheRequiredBehaviours()
        {
            // Docs/GameDesign.md section 17 and Docs/Physics.md section 11 between them require
            // launch, impact, momentum transfer, sliding, tipping, falling, rotation, rolling,
            // stacked collapse, and settling. Missing one is a hole in the regression environment.
            HashSet<CalibrationBehaviour> covered = new HashSet<CalibrationBehaviour>();

            foreach (CalibrationScenario scenario in CalibrationScenario.All())
            {
                covered.Add(scenario.Behaviour);
            }

            CalibrationBehaviour[] required =
            {
                CalibrationBehaviour.Settling,
                CalibrationBehaviour.Impact,
                CalibrationBehaviour.MomentumTransfer,
                CalibrationBehaviour.Sliding,
                CalibrationBehaviour.Tipping,
                CalibrationBehaviour.Rolling,
                CalibrationBehaviour.StackedCollapse,
                CalibrationBehaviour.PlatformEdge,
            };

            foreach (CalibrationBehaviour behaviour in required)
            {
                Check.True(covered.Contains(behaviour), $"no scenario exercises {behaviour}");
            }
        }

        [Test("scenarios that fire a ball give it a real velocity", Requirement = "VAL-014")]
        public static void ShotScenariosHaveVelocity()
        {
            foreach (CalibrationScenario scenario in CalibrationScenario.All())
            {
                if (!scenario.FiresBall)
                {
                    continue;
                }

                Check.True(
                    scenario.ShotVelocity.Magnitude > 1f,
                    $"{scenario.Id} fires a ball with almost no velocity");
            }
        }

        [Test("the sliding and tipping scenarios differ only in where the ball strikes",
            Requirement = "VAL-014")]
        public static void SlidingAndTippingAreAContrastPair()
        {
            // These two exist as a pair on purpose. The game's central idea is that where you hit
            // decides what happens, and if both scenarios struck at the same height they would
            // prove nothing about it.
            CalibrationScenario sliding = null;
            CalibrationScenario tipping = null;

            foreach (CalibrationScenario scenario in CalibrationScenario.All())
            {
                if (scenario.Id == "CAL_03_SLIDING")
                {
                    sliding = scenario;
                }

                if (scenario.Id == "CAL_04_TIPPING")
                {
                    tipping = scenario;
                }
            }

            Check.True(sliding != null && tipping != null, "the contrast pair is missing");
            Check.True(
                tipping.ShotOrigin.Y > sliding.ShotOrigin.Y + 1f,
                "the tipping shot is not meaningfully higher than the sliding shot");
        }
    }
}
