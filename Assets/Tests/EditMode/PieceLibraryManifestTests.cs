using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using ImpactTheory.Core.Math;
using ImpactTheory.Structure;
#if UNITY_EDITOR
using UnityEngine;
#endif

namespace ImpactTheory.CoreTests
{
    /// <summary>
    /// Holds <see cref="PieceLibrary"/> to the asset manifest.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Docs/Architecture.md</c> §6 is blunt about this: the authoritative dimensional source is
    /// <c>Assets/Art/Blocks/block_asset_manifest.json</c>, and dimensions must not be retyped by
    /// hand into a second place. Retyping is exactly what the library does look like, so this suite
    /// is what makes the arrangement honest - the library holds the physics and collider data the
    /// manifest does not have, and every value the manifest <em>does</em> have is checked against it
    /// on every test run.
    /// </para>
    /// <para>
    /// The manifest is itself hash-verified (<c>VAL-018</c>), so this closes the loop from bytes on
    /// disk through to the numbers gameplay actually uses.
    /// </para>
    /// </remarks>
    public static class PieceLibraryManifestTests
    {
        [DataContract]
        private sealed class ManifestDocument
        {
            [DataMember(Name = "structural_unit_meters")]
            public float structural_unit_meters;

            [DataMember(Name = "orientation")]
            public ManifestOrientation orientation;

            [DataMember(Name = "pieces")]
            public ManifestPiece[] pieces;
        }

        [DataContract]
        private sealed class ManifestOrientation
        {
            [DataMember(Name = "up")]
            public string up;

            [DataMember(Name = "width")]
            public string width;

            [DataMember(Name = "depth")]
            public string depth;
        }

        [DataContract]
        private sealed class ManifestPiece
        {
            [DataMember(Name = "id")]
            public string Id;

            [DataMember(Name = "name")]
            public string Name;

            [DataMember(Name = "category")]
            public string Category;

            [DataMember(Name = "width")]
            public float Width;

            [DataMember(Name = "height")]
            public float Height;

            [DataMember(Name = "depth")]
            public float Depth;

            [DataMember(Name = "pivot")]
            public string Pivot;

            [DataMember(Name = "unit")]
            public string Unit;

            [DataMember(Name = "model_filename")]
            public string ModelFilename;
        }

        /// <summary>
        /// Finds the repository root by walking up from the test binary.
        /// </summary>
        /// <remarks>
        /// The test runs from <c>bin/Debug/net10.0</c>, and the depth of that path is an
        /// implementation detail of the SDK. Searching for a known landmark survives it.
        /// </remarks>
        private static string RepositoryRoot()
        {
#if UNITY_EDITOR
            DirectoryInfo directory = new DirectoryInfo(Application.dataPath);
#else
            DirectoryInfo directory = new DirectoryInfo(AppContext.BaseDirectory);
#endif

            while (directory != null)
            {
                string candidate = Path.Combine(
                    directory.FullName, "Assets", "Art", "Blocks", "block_asset_manifest.json");

                if (File.Exists(candidate))
                {
                    return directory.FullName;
                }

                directory = directory.Parent;
            }

            throw new TestFailure(
                "could not locate the repository root from " + AppContext.BaseDirectory);
        }

        private static ManifestDocument LoadManifestDocument()
        {
            string path = Path.Combine(
                RepositoryRoot(), "Assets", "Art", "Blocks", "block_asset_manifest.json");
            byte[] bytes = Encoding.UTF8.GetBytes(File.ReadAllText(path));
            DataContractJsonSerializer serializer =
                new DataContractJsonSerializer(typeof(ManifestDocument));

            ManifestDocument document;
            using (MemoryStream stream = new MemoryStream(bytes))
            {
                document = serializer.ReadObject(stream) as ManifestDocument;
            }
            if (document == null || document.orientation == null || document.pieces == null)
            {
                throw new TestFailure("could not parse the structural block manifest");
            }

            return document;
        }

        private static List<ManifestPiece> LoadManifest()
        {
            List<ManifestPiece> pieces = new List<ManifestPiece>();

            ManifestDocument document = LoadManifestDocument();
            foreach (ManifestPiece piece in document.pieces)
            {
                pieces.Add(piece);
            }

            return pieces;
        }

        [Test("the manifest still declares 1 structural unit = 1 metre", Requirement = "VAL-018")]
        public static void StructuralUnitIsOneMetre()
        {
            // Docs/Physics.md section 2 fixes 1 SU = 1 Unity unit = 1 metre, and every mass in the
            // game follows from it. If the asset pipeline ever re-scaled the library, every density
            // and every collider in PieceLibrary would silently become wrong - so this is asserted
            // rather than assumed.
            ManifestDocument document = LoadManifestDocument();
            Check.Near(1f, document.structural_unit_meters, 1e-6f, "structural_unit_meters");
            Check.Equal("Y", document.orientation.up, "up axis");
            Check.Equal("X", document.orientation.width, "width axis");
            Check.Equal("Z", document.orientation.depth, "depth axis");
        }

