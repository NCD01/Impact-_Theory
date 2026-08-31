using System.Collections.Generic;
using ImpactTheory.Core;
using ImpactTheory.Core.Math;

namespace ImpactTheory.Gameplay
{
    /// <summary>One piece placed in a structure.</summary>
    public readonly struct PiecePlacement
    {
        public PiecePlacement(
            string definitionId,
            Vec3 position,
            Quat rotation,
            MaterialFamily material,
            bool required = true)
        {
            DefinitionId = definitionId;
            Position = position;
            Rotation = rotation;
            Material = material;
            Required = required;
        }

        public string DefinitionId { get; }

        public Vec3 Position { get; }

        public Quat Rotation { get; }

        public MaterialFamily Material { get; }

        public bool Required { get; }
    }

    /// <summary>
    /// A complete, reproducible description of a level's structure.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Data, not a scene. <c>Docs/GameDesign.md</c> §51 requires enough information to reconstruct
    /// any structure involved in a failed validation - piece ids, transforms, materials, and the
    /// seed once generation exists. A blueprint is exactly that record, and it happens to be the
    /// most convenient way to author structures by hand too.
    /// </para>
    /// <para>
    /// The procedural generator, when it is eventually unblocked (Addendum 001 §12 gates it behind
    /// a proven manual loop), will emit these rather than build scenes directly. That is why this
    /// lives in the engine-free layer.
    /// </para>
    /// </remarks>
    public sealed class StructureBlueprint
    {
        private readonly List<PiecePlacement> _placements = new List<PiecePlacement>();

        public StructureBlueprint(string id, string displayName, int ballAllowance, float difficulty = 1f)
        {
            Id = id;
            DisplayName = displayName;
            BallAllowance = ballAllowance;
            Difficulty = difficulty;
        }

        public string Id { get; }

        public string DisplayName { get; }

        /// <summary>How many balls this level grants (<c>Docs/GameDesign.md</c> §23).</summary>
        public int BallAllowance { get; }

        public float Difficulty { get; }

        /// <summary>Seed, once structures are generated rather than authored.</summary>
        public string Seed { get; set; }

        public IReadOnlyList<PiecePlacement> Placements => _placements;

        public StructureBlueprint Place(
            string definitionId,
            float x,
            float y,
            float z,
            MaterialFamily material,
            float yawDegrees = 0f,
            float pitchDegrees = 0f,
            float rollDegrees = 0f)
        {
            _placements.Add(new PiecePlacement(
                definitionId,
                new Vec3(x, y, z),
                Quat.FromEuler(pitchDegrees, yawDegrees, rollDegrees),
                material));

            return this;
        }

        /// <summary>The centre and radius of the structure, for framing the camera.</summary>
        public void GetExtents(out Vec3 centre, out float radius)
        {
            if (_placements.Count == 0)
            {
                centre = Vec3.Zero;
                radius = 6f;
                return;
            }

            Vec3 min = _placements[0].Position;
            Vec3 max = min;

            foreach (PiecePlacement placement in _placements)
            {
                min = Vec3.Min(min, placement.Position);
                max = Vec3.Max(max, placement.Position);
            }

            centre = (min + max) * 0.5f;
            centre.Y += 1.5f;
            radius = MathUtil.Max((max - min).Magnitude * 0.5f, 4f) + 2f;
        }
    }
}
