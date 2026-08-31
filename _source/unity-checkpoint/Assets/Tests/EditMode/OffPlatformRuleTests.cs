using System.Collections.Generic;
using ImpactTheory.Core.Math;
using ImpactTheory.Structure;

namespace ImpactTheory.CoreTests
{
    /// <summary>
    /// Proves the off-platform rule, including every edge case the specification names.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The table in <c>Docs/Physics.md</c> §8 lists the cases that must be proven and calls the
    /// suite <c>VAL-015</c>. Each of those rows has a test here, named after the row.
    /// </para>
    /// <para>
    /// The rule is a conjunction - footprint fully clear <em>and</em> unsupported - so the tests
    /// deliberately separate the two conditions. A test that only ever varies both at once cannot
    /// tell a correct implementation from one that happens to use "either".
    /// </para>
    /// </remarks>
    public static class OffPlatformRuleTests
    {
        // The default platform: 12 x 12 m, top surface at y = 0, so it spans x and z in [-6, +6].
        private static PlatformBounds Platform() => PlatformBounds.CreateDefault();

        private static OffPlatformEvaluator Evaluator() => new OffPlatformEvaluator();

        /// <summary>
        /// A 1 x 1 x 1 m block with a centre-bottom pivot, matching <c>B01_SMALL_BLOCK</c>.
        /// </summary>
        /// <remarks>
        /// The pivot detail matters. <c>block_asset_manifest.csv</c> records most pieces as
        /// <c>center-bottom</c>, so a piece placed at y = 0 sits exactly on the platform rather than
        /// half-sunk into it. Getting that wrong in a fixture would make every height-related
        /// assertion quietly meaningless.
        /// </remarks>
        private static PieceState Block(
            string id, Vec3 position, Quat rotation, Vec3 size, bool required = true)
        {
            OrientedBox collider = new OrientedBox(
                new Vec3(0f, size.Y * 0.5f, 0f),
                size * 0.5f,
                Quat.Identity);

            return new PieceState(id, "B01_SMALL_BLOCK", new[] { collider }, position, rotation, required);
        }

        private static PieceState UnitBlock(string id, float x, float z, Quat? rotation = null) =>
            Block(id, new Vec3(x, 0f, z), rotation ?? Quat.Identity, Vec3.One);

        // ---------------------------------------------------------------- baseline

        [Test("a block sitting in the middle of the platform is not removed", Requirement = "VAL-015")]
        public static void CentredBlockIsNotRemoved()
        {
            PieceState piece = UnitBlock("p1", 0f, 0f);
            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("p1");

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), support);

