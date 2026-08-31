using System.Collections.Generic;
using ImpactTheory.Core;

namespace ImpactTheory.Gameplay
{
    /// <summary>
    /// The hand-authored structures: the permanent regression set plus the first playable levels.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The five regression structures are fixed by <c>Docs/Testing.md</c> §3, and each one isolates
    /// a distinct physical behaviour so that a regression points at a cause rather than at "physics
    /// changed". They are permanent fixtures under version control, not throwaway scenes.
    /// </para>
    /// <para>
    /// Coordinates assume the default 12 x 12 m platform with its top surface at y = 0, and
    /// centre-bottom pivots, so a piece placed at y = 0 rests on the platform and a piece placed at
    /// y = 1 rests on a 1 m block below it. <c>PieceLibraryManifestTests</c> asserts that pivot
    /// behaviour, so these numbers mean what they look like they mean.
    /// </para>
    /// </remarks>
    public static class BuiltInStructures
    {
        /// <summary>
        /// A vertical stack. Proves stacking stability, settling, and collapse propagation.
        /// </summary>
        /// <remarks>
        /// The teaching level. <c>Docs/GameDesign.md</c> §43 asks early structures to have obvious
        /// weak points, tall arrangements, narrow supports, and predictable collapses - a single
        /// column of blocks is the clearest possible statement of "hit the bottom".
        /// </remarks>
        public static StructureBlueprint SimpleTower() =>
            new StructureBlueprint("REG_SIMPLE_TOWER", "Simple Tower", 3, 0.8f)
                .Place("B01_SMALL_BLOCK", 0f, 0f, 0f, MaterialFamily.Wood)
                .Place("B01_SMALL_BLOCK", 0f, 1f, 0f, MaterialFamily.Wood)
                .Place("B01_SMALL_BLOCK", 0f, 2f, 0f, MaterialFamily.Wood)
                .Place("B01_SMALL_BLOCK", 0f, 3f, 0f, MaterialFamily.Wood)
                .Place("B01_SMALL_BLOCK", 0f, 4f, 0f, MaterialFamily.Wood);

        /// <summary>
        /// The first player-facing arrangement: a symmetrical set of orange towers displayed on
        /// the mechanical platform. The permanent Simple Tower regression remains unchanged.
        /// </summary>
        public static StructureBlueprint PlatformArray() =>
            new StructureBlueprint("LVL_PLATFORM_ARRAY", "Platform Array", 6, 0.9f)
                .Place("B05_LARGE_BLOCK", -4f, 0f, 0f, MaterialFamily.Brick)
                .Place("B01_SMALL_BLOCK", -4f, 2f, 0f, MaterialFamily.Wood)
                .Place("B04_TALL_BLOCK", -2f, 0f, 0f, MaterialFamily.Wood)
                .Place("B01_SMALL_BLOCK", -2f, 3f, 0f, MaterialFamily.Brick)
                .Place("B04_TALL_BLOCK", 0f, 0f, 0f, MaterialFamily.Wood)
                .Place("B02_MEDIUM_BLOCK", 0f, 3f, 0f, MaterialFamily.Brick)
                .Place("B04_TALL_BLOCK", 2f, 0f, 0f, MaterialFamily.Wood)
                .Place("B01_SMALL_BLOCK", 2f, 3f, 0f, MaterialFamily.Brick)
                .Place("B05_LARGE_BLOCK", 4f, 0f, 0f, MaterialFamily.Brick)
                .Place("B01_SMALL_BLOCK", 4f, 2f, 0f, MaterialFamily.Wood);

        /// <summary>
        /// Two columns carrying a beam. Proves load transfer and support relationships.
        /// </summary>
        /// <remarks>
        /// The first structure that rewards thinking. Hitting the beam moves one piece; hitting a
        /// column drops three. That is the difference between destruction and structural reasoning
        /// which <c>Docs/GameDesign.md</c> §8 says the game is actually about.
        /// </remarks>
        public static StructureBlueprint TwoColumnBeam() =>
            new StructureBlueprint("REG_TWO_COLUMN_BEAM", "Two-Column Beam", 4, 1.0f)
                .Place("S02_SHORT_COLUMN", -1.5f, 0f, 0f, MaterialFamily.Concrete)
                .Place("S02_SHORT_COLUMN", 1.5f, 0f, 0f, MaterialFamily.Concrete)
                .Place("B03_LONG_BEAM", 0f, 2f, 0f, MaterialFamily.PaintedSteel)
                .Place("B01_SMALL_BLOCK", -1f, 3f, 0f, MaterialFamily.Wood)
                .Place("B01_SMALL_BLOCK", 1f, 3f, 0f, MaterialFamily.Wood);

        /// <summary>
        /// A beam extending well past its support. Proves tipping and centre-of-mass behaviour.
        /// </summary>
        /// <remarks>
        /// Also the natural home of the partial-overhang case: the beam's far end hangs over the
        /// platform edge, so this structure exercises the off-platform rule's first condition with
        /// real physics rather than a fixture.
        /// </remarks>
        public static StructureBlueprint Cantilever() =>
            new StructureBlueprint("REG_CANTILEVER", "Cantilever", 4, 1.2f)
                .Place("S03_WIDE_FOOTING", -3f, 0f, 0f, MaterialFamily.Stone)
                .Place("S02_SHORT_COLUMN", -3f, 0.5f, 0f, MaterialFamily.Concrete)
                .Place("B03_LONG_BEAM", -1.5f, 2.5f, 0f, MaterialFamily.PaintedSteel)
                .Place("B02_MEDIUM_BLOCK", -3f, 3.5f, 0f, MaterialFamily.Brick);

