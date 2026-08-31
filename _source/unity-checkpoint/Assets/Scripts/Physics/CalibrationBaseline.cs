using System.Collections.Generic;
using System.Globalization;
using ImpactTheory.Core.Math;

namespace ImpactTheory.Physics
{
    /// <summary>Where one piece ended up, and whether the game considered it removed.</summary>
    public readonly struct PieceSnapshot
    {
        public PieceSnapshot(string pieceId, Vec3 position, Quat rotation, bool removed)
        {
            PieceId = pieceId;
            Position = position;
            Rotation = rotation;
            Removed = removed;
        }

        public string PieceId { get; }

        public Vec3 Position { get; }

        public Quat Rotation { get; }

        /// <summary>The off-platform verdict. This is the gameplay-visible outcome.</summary>
        public bool Removed { get; }
    }

    /// <summary>
    /// The recorded outcome of one calibration scenario.
    /// </summary>
    /// <remarks>
    /// Stamped with <see cref="PhysicsConfigVersion"/>, because a baseline recorded under a
    /// different physics configuration is not a baseline - it is a different experiment
    /// (Addendum 002 §3).
    /// </remarks>
    public sealed class CalibrationBaseline
    {
        private readonly List<PieceSnapshot> _pieces = new List<PieceSnapshot>();

        public CalibrationBaseline(string scenarioId, int physicsConfigVersion)
        {
            ScenarioId = scenarioId;
            PhysicsConfigVersion = physicsConfigVersion;
        }

        public string ScenarioId { get; }

        public int PhysicsConfigVersion { get; }

        /// <summary>How long the scene took to settle, seconds.</summary>
        public float SettleTime { get; set; }

        /// <summary>Whether the scenario resolved by timeout rather than by coming to rest.</summary>
        public bool TimedOut { get; set; }

        /// <summary>The exact settling decision, including what was still moving at timeout.</summary>
        public SettleReport Resolution { get; set; }

        public IReadOnlyList<PieceSnapshot> Pieces => _pieces;

        public void Add(PieceSnapshot snapshot) => _pieces.Add(snapshot);

        public PieceSnapshot? Find(string pieceId)
        {
            foreach (PieceSnapshot snapshot in _pieces)
            {
                if (snapshot.PieceId == pieceId)
                {
                    return snapshot;
                }
            }

            return null;
        }

        public override string ToString() => string.Format(
            CultureInfo.InvariantCulture,
            "{0} @ physicsConfigVersion={1}: {2} piece(s), settled in {3:0.##}s{4}",
            ScenarioId, PhysicsConfigVersion, _pieces.Count, SettleTime,
            TimedOut ? " (TIMEOUT)" : string.Empty);
    }

    /// <summary>What comparing a run against its baseline produced.</summary>
    public sealed class BaselineComparison
    {
        public bool ConfigVersionChanged { get; set; }

        /// <summary>A piece flipped between removed and not removed. Always a regression.</summary>
        public List<string> VerdictChanges { get; } = new List<string>();

        /// <summary>A piece settled outside the position tolerance.</summary>
        public List<string> PositionDrifts { get; } = new List<string>();

        /// <summary>Pieces present in one run and not the other.</summary>
        public List<string> MissingPieces { get; } = new List<string>();

        /// <summary>
        /// Passes only when no verdict changed and no piece is missing.
        /// </summary>
        /// <remarks>
        /// Position drift alone does not fail. <c>Docs/Testing.md</c> §3 is explicit that rigid-body
        /// simulation is not bit-deterministic across platforms, so exact equality would make the
        /// suite fail on a different machine for no real reason: "A tower that settles 2 cm
        /// differently is fine; a piece that flips from removed to not-removed is a regression."
        /// Drift is still reported, because a large drift is worth a human's attention even when it
        /// changes no outcome.
        /// </remarks>
        public bool Passed =>
            !ConfigVersionChanged && VerdictChanges.Count == 0 && MissingPieces.Count == 0;