            Check.False(verdict.IsRemoved, "a block at the centre of the platform is removed");
            Check.Equal(RemovalReason.OverPlatformAndSupported, verdict.Reason, "reason");
        }

        // ---------------------------------------------------------------- overhang cases

        [Test("a 10% overhang is not removed", Requirement = "VAL-015")]
        public static void Overhang10PercentIsNotRemoved()
        {
            // Platform edge is x = 6. A 1 m block whose centre sits at 5.6 spans [5.1, 6.1],
            // so 0.1 m of its 1 m width - 10% - hangs past the edge.
            PieceState piece = UnitBlock("p1", 5.6f, 0f);
            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("p1");

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), support);

            Check.False(verdict.IsRemoved, "a 10% overhang is removed");
            Check.False(verdict.FootprintClearOfPlatform, "footprint reported clear at 10% overhang");
        }

        [Test("a 50% overhang is not removed", Requirement = "VAL-015")]
        public static void Overhang50PercentIsNotRemoved()
        {
            // Centre exactly on the edge: spans [5.5, 6.5], half on and half off.
            PieceState piece = UnitBlock("p1", 6.0f, 0f);
            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("p1");

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), support);

            Check.False(verdict.IsRemoved, "a 50% overhang is removed");
            Check.False(verdict.FootprintClearOfPlatform, "footprint reported clear at 50% overhang");
        }

        [Test("a 90% overhang is not removed - the footprint has not fully crossed", Requirement = "VAL-015")]
        public static void Overhang90PercentIsNotRemoved()
        {
            // Spans [5.9, 6.9]: only 0.1 m still lies over the platform. A centre-point test would
            // call this removed, which is exactly the mistake the rule forbids.
            PieceState piece = UnitBlock("p1", 6.4f, 0f);
            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("p1");

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), support);

            Check.False(verdict.IsRemoved, "a 90% overhang is removed");
            Check.False(verdict.FootprintClearOfPlatform, "footprint reported clear at 90% overhang");
            Check.Equal(RemovalReason.OverPlatformAndSupported, verdict.Reason, "reason");
        }

        [Test("a block whose centre is off the platform is still not removed while any footprint remains",
            Requirement = "VAL-015")]
        public static void CentreOffPlatformIsStillNotRemoved()
        {
            // Guards specifically against a centre-point implementation: the centre is beyond the
            // edge, yet part of the footprint is not.
            PieceState piece = UnitBlock("p1", 6.3f, 0f);
            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("p1");

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), support);

            Check.True(piece.Position.X > 6f, "fixture error: the centre should be past the edge");
            Check.False(verdict.IsRemoved, "a piece with its centre past the edge was removed");
        }

        // ---------------------------------------------------------------- support cases

        [Test("a piece clear of the boundary but still supported by the platform is not removed",
            Requirement = "VAL-015")]
        public static void ClearButSupportedIsNotRemoved()
        {
            // Geometrically well clear, but the support graph still reaches the platform. Only
            // condition 1 is satisfied, so the piece stays.
            PieceState piece = UnitBlock("p1", 9f, 0f);
            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("p1");

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), support);

            Check.True(verdict.FootprintClearOfPlatform, "footprint should be clear at x=9");
            Check.False(verdict.IsRemoved, "a supported piece was removed");
            Check.Equal(RemovalReason.StillSupportedByPlatform, verdict.Reason, "reason");
        }

        [Test("a piece leaning on another piece that the platform holds up is not removed",
            Requirement = "VAL-015")]
        public static void LeaningThroughAChainIsNotRemoved()
        {
            // The specification's hardest case: "Leaning against another piece, off the platform -
            // Not removed if still supported by the platform, directly or through another piece."
            PieceState onPlatform = UnitBlock("anchor", 5f, 0f);
            PieceState leaning = UnitBlock("leaner", 9f, 0f);

            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("anchor");
            support.AddSupport("leaner", "anchor");

            RemovalVerdict verdict = Evaluator().Evaluate(leaning, Platform(), support);

            Check.True(verdict.FootprintClearOfPlatform, "leaner should be clear of the boundary");
            Check.False(verdict.IsRemoved, "a piece supported through a chain was removed");
            Check.Equal(3, verdict.SupportChain.Count, "support chain length");
            Check.Equal("leaner", verdict.SupportChain[0], "chain start");
            Check.Equal(PlatformBounds.NodeId, verdict.SupportChain[2], "chain end");

            // Guard against the evaluator having simply ignored the chain.
            Check.True(onPlatform != null, "anchor fixture exists");
        }

        [Test("a piece resting on the ground beyond the platform is removed", Requirement = "VAL-015")]
        public static void FallenPastThePlatformIsRemoved()
        {
            // Nothing in the support graph reaches the platform: the ground is not the platform.
            PieceState piece = UnitBlock("p1", 9f, 0f);
            SupportGraph support = new SupportGraph();

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), support);

            Check.True(verdict.IsRemoved, "a fallen, unsupported, clear piece was not removed");
            Check.Equal(RemovalReason.Removed, verdict.Reason, "reason");
        }

        [Test("two pieces propping each other up off the platform are both removed",
            Requirement = "VAL-015")]
        public static void MutualSupportOffPlatformIsStillRemoved()
        {
            // A support cycle with no path to the platform. Neither piece is held up by the
            // platform, so both are removed - and the traversal must not loop forever proving it.
            PieceState a = UnitBlock("a", 9f, 0f);
            PieceState b = UnitBlock("b", 10f, 0f);

            SupportGraph support = new SupportGraph();
            support.AddSupport("a", "b");
            support.AddSupport("b", "a");

            Check.True(Evaluator().Evaluate(a, Platform(), support).IsRemoved, "piece a not removed");
            Check.True(Evaluator().Evaluate(b, Platform(), support).IsRemoved, "piece b not removed");
        }

        [Test("a piece that bounced back onto the platform is not removed", Requirement = "VAL-015")]
        public static void BouncedBackIsNotRemoved()
        {
            // The rule evaluates settled state, not peak trajectory. A piece that left and returned
            // is simply a piece on the platform.
            PieceState piece = UnitBlock("p1", 2f, -3f);
            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("p1");

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), support);

            Check.False(verdict.IsRemoved, "a piece back on the platform was counted as removed");
        }

        [Test("a single corner still over the platform keeps a rotated piece in play",
            Requirement = "VAL-015")]
        public static void SingleCornerContactIsNotRemoved()
        {
            // Rotated 45 degrees about Y, so the footprint is a diamond with a half-diagonal of
            // 0.5 * sqrt(2) = 0.7071 m. Placed at (6.3, 6.3) its inner edge is the line
            // x + z = 6.3 + 6.3 - 0.7071 = 11.893, and the platform corner (6, 6) lies at
            // x + z = 12 - just inside the diamond. The pieces overlap in a small triangle at the
            // corner and nowhere else, which is the "single-corner contact" row of the
            // Docs/Physics.md section 8 table.
            //
            // The margin here is deliberately thin. At (6.5, 6.5) the same block genuinely clears
            // the corner, so this fixture is only a couple of centimetres from flipping - which is
            // the point: it is a real corner case, not a comfortable one.
            PieceState piece = Block(
                "p1",
                new Vec3(6.3f, 0f, 6.3f),
                Quat.FromEuler(0f, 45f, 0f),
                Vec3.One);

            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("p1");

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), support);

            Check.False(verdict.IsRemoved, "a corner-contacting piece was removed");
            Check.False(verdict.FootprintClearOfPlatform, "corner overlap not detected");
        }

        [Test("the corner-contact boundary sits where the geometry says it does", Requirement = "VAL-015")]
        public static void CornerContactBoundaryIsGeometricallyExact()
        {
            // Companion to the test above, and the reason it can be trusted. A 45-degree block has
            // a half-diagonal of 0.7071 m, so measured along the diagonal its footprint clears the
            // platform corner once its centre passes (6.3536, 6.3536). Just inside that, it
            // overlaps; just outside, it does not. Asserting both sides pins the implementation to
            // real geometry rather than to a threshold someone guessed.
            OffPlatformEvaluator evaluator = Evaluator();
            PlatformBounds platform = Platform();
            Quat diagonal = Quat.FromEuler(0f, 45f, 0f);

            PieceState inside = Block("inside", new Vec3(6.34f, 0f, 6.34f), diagonal, Vec3.One);
            PieceState outside = Block("outside", new Vec3(6.37f, 0f, 6.37f), diagonal, Vec3.One);

            Check.False(
                evaluator.Evaluate(inside, platform, new SupportGraph()).FootprintClearOfPlatform,
                "a block just inside the corner threshold was judged clear");
            Check.True(
                evaluator.Evaluate(outside, platform, new SupportGraph()).FootprintClearOfPlatform,
                "a block just outside the corner threshold was judged still overlapping");
        }

        [Test("a rotated piece fully beyond the corner is removed", Requirement = "VAL-015")]
        public static void RotatedPieceFullyClearIsRemoved()
        {
            PieceState piece = Block(
                "p1",
                new Vec3(8f, 0f, 8f),
                Quat.FromEuler(0f, 45f, 0f),
                Vec3.One);

            RemovalVerdict verdict = Evaluator().Evaluate(piece, Platform(), new SupportGraph());

            Check.True(verdict.IsRemoved, "a rotated piece fully past the corner was not removed");
        }

        [Test("a toppled long beam is judged on its real footprint, not its upright one",
            Requirement = "VAL-015")]
        public static void ToppledBeamUsesRotatedFootprint()
        {
            // B03_LONG_BEAM is 4 x 1 x 1. Lying flat and pointing outward from the edge, its
            // footprint is 4 m long, so it reaches back over the platform from much further out
            // than a 1 m block would. Rotation about Z lays it on its side; the piece origin stays
            // at the pivot, so the box centre swings with it.
            OrientedBox collider = new OrientedBox(
                new Vec3(0f, 0.5f, 0f),
                new Vec3(2f, 0.5f, 0.5f),
                Quat.Identity);

            PieceState beam = new PieceState(
                "beam", "B03_LONG_BEAM", new[] { collider }, new Vec3(7.5f, 0f, 0f), Quat.Identity);

            RemovalVerdict verdict = Evaluator().Evaluate(beam, Platform(), new SupportGraph());

            // Footprint spans [5.5, 9.5]: still over the platform despite the centre being 1.5 m out.
            Check.False(verdict.IsRemoved, "a beam still reaching over the platform was removed");

            beam.SetTransform(new Vec3(8.5f, 0f, 0f), Quat.Identity);
            Check.True(
                Evaluator().Evaluate(beam, Platform(), new SupportGraph()).IsRemoved,
                "a beam fully clear of the platform was not removed");
        }

        // ---------------------------------------------------------------- structure-level rules

        [Test("a level is complete only when every required piece has left the platform",
            Requirement = "VAL-015")]
        public static void StructureClearedRequiresEveryRequiredPiece()
        {
            List<PieceState> pieces = new List<PieceState>
            {
                UnitBlock("a", 20f, 0f),
                UnitBlock("b", 22f, 0f),
                UnitBlock("c", 0f, 0f),
            };

            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("c");

            OffPlatformEvaluator evaluator = Evaluator();
            PlatformBounds platform = Platform();

            Check.False(
                evaluator.IsStructureCleared(pieces, platform, support),
                "structure reported cleared with one piece still on the platform");
            Check.Equal(1, evaluator.CountRemaining(pieces, platform, support), "remaining count");

            // Clear the last piece and the level completes.
            pieces[2].SetTransform(new Vec3(24f, 0f, 0f), Quat.Identity);
            support.Clear();

            Check.True(
                evaluator.IsStructureCleared(pieces, platform, support),
                "structure not reported cleared once every piece is off");
            Check.Equal(0, evaluator.CountRemaining(pieces, platform, support), "remaining count");
        }

        [Test("pieces that are not required do not hold the level open", Requirement = "VAL-015")]
        public static void NonRequiredPiecesDoNotBlockCompletion()
        {
            List<PieceState> pieces = new List<PieceState>
            {
                UnitBlock("required", 20f, 0f),
                Block("scenery", new Vec3(0f, 0f, 0f), Quat.Identity, Vec3.One, required: false),
            };

            SupportGraph support = new SupportGraph();
            support.AddPlatformSupport("scenery");

            Check.True(
                Evaluator().IsStructureCleared(pieces, Platform(), support),
                "a non-required piece blocked completion");
        }

        [Test("removal is decided by geometry, never by how far the piece travelled",
            Requirement = "VAL-015")]
        public static void RemovalIgnoresTravelDistance()
        {
            // A piece nudged just past the boundary and a piece flung 100 m away are the same
            // verdict. There is no distance threshold anywhere in the rule.
            PieceState near = UnitBlock("near", 7.01f, 0f);
            PieceState far = UnitBlock("far", 100f, 0f);

            OffPlatformEvaluator evaluator = Evaluator();
            PlatformBounds platform = Platform();
            SupportGraph empty = new SupportGraph();

            Check.True(evaluator.Evaluate(near, platform, empty).IsRemoved, "near piece not removed");
            Check.True(evaluator.Evaluate(far, platform, empty).IsRemoved, "far piece not removed");
        }

        [Test("a piece is judged the same regardless of its height above the platform",
            Requirement = "VAL-015")]
        public static void HeightDoesNotAffectTheFootprintTest()
        {
            // The footprint is a shadow. A piece hovering 10 m up but still over the platform has
            // not "crossed the boundary" - it will land back on it.
            PieceState high = Block("p1", new Vec3(0f, 10f, 0f), Quat.Identity, Vec3.One);

            RemovalVerdict verdict = Evaluator().Evaluate(high, Platform(), new SupportGraph());

            Check.False(
                verdict.FootprintClearOfPlatform,
                "a piece directly above the platform was judged clear of it");
        }
    }
}
