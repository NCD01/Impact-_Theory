using System.Collections.Generic;
using ImpactTheory.Core.Math;
using ImpactTheory.Core;

namespace ImpactTheory.Physics
{
    /// <summary>
    /// Every tunable physical value in Impact Theory, in one place.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Docs/Physics.md</c> §10 requires centralised tuning and gives two reasons it is not
    /// optional: <c>VAL-014</c> compares behaviour against a recorded baseline, which only means
    /// something if the inputs can be enumerated; and <see cref="PhysicsConfigVersion"/> has to
    /// refer to something specific.
    /// </para>
    /// <para>
    /// <strong>Changing anything here is a gameplay change.</strong> It must be documented, tested,
    /// compared against baseline, and committed (<c>Docs/GameDesign.md</c> §18), and it invalidates
    /// every previously recorded difficulty and stability result by definition.
    /// </para>
    /// </remarks>
    public sealed class PhysicsConfig
    {
        public PhysicsConfig()
        {
            Materials = MaterialPhysics.CreateDefaultTable();
        }

        /// <summary>
        /// Identifies this exact set of values.
        /// </summary>
        /// <remarks>
        /// Bump it whenever any value in this object changes (<c>TODO-004</c>, Addendum 002 §3).
        /// Every calibration record, regression baseline, and generated-structure record carries
        /// this number, so a stale baseline can be recognised as stale rather than silently trusted.
        /// </remarks>
        public int PhysicsConfigVersion { get; set; } = 1;

        /// <summary>Gravity, m/s². Fixed by <c>Docs/Physics.md</c> §2.</summary>
        public Vec3 Gravity { get; set; } = new Vec3(0f, -9.81f, 0f);

        /// <summary>
        /// Physics step, seconds.
        /// </summary>
        /// <remarks>
        /// <para>
        /// <strong>Starting value, pending calibration (<c>TODO-003</c>).</strong>
        /// <c>Docs/Physics.md</c> §3 is explicit that this must be chosen from the calibration scene
        /// on a Web build, not from theory, and it is not yet possible to do that - no Unity editor
        /// is installed (<c>ISSUE-001</c>).
        /// </para>
        /// <para>
        /// 0.01 s (100 Hz) is the starting point rather than Unity's 0.02 s default, for a reason
        /// specific to this game. <see cref="BallMaxLaunchSpeed"/> is 30 m/s and
        /// <see cref="BallRadius"/> is 0.20 m, so at 0.02 s the ball advances 0.6 m per step -
        /// one and a half times its own diameter, which is the classic tunnelling setup. At 0.01 s
        /// it advances 0.3 m, and continuous collision detection on the ball covers the rest.
        /// Tall stacks also settle more cleanly at 100 Hz.
        /// </para>
        /// <para>
        /// The cost is real and lands on the weakest target: a browser. If the Web performance
        /// sweep (<c>VAL-016</c>) shows 100 Hz is unaffordable at the piece counts the game needs,
        /// the honest fix is to lower this and re-record the baseline, not to pretend it was free.
        /// </para>
        /// </remarks>
        public float FixedTimestep { get; set; } = 0.01f;

        /// <summary>
        /// Rigid-body solver position iterations.
        /// </summary>
        /// <remarks>
        /// Above Unity's default of 6. Stacked-block stability is the core visual of this game, and
        /// solver iterations buy that more cheaply than a smaller timestep does.
        /// </remarks>
        public int SolverIterations { get; set; } = 12;

        /// <summary>Rigid-body solver velocity iterations.</summary>
        public int SolverVelocityIterations { get; set; } = 4;

        // ------------------------------------------------------------------ settling

        /// <summary>Linear speed below which a body counts as still, m/s.</summary>
        public float SettleLinearThreshold { get; set; } = 0.05f;

        /// <summary>Angular speed below which a body counts as still, rad/s.</summary>
        public float SettleAngularThreshold { get; set; } = 0.1f;

        /// <summary>How long a body must stay below both thresholds before it counts as settled, s.</summary>
        public float SettleDwellTime { get; set; } = 0.5f;