        [Test("the library defines exactly the pieces the manifest lists", Requirement = "VAL-018")]
        public static void LibraryCoversTheManifestExactly()
        {
            List<ManifestPiece> manifest = LoadManifest();

            Check.Equal(15, manifest.Count, "manifest piece count");
            Check.Equal(manifest.Count, PieceLibrary.All.Count, "library piece count");

            foreach (ManifestPiece piece in manifest)
            {
                Check.True(
                    PieceLibrary.Get(piece.Id) != null,
                    $"the library is missing manifest piece {piece.Id}");
            }

            foreach (string id in PieceLibrary.Ids)
            {
                bool inManifest = manifest.Exists(p => p.Id == id);
                Check.True(inManifest, $"the library defines {id}, which the manifest does not list");
            }
        }

        [Test("every library dimension matches the manifest", Requirement = "VAL-018")]
        public static void DimensionsMatchTheManifest()
        {
            foreach (ManifestPiece piece in LoadManifest())
            {
                PieceDefinition definition = PieceLibrary.Get(piece.Id);

                Check.Equal("SU", piece.Unit, $"{piece.Id} manifest unit");
                Check.Near(piece.Width, definition.Width, 1e-4f, $"{piece.Id} width");
                Check.Near(piece.Height, definition.Height, 1e-4f, $"{piece.Id} height");
                Check.Near(piece.Depth, definition.Depth, 1e-4f, $"{piece.Id} depth");
                Check.Equal(piece.Name, definition.DisplayName, $"{piece.Id} display name");
                Check.Equal(piece.ModelFilename, definition.ModelFile, $"{piece.Id} model file");
            }
        }

        [Test("every library pivot and category matches the manifest", Requirement = "VAL-018")]
        public static void PivotsAndCategoriesMatchTheManifest()
        {
            foreach (ManifestPiece piece in LoadManifest())
            {
                PieceDefinition definition = PieceLibrary.Get(piece.Id);

                PivotKind expectedPivot = piece.Pivot == "center-bottom"
                    ? PivotKind.CenterBottom
                    : PivotKind.GeometricCenter;

                Check.Equal(expectedPivot, definition.Pivot, $"{piece.Id} pivot");

                PieceCategory expectedCategory = piece.Category.ToUpperInvariant() switch
                {
                    "BASIC" => PieceCategory.Basic,
                    "SUPPORT" => PieceCategory.Support,
                    _ => PieceCategory.Advanced,
                };

                Check.Equal(expectedCategory, definition.Category, $"{piece.Id} category");
            }
        }

        [Test("collider volumes fit inside the declared bounding box", Requirement = "VAL-018")]
        public static void CollidersFitTheDeclaredBounds()
        {
            // A collider that pokes outside a piece's declared dimensions would make the
            // off-platform rule judge a footprint the artwork does not have. Checked with a small
            // tolerance because the mechanical stabiliser's rotated braces land a hair inside.
            const float tolerance = 0.01f;

            foreach (PieceDefinition definition in PieceLibrary.All.Values)
            {
                OrientedBox[] boxes = definition.GetColliderBoxes();

                Vec3 min = Vec3.Zero;
                Vec3 max = Vec3.Zero;
                bool first = true;

                foreach (OrientedBox box in boxes)
                {
                    box.GetWorldBounds(out Vec3 boxMin, out Vec3 boxMax);
                    min = first ? boxMin : Vec3.Min(min, boxMin);
                    max = first ? boxMax : Vec3.Max(max, boxMax);
                    first = false;
                }

                Vec3 size = max - min;

                Check.True(
                    size.X <= definition.Width + tolerance,
                    $"{definition.Id} collider width {size.X:0.###} exceeds declared {definition.Width}");
                Check.True(
                    size.Y <= definition.Height + tolerance,
                    $"{definition.Id} collider height {size.Y:0.###} exceeds declared {definition.Height}");
                Check.True(
                    size.Z <= definition.Depth + tolerance,
                    $"{definition.Id} collider depth {size.Z:0.###} exceeds declared {definition.Depth}");
            }
        }

        [Test("centre-bottom pieces rest on the platform rather than sinking into it",
            Requirement = "VAL-018")]
        public static void CentreBottomPiecesSitOnZero()
        {
            // A piece with a centre-bottom pivot placed at y = 0 must have its lowest collider
            // point at y = 0. Getting this wrong by half a height is the classic way an authored
            // structure ends up buried in the platform on first load.
            foreach (PieceDefinition definition in PieceLibrary.All.Values)
            {
                if (definition.Pivot != PivotKind.CenterBottom)
                {
                    continue;
                }

                PieceState placed = definition.CreateInstance("t", Vec3.Zero, Quat.Identity);
                Check.Near(0f, placed.GetLowestY(), 0.01f, $"{definition.Id} base height");
            }
        }

