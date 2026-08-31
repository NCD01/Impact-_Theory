using System.Collections.Generic;
using ImpactTheory.Core;
using ImpactTheory.Core.Math;

namespace ImpactTheory.Structure
{
    /// <summary>The three approved piece categories (<c>Docs/GameDesign.md</c> §26).</summary>
    public enum PieceCategory
    {
        Basic = 0,
        Support = 1,
        Advanced = 2,
    }

    /// <summary>Where a piece's origin sits, as recorded in <c>block_asset_manifest.csv</c>.</summary>
    public enum PivotKind
    {
        /// <summary>Origin at the centre of the base. Placing at y = 0 rests the piece on the platform.</summary>
        CenterBottom = 0,

        /// <summary>Origin at the volumetric centre. Used by the cross beam and the roller.</summary>
        GeometricCenter = 1,
    }

    /// <summary>Which primitive Unity should build for a collider part.</summary>
    public enum ColliderKind
    {
        Box = 0,

        /// <summary>
        /// A cylinder. Unity has no cylinder collider, so this becomes a capsule or a convex hull -
        /// but it must never become a box. <c>A04_ROLLER</c> exists to roll (Addendum 003 §7).
        /// </summary>
        Cylinder = 1,

        /// <summary>A sloped face preserved by a convex hull rather than a primitive.</summary>
        ConvexWedge = 2,
    }

    /// <summary>The axis a cylindrical part runs along, in piece-local space.</summary>
    public enum CylinderAxis
    {
        X = 0,
        Y = 1,
        Z = 2,
    }

    /// <summary>
    /// One collider volume within a piece.
    /// </summary>
    /// <remarks>
    /// Complex pieces are compound primitives, one per structural member
    /// (<c>Docs/Physics.md</c> §6). Mesh colliders are avoided: physics reliability and Web
    /// performance outrank collider visual fidelity, and a browser is the weakest target in the
    /// plan.
    /// </remarks>
    public sealed class ColliderPart
    {
        public ColliderPart(
            ColliderKind kind,
            Vec3 centre,
            Vec3 halfExtents,
            Quat rotation,
            CylinderAxis axis = CylinderAxis.Y)
        {
            Kind = kind;
            Centre = centre;
            HalfExtents = halfExtents;
            Rotation = rotation;
            Axis = axis;
        }

        public ColliderKind Kind { get; }

        /// <summary>Centre in piece-local space.</summary>
        public Vec3 Centre { get; }

        public Vec3 HalfExtents { get; }

        public Quat Rotation { get; }

        /// <summary>Only meaningful when <see cref="Kind"/> is <see cref="ColliderKind.Cylinder"/>.</summary>
        public CylinderAxis Axis { get; }

        /// <summary>Creates a box part, which is most of them.</summary>
        public static ColliderPart Box(Vec3 centre, Vec3 halfExtents) =>
            new ColliderPart(ColliderKind.Box, centre, halfExtents, Quat.Identity);

        /// <summary>Creates a box part rotated about the Z axis, for diagonal bracing.</summary>
        public static ColliderPart RotatedBox(Vec3 centre, Vec3 halfExtents, float zDegrees) =>
            new ColliderPart(
                ColliderKind.Box, centre, halfExtents, Quat.FromEuler(0f, 0f, zDegrees));

        public static ColliderPart Cylinder(Vec3 centre, Vec3 halfExtents, CylinderAxis axis) =>
            new ColliderPart(ColliderKind.Cylinder, centre, halfExtents, Quat.Identity, axis);

        public static ColliderPart Wedge(Vec3 centre, Vec3 halfExtents) =>
            new ColliderPart(ColliderKind.ConvexWedge, centre, halfExtents, Quat.Identity);

        /// <summary>
        /// The part as an oriented box, which is what the off-platform rule reasons about.
        /// </summary>
        /// <remarks>
        /// A cylinder's box is its bounding box, so its footprint is slightly larger than the true
        /// circular shadow at the corners. That error is in the safe direction: it can only make a
        /// piece look marginally more "still on the platform" than it is, and the specification is
        /// explicit that a piece touching the platform counts as remaining.
        /// </remarks>
        public OrientedBox ToBox() => new OrientedBox(Centre, HalfExtents, Rotation);
    }

    /// <summary>
    /// The machine-readable definition of one structural piece.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Docs/GameDesign.md</c> §29 requires every piece to have a definition covering identity,
    /// dimensions, mass, material, collision geometry, and generator weighting - "the procedural
    /// system should understand pieces as structured data, not only as 3D artwork".
    /// </para>
    /// <para>
    /// <strong>Dimensions here are validated against
    /// <c>Assets/Art/Blocks/block_asset_manifest.json</c>, never retyped from it.</strong>
    /// <c>Docs/Architecture.md</c> §6 is explicit about that, and
    /// <c>PieceLibraryManifestTests</c> enforces it - if a dimension in this library ever disagrees
    /// with the manifest, the test suite fails rather than the game quietly running on stale numbers.
    /// </para>
    /// </remarks>
    public sealed class PieceDefinition
    {
        private readonly ColliderPart[] _colliders;