        public string Describe()
        {
            if (ConfigVersionChanged)
            {
                return "BASELINE INVALID: the physics configuration changed since this baseline was " +
                       "recorded. Re-run calibration and record a new baseline deliberately - do not " +
                       "treat this as a pass.";
            }

            if (Passed && PositionDrifts.Count == 0)
            {
                return "matches baseline";
            }

            System.Text.StringBuilder report = new System.Text.StringBuilder();

            if (VerdictChanges.Count > 0)
            {
                report.AppendLine("REGRESSION - removal verdict changed:");
                foreach (string change in VerdictChanges)
                {
                    report.AppendLine("  " + change);
                }
            }

            if (MissingPieces.Count > 0)
            {
                report.AppendLine("REGRESSION - pieces missing from one side:");
                foreach (string missing in MissingPieces)
                {
                    report.AppendLine("  " + missing);
                }
            }

            if (PositionDrifts.Count > 0)
            {
                report.AppendLine("within tolerance policy, but worth a look - position drift:");
                foreach (string drift in PositionDrifts)
                {
                    report.AppendLine("  " + drift);
                }
            }

            return report.ToString().TrimEnd();
        }
    }

    /// <summary>Compares a calibration run against its recorded baseline.</summary>
    public static class CalibrationComparer
    {
        /// <summary>
        /// Default position tolerance, metres.
        /// </summary>
        /// <remarks>
        /// <strong>Documented assumption, reversible (<c>ASM-06</c>).</strong> 5 cm against 1 m
        /// pieces is about 5% of a piece. The real figure is whatever measured cross-platform
        /// variance turns out to be, which cannot be known until a Web build has actually run.
        /// </remarks>
        public const float DefaultPositionTolerance = 0.05f;

        public static BaselineComparison Compare(
            CalibrationBaseline baseline,
            CalibrationBaseline observed,
            float positionTolerance = DefaultPositionTolerance)
        {
            BaselineComparison comparison = new BaselineComparison();

            if (baseline == null || observed == null)
            {
                comparison.MissingPieces.Add("one side of the comparison is missing entirely");
                return comparison;
            }

            // Checked first and treated as fatal. A configuration change invalidates the baseline
            // by definition, and silently re-baselining is the exact failure Addendum 002 section 3
            // forbids.
            if (baseline.PhysicsConfigVersion != observed.PhysicsConfigVersion)
            {
                comparison.ConfigVersionChanged = true;
                return comparison;
            }

            foreach (PieceSnapshot expected in baseline.Pieces)
            {
                PieceSnapshot? actualOrNull = observed.Find(expected.PieceId);

                if (actualOrNull == null)
                {
                    comparison.MissingPieces.Add($"{expected.PieceId} is missing from the run");
                    continue;
                }

                PieceSnapshot actual = actualOrNull.Value;

                if (actual.Removed != expected.Removed)
                {
                    comparison.VerdictChanges.Add(
                        $"{expected.PieceId}: baseline says " +
                        $"{(expected.Removed ? "removed" : "on the platform")}, run says " +
                        $"{(actual.Removed ? "removed" : "on the platform")}");
                }

                float drift = Vec3.Distance(expected.Position, actual.Position);
                if (drift > positionTolerance)
                {
                    comparison.PositionDrifts.Add(string.Format(
                        CultureInfo.InvariantCulture,
                        "{0}: settled {1:0.###} m from the baseline position (tolerance {2:0.###} m)",
                        expected.PieceId, drift, positionTolerance));
                }
            }

            foreach (PieceSnapshot actual in observed.Pieces)
            {
                if (baseline.Find(actual.PieceId) == null)
                {
                    comparison.MissingPieces.Add(
                        $"{actual.PieceId} appeared in the run but is not in the baseline");
                }
            }

            return comparison;
        }
    }
}