        [Test("solid volume never exceeds the bounding volume, and is less where the shape is open",
            Requirement = "TODO-005")]
        public static void SolidVolumesAreCoherent()
        {
            foreach (PieceDefinition definition in PieceLibrary.All.Values)
            {
                float bounding = definition.Width * definition.Height * definition.Depth;

                Check.True(
                    definition.SolidVolume <= bounding + 1e-3f,
                    $"{definition.Id} solid volume {definition.SolidVolume:0.###} exceeds its " +
                    $"bounding volume {bounding:0.###}");

                Check.True(definition.SolidVolume > 0f, $"{definition.Id} has no volume");
            }

            // The specific cases Docs/Physics.md section 4 calls out: shapes whose real volume is
            // meaningfully below their bounding box. If any of these ever equals its bounding
            // volume, someone has quietly replaced real geometry with a box.
            Check.True(
                PieceLibrary.Get("S05_ARCH").SolidVolume < 6f,
                "the arch is being treated as a solid 3x2x1 block");
            Check.True(
                PieceLibrary.Get("A04_ROLLER").SolidVolume < 2f,
                "the roller is being treated as a solid box rather than a cylinder");
            Check.True(
                PieceLibrary.Get("S01_ROUND_COLUMN").SolidVolume < 3f,
                "the round column is being treated as a solid box");
            Check.True(
                PieceLibrary.Get("A03_CROSS_BEAM").SolidVolume < 9f,
                "the cross beam is being treated as a solid 3x3x1 block");
        }

        [Test("the roller and the round column keep cylindrical colliders", Requirement = "TODO-005")]
        public static void RollersAreNeverBoxes()
        {
            // Addendum 003 section 7 and Docs/Physics.md section 6 both single this out: A04 exists
            // to roll, and a box collider would silently remove the behaviour the piece was made for.
            Check.Equal(
                ColliderKind.Cylinder,
                PieceLibrary.Get("A04_ROLLER").Colliders[0].Kind,
                "A04_ROLLER collider kind");

            Check.Equal(
                CylinderAxis.X,
                PieceLibrary.Get("A04_ROLLER").Colliders[0].Axis,
                "A04_ROLLER cylinder axis - it lies on its side");

            Check.Equal(
                ColliderKind.Cylinder,
                PieceLibrary.Get("S01_ROUND_COLUMN").Colliders[0].Kind,
                "S01_ROUND_COLUMN collider kind");
        }

        [Test("mass follows volume times density for every piece and material", Requirement = "TODO-005")]
        public static void MassFollowsVolumeTimesDensity()
        {
            // Docs/Physics.md section 4 fixes the relationship. Spot-checked against hand figures
            // so that a future edit to either side is caught.
            PieceDefinition smallBlock = PieceLibrary.Get("B01_SMALL_BLOCK");
            Check.Near(700f, smallBlock.MassKg(700f), 0.5f, "1 m3 of wood at 700 kg/m3");

            PieceDefinition arch = PieceLibrary.Get("S05_ARCH");
            Check.Near(9500f, arch.MassKg(1900f), 1f, "5 m3 of brick at 1900 kg/m3");

            PieceDefinition roller = PieceLibrary.Get("A04_ROLLER");
            Check.Near(1727.9f, roller.MassKg(1100f), 1f, "1.5708 m3 of rubber at 1100 kg/m3");
        }

        [Test("the effective-density term keeps steel pieces playable", Requirement = "ASM-01")]
        public static void SteelEffectiveDensityIsApplied()
        {
            // Docs/Physics.md section 4 flagged this: a solid steel B05_LARGE_BLOCK would mass
            // about 31 400 kg, "physically correct and probably unplayable". The resolution is the
            // solid-fraction term, and this asserts it is actually in effect rather than merely
            // documented.
            IReadOnlyDictionary<ImpactTheory.Core.MaterialFamily, ImpactTheory.Physics.MaterialPhysics>
                materials = ImpactTheory.Physics.MaterialPhysics.CreateDefaultTable();

            ImpactTheory.Physics.MaterialPhysics steel =
                materials[ImpactTheory.Core.MaterialFamily.Steel];

            Check.Near(7850f, steel.Density, 1f, "steel true density should stay honest");
            Check.True(steel.SolidFraction < 1f, "steel has no solid-fraction reduction");

            float solidMass = PieceLibrary.Get("B05_LARGE_BLOCK").MassKg(steel.Density);
            float effectiveMass = PieceLibrary.Get("B05_LARGE_BLOCK").MassKg(steel.EffectiveDensity);

            Check.Near(31400f, solidMass, 100f, "solid steel large block mass");
            Check.True(
                effectiveMass < solidMass * 0.5f,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "effective steel mass {0:0} is not meaningfully below solid {1:0}",
                    effectiveMass, solidMass));
        }
    }
}
