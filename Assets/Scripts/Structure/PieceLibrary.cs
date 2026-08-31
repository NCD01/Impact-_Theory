using System.Collections.Generic;
using ImpactTheory.Core;
using ImpactTheory.Core.Math;

namespace ImpactTheory.Structure
{
    /// <summary>
    /// The approved V1 structural piece library: 15 pieces across three categories.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Docs/GameDesign.md</c> §26 fixes the library at roughly 12-15 standardised pieces and
    /// forbids the generator from inventing geometry during normal gameplay. This is that library.
    /// </para>
    /// <para>
    /// <strong>Where each number comes from.</strong> Dimensions and pivots are the manifest's
    /// (<c>Assets/Art/Blocks/block_asset_manifest.json</c>), and
    /// <c>PieceLibraryManifestTests</c> fails the build if they ever disagree. Solid volumes and
    /// collider layouts are derived analytically from
    /// <c>Assets/Art/Blocks/Source/generate_v1_blocks.py</c>, which is the authoritative record of
    /// what was actually modelled - an arch's opening and a roller's curvature are visible there
    /// and are not visible in a bounding box.
    /// </para>
    /// <para>
    /// Default materials follow the V2 art pass so that a default structure looks intentional, but
    /// they are only defaults. Geometry and material stay independent (<c>Docs/GameDesign.md</c>
    /// §30) and any piece can be built from any family.
    /// </para>
    /// </remarks>
    public static class PieceLibrary
    {
        // Every V1 piece is 1 SU deep, so the collider half-depth is always this.
        private const float HalfDepth = 0.5f;

        private static Dictionary<string, PieceDefinition> _byId;

        public static IReadOnlyList<string> Ids => new[]
        {
            "B01_SMALL_BLOCK", "B02_MEDIUM_BLOCK", "B03_LONG_BEAM", "B04_TALL_BLOCK",
            "B05_LARGE_BLOCK", "S01_ROUND_COLUMN", "S02_SHORT_COLUMN", "S03_WIDE_FOOTING",
            "S04_WEDGE", "S05_ARCH", "A01_T_BLOCK", "A02_L_BLOCK", "A03_CROSS_BEAM",
            "A04_ROLLER", "A05_MECHANICAL_STABILIZER",
        };

        /// <summary>Every definition, keyed by id.</summary>
        public static IReadOnlyDictionary<string, PieceDefinition> All
        {
            get
            {
                if (_byId == null)
                {
                    _byId = Build();
                }

                return _byId;
            }
        }

        public static PieceDefinition Get(string id) =>
            All.TryGetValue(id, out PieceDefinition definition) ? definition : null;

