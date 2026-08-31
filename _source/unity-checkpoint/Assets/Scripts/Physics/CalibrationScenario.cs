using System.Collections.Generic;
using ImpactTheory.Core;
using ImpactTheory.Core.Math;

namespace ImpactTheory.Physics
{
    /// <summary>One piece placed in a calibration scenario.</summary>
    public readonly struct CalibrationPiece
    {
        public CalibrationPiece(string definitionId, Vec3 position, Quat rotation, MaterialFamily material)
        {
            DefinitionId = definitionId;
            Position = position;
            Rotation = rotation;
            Material = material;
        }

        public string DefinitionId { get; }

        public Vec3 Position { get; }

        public Quat Rotation { get; }

        public MaterialFamily Material { get; }
    }

    /// <summary>The behaviour a scenario is designed to exercise.</summary>
    public enum CalibrationBehaviour
    {
        Settling = 0,
        Impact = 1,
        MomentumTransfer = 2,
        Sliding = 3,
        Tipping = 4,
        Falling = 5,
        Rotation = 6,
        Rolling = 7,
        StackedCollapse = 8,
        PlatformEdge = 9,
    }

    /// <summary>
    /// One repeatable physics experiment.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Docs/Physics.md</c> §17 and §11 require a permanent calibration environment that exercises
    /// known scenarios and records their expected behaviour, so that it becomes a regression
    /// environment rather than a one-off sanity check. Every scenario here is data, so it can be
    /// replayed identically after any physics configuration change.
    /// </para>
    /// <para>
    /// Each carries the exact shot that produces it - direction, speed, origin - because a
    /// calibration result that cannot be reproduced is an anecdote. Together with
    /// <c>PhysicsConfigVersion</c>, a scenario id and its recorded snapshot are enough to reconstruct
    /// the run (Addendum 001 §14).
    /// </para>
    /// </remarks>
    public sealed class CalibrationScenario
    {
        private readonly List<CalibrationPiece> _pieces = new List<CalibrationPiece>();

        public CalibrationScenario(string id, string description, CalibrationBehaviour behaviour)
        {
            Id = id;
            Description = description;
            Behaviour = behaviour;
        }

        public string Id { get; }

        public string Description { get; }

        public CalibrationBehaviour Behaviour { get; }

        public IReadOnlyList<CalibrationPiece> Pieces => _pieces;

        /// <summary>Where the ball starts, if this scenario fires one.</summary>
        public Vec3 ShotOrigin { get; private set; }

        /// <summary>The launch velocity, if this scenario fires one.</summary>
        public Vec3 ShotVelocity { get; private set; }

        public bool FiresBall { get; private set; }

        /// <summary>What a human should expect to see. Recorded so a wrong result is recognisable.</summary>
        public string ExpectedBehaviour { get; private set; } = string.Empty;

        public CalibrationScenario Place(
            string definitionId,
            float x,
            float y,
            float z,
            MaterialFamily material,
            float yawDegrees = 0f,
            float pitchDegrees = 0f,
            float rollDegrees = 0f)
        {
            _pieces.Add(new CalibrationPiece(
                definitionId,
                new Vec3(x, y, z),
                Quat.FromEuler(pitchDegrees, yawDegrees, rollDegrees),
                material));

            return this;
        }

        public CalibrationScenario Shoot(Vec3 origin, Vec3 velocity)
        {
            ShotOrigin = origin;
            ShotVelocity = velocity;
            FiresBall = true;
            return this;
        }

        public CalibrationScenario Expect(string expected)
        {
            ExpectedBehaviour = expected;
            return this;
        }