        /// <summary>
        /// Hard cap on waiting for a shot to resolve, s.
        /// </summary>
        /// <remarks>
        /// Needed because some states never settle. A cylinder can roll on a flat surface for a
        /// very long time, and a piece balanced on an edge can micro-oscillate indefinitely. The
        /// shot has to resolve either way, so the timeout is a correctness requirement rather than
        /// a safety net.
        /// </remarks>
        public float SettleTimeout { get; set; } = 10f;

        // ------------------------------------------------------------------ ball

        /// <summary>
        /// <c>BALL_STANDARD</c> radius, m.
        /// </summary>
        /// <remarks>
        /// A 0.4 m sphere. Large enough to read clearly against 1 m structural pieces at gameplay
        /// camera distance, small enough that where it strikes is a meaningful choice rather than a
        /// broad smear across three pieces.
        /// </remarks>
        public float BallRadius { get; set; } = 0.20f;

        /// <summary>
        /// <c>BALL_STANDARD</c> mass, kg.
        /// </summary>
        /// <remarks>
        /// Solid steel at 7850 kg/m³ across a 0.20 m sphere works out to 263 kg, and that is where
        /// this value comes from - it is an honest solid steel ball, not a tuned number wearing a
        /// physical costume. Kept as an explicit field rather than derived at runtime so that
        /// calibration can move it without implying the ball changed material.
        /// </remarks>
        public float BallMass { get; set; } = 263f;

        /// <summary>Maximum launch speed, m/s.</summary>
        public float BallMaxLaunchSpeed { get; set; } = 30f;

        /// <summary>Minimum launch speed, m/s. A zero-power shot would waste a ball for nothing.</summary>
        public float BallMinLaunchSpeed { get; set; } = 6f;

        /// <summary>Physics material family used for the standard ball.</summary>
        public MaterialFamily BallMaterial { get; set; } = MaterialFamily.Steel;

        /// <summary>
        /// How far a ball may travel from the platform before it is written off, m.
        /// </summary>
        /// <remarks>
        /// A miss that sails past the structure would otherwise keep the shot unresolved until the
        /// settle timeout, which reads as the game having frozen.
        /// </remarks>
        public float BallDespawnDistance { get; set; } = 120f;

        // ------------------------------------------------------------------ world

        /// <summary>
        /// World Y below which anything is considered gone for good, m.
        /// </summary>
        /// <remarks>
        /// Pieces that fall off the platform land on ground at y = -8 in the gameplay scene. This
        /// sits well below that, so it only catches genuine escapes.
        /// </remarks>
        public float KillPlaneY { get; set; } = -60f;

        /// <summary>Friction and restitution per material family.</summary>
        public IReadOnlyDictionary<MaterialFamily, MaterialPhysics> Materials { get; }

        public MaterialPhysics GetMaterial(MaterialFamily family) =>
            Materials.TryGetValue(family, out MaterialPhysics material)
                ? material
                : Materials[MaterialFamily.Wood];

        /// <summary>The settling rule, packaged for <see cref="SettleTracker"/>.</summary>
        public SettleSettings GetSettleSettings() => new SettleSettings(
            SettleLinearThreshold, SettleAngularThreshold, SettleDwellTime, SettleTimeout);

        /// <summary>
        /// A single line identifying this configuration, for log records.
        /// </summary>
        /// <remarks>
        /// <c>Docs/Logging.md</c> §3 requires physics records to carry
        /// <c>physicsConfigVersion</c>, because a logged failure that cannot be tied to a
        /// configuration cannot be reconstructed.
        /// </remarks>
        public string Describe() =>
            $"physicsConfigVersion={PhysicsConfigVersion} gravity={Gravity.Y:0.##} " +
            $"timestep={FixedTimestep:0.####} solver={SolverIterations}/{SolverVelocityIterations} " +
            $"settle(lin={SettleLinearThreshold:0.###} ang={SettleAngularThreshold:0.###} " +
            $"dwell={SettleDwellTime:0.##} timeout={SettleTimeout:0.#})";
    }
}