        /// <summary>
        /// A structure resting on a roller. Proves rolling versus sliding and cylindrical colliders.
        /// </summary>
        /// <remarks>
        /// The roller is the piece most likely to be silently broken by a collider shortcut. If
        /// <c>A04_ROLLER</c> ever gets a box collider, this structure stops behaving and the
        /// regression is obvious rather than subtle.
        /// </remarks>
        public static StructureBlueprint RollerSupport() =>
            new StructureBlueprint("REG_ROLLER_SUPPORT", "Roller Support", 4, 1.3f)
                .Place("A04_ROLLER", -1.5f, 0.5f, 0f, MaterialFamily.Rubber)
                .Place("A04_ROLLER", 1.5f, 0.5f, 0f, MaterialFamily.Rubber)
                .Place("B03_LONG_BEAM", 0f, 1f, 0f, MaterialFamily.PaintedSteel)
                .Place("B05_LARGE_BLOCK", 0f, 2f, 0f, MaterialFamily.Concrete);

        /// <summary>
        /// Pieces at and across the platform boundary. Exercises every off-platform edge case.
        /// </summary>
        /// <remarks>
        /// The structure that proves <c>VAL-015</c> against real physics rather than against
        /// fixtures. It deliberately contains a piece already overhanging the edge and a piece
        /// leaning outward, so a wrong reading of the rule shows up as a level that completes early
        /// or never completes at all.
        /// </remarks>
        public static StructureBlueprint PlatformEdgeTest() =>
            new StructureBlueprint("REG_PLATFORM_EDGE", "Platform Edge Test", 5, 1.4f)
                .Place("B02_MEDIUM_BLOCK", 5.0f, 0f, 0f, MaterialFamily.Wood)
                .Place("B01_SMALL_BLOCK", 5.6f, 1f, 0f, MaterialFamily.Wood)
                .Place("B04_TALL_BLOCK", -4f, 0f, 2f, MaterialFamily.Brick)
                .Place("B01_SMALL_BLOCK", 0f, 0f, -4f, MaterialFamily.Wood)
                .Place("S04_WEDGE", -2f, 0f, -2f, MaterialFamily.Stone);

        /// <summary>
        /// A gate: two towers spanned by a header, with a stabiliser beneath.
        /// </summary>
        /// <remarks>
        /// The first structure that is a puzzle rather than a demonstration. It has structural
        /// redundancy - knocking one tower leaves the other standing - so clearing it inside the
        /// allowance needs the player to think about load paths, which is the intermediate design
        /// goal in <c>Docs/GameDesign.md</c> §44.
        /// </remarks>
        public static StructureBlueprint Gatehouse() =>
            new StructureBlueprint("LVL_GATEHOUSE", "Gatehouse", 5, 1.5f)

                // Footings meet at x = 0 and carry the columns. The 4 m beam spans x [-2, 2], so
                // the columns sit at +/-1.5 to land inside that span rather than at its very ends -
                // a beam balanced on the outer edge of a column is a knife-edge contact, not a
                // structure.
                .Place("S03_WIDE_FOOTING", -1.5f, 0f, 0f, MaterialFamily.Stone)
                .Place("S03_WIDE_FOOTING", 1.5f, 0f, 0f, MaterialFamily.Stone)
                .Place("S01_ROUND_COLUMN", -1.5f, 0.5f, 0f, MaterialFamily.Steel)
                .Place("S01_ROUND_COLUMN", 1.5f, 0.5f, 0f, MaterialFamily.Steel)
                .Place("B03_LONG_BEAM", 0f, 3.5f, 0f, MaterialFamily.PaintedSteel)
                .Place("B05_LARGE_BLOCK", -1f, 4.5f, 0f, MaterialFamily.Concrete)
                .Place("B05_LARGE_BLOCK", 1f, 4.5f, 0f, MaterialFamily.Concrete)

                // The stabiliser stands clear of the gate, behind it. It was originally placed at
                // the origin, where its feet intersected both footings - the structure would have
                // detonated on the first physics step. PiecesDoNotStartInsideEachOther caught it.
                .Place("A05_MECHANICAL_STABILIZER", 0f, 0f, 3f, MaterialFamily.PaintedSteel);

        /// <summary>The playable order for the prototype loop.</summary>
        public static IReadOnlyList<StructureBlueprint> Campaign() => new[]
        {
            // Lead with the readable two-pillar gatehouse. It gives the first shot a clear target
            // and a visible collapse path, which is closer to the arcade loop than the old array
            // of isolated towers.
            Gatehouse(),
            TwoColumnBeam(),
            Cantilever(),
            RollerSupport(),
            Gatehouse(),
        };

        /// <summary>The permanent regression set from <c>Docs/Testing.md</c> §3.</summary>
        public static IReadOnlyList<StructureBlueprint> Regression() => new[]
        {
            SimpleTower(),
            TwoColumnBeam(),
            Cantilever(),
            RollerSupport(),
            PlatformEdgeTest(),
        };
    }
}