        /// <summary>
        /// The permanent calibration set.
        /// </summary>
        /// <remarks>
        /// Covers the list in <c>Docs/GameDesign.md</c> §17: ball hitting a single block, block
        /// sliding, momentum transfer, tipping, cylinder rolling, beam falling, stacked collapse,
        /// friction and restitution comparison, and differing projectile velocities.
        /// </remarks>
        public static IReadOnlyList<CalibrationScenario> All()
        {
            // Start close enough that a flat shot reaches the target before gravity carries the
            // ball below it. The previous -10 m origins made most scenarios test a miss while
            // describing an impact.
            Vec3 origin = new Vec3(0f, 0.7f, -4f);

            return new[]
            {
                new CalibrationScenario(
                        "CAL_01_FREE_SETTLE",
                        "A single block dropped 2 m onto the platform, no shot.",
                        CalibrationBehaviour.Settling)
                    .Place("B01_SMALL_BLOCK", 0f, 2f, 0f, MaterialFamily.Wood)
                    .Expect("Falls, lands flat, and settles within about a second. Any bouncing or " +
                            "drift means restitution or friction is wrong."),

                new CalibrationScenario(
                        "CAL_02_DIRECT_IMPACT",
                        "Ball fired flat into a single block at 20 m/s.",
                        CalibrationBehaviour.Impact)
                    .Place("B01_SMALL_BLOCK", 0f, 0f, 0f, MaterialFamily.Wood)
                    .Shoot(origin, new Vec3(0f, 0f, 20f))
                    .Expect("The block is driven backwards and tumbles. A 263 kg ball against a " +
                            "700 kg block should move it decisively, not nudge it."),

                new CalibrationScenario(
                        "CAL_03_SLIDING",
                        "Ball fired low into a wide footing, which should slide rather than topple.",
                        CalibrationBehaviour.Sliding)
                    .Place("S03_WIDE_FOOTING", 0f, 0f, 0f, MaterialFamily.Stone)
                    .Shoot(new Vec3(0f, 0.5f, -4f), new Vec3(0f, 0f, 30f))
                    .Expect("Slides across the platform. A low, wide, heavy piece struck near its " +
                            "base should not tip - if it does, friction is too low or the centre " +
                            "of mass is wrong."),

                new CalibrationScenario(
                        "CAL_04_TIPPING",
                        "Ball fired high into a tall block, which should tip rather than slide.",
                        CalibrationBehaviour.Tipping)
                    .Place("B04_TALL_BLOCK", 0f, 0f, 0f, MaterialFamily.Brick)
                    .Shoot(new Vec3(0f, 2.5f, -4f), new Vec3(0f, 0f, 30f))
                    .Expect("Topples about its base edge. The contrast with CAL_03 is the point: " +
                            "where you hit decides what happens, which is the game's core idea."),

                new CalibrationScenario(
                        "CAL_05_ROLLING",
                        "Ball fired into a roller lying on its side.",
                        CalibrationBehaviour.Rolling)
                    .Place("A04_ROLLER", 0f, 0.5f, 0f, MaterialFamily.Rubber)
                    .Shoot(new Vec3(0f, 0.8f, -4f), new Vec3(0f, 0f, 16f))
                    .Expect("Rolls away along the platform and keeps rolling. If it slides or " +
                            "stops dead, the collider is not cylindrical and A04 has lost the " +
                            "behaviour it exists for."),

                new CalibrationScenario(
                        "CAL_06_BEAM_FALL",
                        "A long beam balanced across two short columns, struck at one column.",
                        CalibrationBehaviour.MomentumTransfer)
                    .Place("S02_SHORT_COLUMN", -1.5f, 0f, 0f, MaterialFamily.Concrete)
                    .Place("S02_SHORT_COLUMN", 1.5f, 0f, 0f, MaterialFamily.Concrete)
                    .Place("B03_LONG_BEAM", 0f, 2f, 0f, MaterialFamily.PaintedSteel)
                    .Shoot(new Vec3(-1.5f, 1.2f, -4f), new Vec3(0f, 0f, 30f))
                    .Expect("The struck column is removed and the beam drops on that side, " +
                            "rotating about the surviving column rather than falling flat."),

                new CalibrationScenario(
                        "CAL_07_STACK_COLLAPSE",
                        "A five-block tower struck at the base.",
                        CalibrationBehaviour.StackedCollapse)
                    .Place("B01_SMALL_BLOCK", 0f, 0f, 0f, MaterialFamily.Wood)
                    .Place("B01_SMALL_BLOCK", 0f, 1f, 0f, MaterialFamily.Wood)
                    .Place("B01_SMALL_BLOCK", 0f, 2f, 0f, MaterialFamily.Wood)
                    .Place("B01_SMALL_BLOCK", 0f, 3f, 0f, MaterialFamily.Wood)
                    .Place("B01_SMALL_BLOCK", 0f, 4f, 0f, MaterialFamily.Wood)
                    .Shoot(new Vec3(0f, 0.65f, -4f), new Vec3(0f, 0f, 24f))
                    .Expect("The tower collapses rather than shearing only its bottom block. " +
                            "Jitter in the standing tower before the shot means the solver " +
                            "iteration count or timestep is too low."),

                new CalibrationScenario(
                        "CAL_08_RESTITUTION",
                        "Ball dropped onto rubber and onto concrete, for comparison.",
                        CalibrationBehaviour.Impact)
                    .Place("A04_ROLLER", -2f, 0.5f, 0f, MaterialFamily.Rubber)
                    .Place("B05_LARGE_BLOCK", 2f, 0f, 0f, MaterialFamily.Concrete)
                    .Shoot(new Vec3(-2f, 6f, 0f), new Vec3(0f, -8f, 0f))
                    .Expect("A visible bounce off rubber and almost none off concrete. If they " +
                            "look the same, the physics materials are not being applied."),

                new CalibrationScenario(
                        "CAL_09_EDGE",
                        "A block placed fully past the platform edge, no shot.",
                        CalibrationBehaviour.PlatformEdge)
                    .Place("B01_SMALL_BLOCK", 6.6f, 0f, 0f, MaterialFamily.Wood)
                    .Expect("Starts fully beyond the boundary and is read as removed once settled. " +
                            "The entire footprint must cross the edge - a 90% overhang is still " +
                            "present under the fixed off-platform rule."),

                new CalibrationScenario(
                        "CAL_10_SLOW_SHOT",
                        "The same block as CAL_02, struck at minimum launch speed.",
                        CalibrationBehaviour.MomentumTransfer)
                    .Place("B01_SMALL_BLOCK", 0f, 0f, 0f, MaterialFamily.Wood)
                    // A 6 m/s flat shot cannot cover the old ten-metre gap before falling below
                    // the world. This launch is exactly 6 m/s and follows a short, shallow arc
                    // into the same block so the momentum comparison is real.
                    .Shoot(new Vec3(0f, 0.5f, -2f), new Vec3(0f, 2.398f, 5.5f))
                    .Expect("Moves the block noticeably less than CAL_02. Momentum is linear in " +
                            "speed, so roughly a third of the shot should do roughly a third of " +
                            "the work - if the two look alike, the power control is not connected."),
            };
        }
    }
}