        private static Dictionary<string, PieceDefinition> Build()
        {
            Dictionary<string, PieceDefinition> pieces = new Dictionary<string, PieceDefinition>();

            void Add(PieceDefinition definition) => pieces[definition.Id] = definition;

            // ---------------------------------------------------------------- basic
            // Solid rectangular blocks. Volume is width x height x depth exactly, and one box
            // collider is both the simplest and the most accurate representation.

            Add(SolidBox("B01_SMALL_BLOCK", "Small Block", PieceCategory.Basic,
                1f, 1f, MaterialFamily.Wood, generatorWeight: 1.4f, difficultyWeight: 0.6f));

            Add(SolidBox("B02_MEDIUM_BLOCK", "Medium Block", PieceCategory.Basic,
                2f, 1f, MaterialFamily.Wood, generatorWeight: 1.3f, difficultyWeight: 0.8f));

            Add(SolidBox("B03_LONG_BEAM", "Long Beam", PieceCategory.Basic,
                4f, 1f, MaterialFamily.PaintedSteel, generatorWeight: 1.0f, difficultyWeight: 1.2f));

            Add(SolidBox("B04_TALL_BLOCK", "Tall Block", PieceCategory.Basic,
                1f, 3f, MaterialFamily.Brick, generatorWeight: 1.1f, difficultyWeight: 1.0f));

            Add(SolidBox("B05_LARGE_BLOCK", "Large Block", PieceCategory.Basic,
                2f, 2f, MaterialFamily.Concrete, generatorWeight: 1.0f, difficultyWeight: 1.1f));

            // ---------------------------------------------------------------- support

            // A vertical cylinder, diameter 1 m and height 3 m. Volume is pi*r^2*h = 2.356 m3,
            // noticeably less than the 3 m3 its bounding box suggests.
            Add(new PieceDefinition(
                "S01_ROUND_COLUMN", "Round Column", PieceCategory.Support,
                1f, 3f, 1f, 2.35619f, PivotKind.CenterBottom, MaterialFamily.Steel,
                new[]
                {
                    ColliderPart.Cylinder(
                        new Vec3(0f, 1.5f, 0f), new Vec3(0.5f, 1.5f, 0.5f), CylinderAxis.Y),
                },
                "S01_ROUND_COLUMN.fbx", 1.2f, 1.3f));

            Add(SolidBox("S02_SHORT_COLUMN", "Short Column", PieceCategory.Support,
                1f, 2f, MaterialFamily.Concrete, generatorWeight: 1.2f, difficultyWeight: 0.9f));

            Add(SolidBox("S03_WIDE_FOOTING", "Wide Footing", PieceCategory.Support,
                3f, 0.5f, MaterialFamily.Stone, generatorWeight: 1.1f, difficultyWeight: 0.7f));

            // A triangular prism: the profile is a right triangle across the full 2 x 1 base, so
            // the volume is half the bounding box. The footprint is still the full base rectangle,
            // which is why a single wedge collider is correct here.
            Add(new PieceDefinition(
                "S04_WEDGE", "Wedge", PieceCategory.Support,
                2f, 1f, 1f, 1.0f, PivotKind.CenterBottom, MaterialFamily.Stone,
                new[]
                {
                    ColliderPart.Wedge(new Vec3(0f, 0.5f, 0f), new Vec3(1f, 0.5f, HalfDepth)),
                },
                "S04_WEDGE.fbx", 0.8f, 1.1f));

            // Two legs and a span over a 1 x 1 m opening. 3 x 2 x 1 m bounding, but 5 m3 of
            // material rather than 6 - and three collider parts rather than one, so the opening
            // stays open to both physics and the footprint test.
            Add(new PieceDefinition(
                "S05_ARCH", "Arch", PieceCategory.Support,
                3f, 2f, 1f, 5.0f, PivotKind.CenterBottom, MaterialFamily.Brick,
                new[]
                {
                    ColliderPart.Box(new Vec3(-1f, 1f, 0f), new Vec3(0.5f, 1f, HalfDepth)),
                    ColliderPart.Box(new Vec3(1f, 1f, 0f), new Vec3(0.5f, 1f, HalfDepth)),
                    ColliderPart.Box(new Vec3(0f, 1.5f, 0f), new Vec3(0.5f, 0.5f, HalfDepth)),
                },
                "S05_ARCH.fbx", 0.7f, 1.5f));

            // ---------------------------------------------------------------- advanced

            // Stem 1 x 1 plus a 3 x 1 head. 4 m3.
            Add(new PieceDefinition(
                "A01_T_BLOCK", "T-Block", PieceCategory.Advanced,
                3f, 2f, 1f, 4.0f, PivotKind.CenterBottom, MaterialFamily.PaintedSteel,
                new[]
                {
                    ColliderPart.Box(new Vec3(0f, 0.5f, 0f), new Vec3(0.5f, 0.5f, HalfDepth)),
                    ColliderPart.Box(new Vec3(0f, 1.5f, 0f), new Vec3(1.5f, 0.5f, HalfDepth)),
                },
                "A01_T_BLOCK.fbx", 0.8f, 1.4f));

            // A 2 x 1 base with a 1 x 1 upright on its left. 3 m3.
            Add(new PieceDefinition(
                "A02_L_BLOCK", "L-Block", PieceCategory.Advanced,
                2f, 2f, 1f, 3.0f, PivotKind.CenterBottom, MaterialFamily.PaintedSteel,
                new[]
                {
                    ColliderPart.Box(new Vec3(0f, 0.5f, 0f), new Vec3(1f, 0.5f, HalfDepth)),
                    ColliderPart.Box(new Vec3(-0.5f, 1.5f, 0f), new Vec3(0.5f, 0.5f, HalfDepth)),
                },
                "A02_L_BLOCK.fbx", 0.9f, 1.3f));

            // A plus shape on a geometric-centre pivot. The two bars overlap in the middle 1 m
            // cube, so the material volume is 3 + 3 - 1 = 5 m3, not 6.
            Add(new PieceDefinition(
                "A03_CROSS_BEAM", "Cross Beam", PieceCategory.Advanced,
                3f, 3f, 1f, 5.0f, PivotKind.GeometricCenter, MaterialFamily.Steel,
                new[]
                {
                    ColliderPart.Box(Vec3.Zero, new Vec3(1.5f, 0.5f, HalfDepth)),
                    ColliderPart.Box(Vec3.Zero, new Vec3(0.5f, 1.5f, HalfDepth)),
                },
                "A03_CROSS_BEAM.fbx", 0.6f, 1.6f));

            // A cylinder lying on its side, 1 m diameter and 2 m long, on a geometric-centre pivot.
            // This piece exists to roll, so its collider must never be a box (Addendum 003 section 7).
            Add(new PieceDefinition(
                "A04_ROLLER", "Roller", PieceCategory.Advanced,
                2f, 1f, 1f, 1.57080f, PivotKind.GeometricCenter, MaterialFamily.Rubber,
                new[]
                {
                    ColliderPart.Cylinder(Vec3.Zero, new Vec3(1f, 0.5f, 0.5f), CylinderAxis.X),
                },
                "A04_ROLLER.fbx", 0.7f, 1.8f));

            // A braced frame: header, two uprights, two feet, and two diagonal braces. The pistons
            // and bolts in the art are visual detail and are deliberately left out of the collider -
            // they carry almost no volume and would cost contact pairs for nothing.
            //
            // Volume is the sum of the modelled members, about 2.40 m3. Members intersect slightly
            // at their joints, so this is a small overestimate rather than an exact integral; it is
            // well inside the tolerance that matters for mass.
            Add(new PieceDefinition(
                "A05_MECHANICAL_STABILIZER", "Mechanical Stabilizer", PieceCategory.Advanced,
                3f, 2f, 1f, 2.40f, PivotKind.CenterBottom, MaterialFamily.PaintedSteel,
                new[]
                {
                    // Header across the top.
                    ColliderPart.Box(new Vec3(0f, 1.825f, 0f), new Vec3(1.5f, 0.175f, 0.46f)),

                    // Uprights.
                    ColliderPart.Box(new Vec3(-1.15f, 0.875f, 0f), new Vec3(0.17f, 0.775f, 0.39f)),
                    ColliderPart.Box(new Vec3(1.15f, 0.875f, 0f), new Vec3(0.17f, 0.775f, 0.39f)),

                    // Feet - wider than the uprights, which is what makes this piece stand.
                    ColliderPart.Box(new Vec3(-1.15f, 0.1f, 0f), new Vec3(0.35f, 0.1f, 0.5f)),
                    ColliderPart.Box(new Vec3(1.15f, 0.1f, 0f), new Vec3(0.35f, 0.1f, 0.5f)),

                    // Diagonal braces, rotated about Z to match the modelled angles.
                    ColliderPart.RotatedBox(
                        new Vec3(-0.69f, 1.05f, 0f), new Vec3(0.6637f, 0.09f, 0.25f), 59.19f),
                    ColliderPart.RotatedBox(
                        new Vec3(0.69f, 1.05f, 0f), new Vec3(0.6637f, 0.09f, 0.25f), 120.81f),
                },
                "A05_MECHANICAL_STABILIZER.fbx", 0.5f, 2.0f));

            return pieces;
        }

        /// <summary>A solid rectangular piece: one box collider, volume equal to the bounding box.</summary>
        private static PieceDefinition SolidBox(
            string id,
            string displayName,
            PieceCategory category,
            float width,
            float height,
            MaterialFamily material,
            float generatorWeight,
            float difficultyWeight)
        {
            const float depth = 1f;

            ColliderPart body = ColliderPart.Box(
                new Vec3(0f, height * 0.5f, 0f),
                new Vec3(width * 0.5f, height * 0.5f, HalfDepth));

            return new PieceDefinition(
                id, displayName, category,
                width, height, depth,
                width * height * depth,
                PivotKind.CenterBottom,
                material,
                new[] { body },
                id + ".fbx",
                generatorWeight,
                difficultyWeight);
        }
    }
}