        public PieceDefinition(
            string id,
            string displayName,
            PieceCategory category,
            float width,
            float height,
            float depth,
            float solidVolume,
            PivotKind pivot,
            MaterialFamily defaultMaterial,
            IReadOnlyList<ColliderPart> colliders,
            string modelFile,
            float generatorWeight = 1f,
            float difficultyWeight = 1f)
        {
            Id = id;
            DisplayName = displayName;
            Category = category;
            Width = width;
            Height = height;
            Depth = depth;
            SolidVolume = solidVolume;
            Pivot = pivot;
            DefaultMaterial = defaultMaterial;
            ModelFile = modelFile;
            GeneratorWeight = generatorWeight;
            DifficultyWeight = difficultyWeight;

            _colliders = new ColliderPart[colliders.Count];
            for (int i = 0; i < colliders.Count; i++)
            {
                _colliders[i] = colliders[i];
            }
        }

        public string Id { get; }

        public string DisplayName { get; }

        public PieceCategory Category { get; }

        /// <summary>Extent along local X, in metres. 1 SU = 1 m (<c>Docs/Physics.md</c> §2).</summary>
        public float Width { get; }

        /// <summary>Extent along local Y, in metres.</summary>
        public float Height { get; }

        /// <summary>Extent along local Z, in metres.</summary>
        public float Depth { get; }

        /// <summary>
        /// The volume of actual material, in cubic metres.
        /// </summary>
        /// <remarks>
        /// <strong>Not the bounding box.</strong> <c>Docs/Physics.md</c> §4 makes the point
        /// directly: "an arch and a solid block of the same bounding size have very different
        /// volumes". <c>S05_ARCH</c> is 3 x 2 x 1 m but only 5 m³ rather than 6, because the
        /// archway is empty; <c>A04_ROLLER</c> is a 2 x 1 x 1 m cylinder and so 1.571 m³ rather
        /// than 2. These are computed analytically from the geometry in
        /// <c>Assets/Art/Blocks/Source/generate_v1_blocks.py</c>, which is the authoritative
        /// description of what was actually modelled.
        /// </remarks>
        public float SolidVolume { get; }

        public PivotKind Pivot { get; }

        /// <summary>
        /// The material this piece is made of unless a structure overrides it.
        /// </summary>
        /// <remarks>
        /// A default, not an identity. Geometry and material stay independent
        /// (<c>Docs/GameDesign.md</c> §30), so any piece can be built from any family.
        /// </remarks>
        public MaterialFamily DefaultMaterial { get; }

        public IReadOnlyList<ColliderPart> Colliders => _colliders;

        /// <summary>Path of the V1 geometry, relative to <c>Assets/Art/Blocks/</c>.</summary>
        public string ModelFile { get; }

        /// <summary>Relative likelihood the generator picks this piece. Unused until generation exists.</summary>
        public float GeneratorWeight { get; }

        /// <summary>How much this piece contributes to a structure's estimated difficulty.</summary>
        public float DifficultyWeight { get; }

        /// <summary>
        /// Mass in kilograms, from <c>Mass = Volume × Density</c>.
        /// </summary>
        /// <remarks>
        /// Computed rather than stored, so that mass cannot drift out of step with either the
        /// geometry or the material table. <c>Docs/Physics.md</c> §4: "Mass is data, never
        /// hand-tuned per instance."
        /// </remarks>
        /// <param name="effectiveDensity">
        /// kg/m³, from <c>ImpactTheory.Physics.MaterialPhysics.EffectiveDensity</c>. Passed in as a
        /// number so that <c>Structure</c> does not have to depend on <c>Physics</c>
        /// (<c>Docs/Architecture.md</c> §3).
        /// </param>
        public float MassKg(float effectiveDensity) => SolidVolume * effectiveDensity;

        /// <summary>The collider parts as oriented boxes, ready for <see cref="PieceState"/>.</summary>
        public OrientedBox[] GetColliderBoxes()
        {
            OrientedBox[] boxes = new OrientedBox[_colliders.Length];
            for (int i = 0; i < _colliders.Length; i++)
            {
                boxes[i] = _colliders[i].ToBox();
            }

            return boxes;
        }

        /// <summary>Creates a placed instance of this piece.</summary>
        public PieceState CreateInstance(
            string instanceId, Vec3 position, Quat rotation, bool required = true) =>
            new PieceState(instanceId, Id, GetColliderBoxes(), position, rotation, required);

        public override string ToString() =>
            $"{Id} {Width:0.##}x{Height:0.##}x{Depth:0.##} m, {SolidVolume:0.###} m3";
    }
}
