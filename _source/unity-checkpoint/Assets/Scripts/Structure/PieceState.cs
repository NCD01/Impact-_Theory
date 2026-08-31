using System;
using System.Collections.Generic;
using ImpactTheory.Core.Math;

namespace ImpactTheory.Structure
{
    /// <summary>
    /// One structural piece as the game rules see it: an identity, a world transform, and the
    /// simple collider volumes that stand in for its geometry.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is deliberately not the render mesh and not a Unity component. The off-platform rule
    /// reasons about the gameplay collider (<c>Docs/Physics.md</c> §6), which is a box or a small
    /// set of boxes, and keeping that separate is what lets V2's materialised meshes be swapped in
    /// without touching physics or the win condition.
    /// </para>
    /// <para>
    /// Colliders are stored in piece-local space and transformed on demand. That matches how a
    /// prefab is authored - a compound piece such as the arch is a fixed arrangement of boxes
    /// relative to the piece origin - and it means a piece can be moved or rotated without
    /// rebuilding its collider description.
    /// </para>
    /// </remarks>
    public sealed class PieceState
    {
        private readonly OrientedBox[] _localColliders;

        public PieceState(
            string pieceId,
            string definitionId,
            IReadOnlyList<OrientedBox> localColliders,
            Vec3 position,
            Quat rotation,
            bool isRequired = true)
        {
            if (string.IsNullOrEmpty(pieceId))
            {
                throw new ArgumentException("A piece needs an id.", nameof(pieceId));
            }

            if (localColliders == null || localColliders.Count == 0)
            {
                throw new ArgumentException(
                    "A piece needs at least one collider volume; the off-platform rule has no " +
                    "geometry to test without one.",
                    nameof(localColliders));
            }

            PieceId = pieceId;
            DefinitionId = definitionId;
            IsRequired = isRequired;
            Position = position;
            Rotation = rotation;

            _localColliders = new OrientedBox[localColliders.Count];
            for (int i = 0; i < localColliders.Count; i++)
            {
                _localColliders[i] = localColliders[i];
            }
        }

        /// <summary>Unique per instance in a level. Two Small Blocks have different piece ids.</summary>
        public string PieceId { get; }

        /// <summary>Which library piece this is, for example <c>B01_SMALL_BLOCK</c>.</summary>
        public string DefinitionId { get; }

        /// <summary>
        /// Whether clearing this piece is needed to complete the level.
        /// </summary>
        /// <remarks>
        /// <c>Docs/GameDesign.md</c> §10 says a level completes when every <em>required</em> piece
        /// has left the platform. Every V1 piece is required; the flag exists so that decorative or
        /// scenery pieces can be added later without weakening the win condition, which is a fixed
        /// rule that must not be reinterpreted (Addendum 005 §6).
        /// </remarks>
        public bool IsRequired { get; }

        public Vec3 Position { get; private set; }

        public Quat Rotation { get; private set; }

        public IReadOnlyList<OrientedBox> LocalColliders => _localColliders;

        /// <summary>Updates the transform from the simulation.</summary>
        public void SetTransform(Vec3 position, Quat rotation)
        {
            Position = position;
            Rotation = rotation;
        }

        /// <summary>The collider volumes in world space, for the current transform.</summary>
        public OrientedBox[] GetWorldColliders()
        {
            OrientedBox[] world = new OrientedBox[_localColliders.Length];

            for (int i = 0; i < _localColliders.Length; i++)
            {
                OrientedBox local = _localColliders[i];
                world[i] = new OrientedBox(
                    Position + (Rotation * local.Centre),
                    local.HalfExtents,
                    Rotation * local.Rotation);
            }

            return world;
        }

        /// <summary>The lowest world Y across every collider volume - where the piece touches down.</summary>
        public float GetLowestY()
        {
            OrientedBox[] world = GetWorldColliders();
            float lowest = world[0].GetLowestY();
            for (int i = 1; i < world.Length; i++)
            {
                float candidate = world[i].GetLowestY();
                if (candidate < lowest)
                {
                    lowest = candidate;
                }
            }

            return lowest;
        }

        /// <summary>
        /// A single box enclosing the whole piece, in local space.
        /// </summary>
        /// <remarks>
        /// Convenience for building a simple piece, and for debug drawing. Not used by the
        /// off-platform rule, which tests each compound part separately so that an arch's opening
        /// is not treated as solid.
        /// </remarks>
        public static OrientedBox EnclosingLocalBox(IReadOnlyList<OrientedBox> localColliders)
        {
            Vec3 min = Vec3.Zero;
            Vec3 max = Vec3.Zero;
            bool first = true;

            foreach (OrientedBox box in localColliders)
            {
                box.GetWorldBounds(out Vec3 boxMin, out Vec3 boxMax);
                if (first)
                {
                    min = boxMin;
                    max = boxMax;
                    first = false;
                }
                else
                {
                    min = Vec3.Min(min, boxMin);
                    max = Vec3.Max(max, boxMax);
                }
            }

            Vec3 centre = (min + max) * 0.5f;
            return new OrientedBox(centre, (max - min) * 0.5f, Quat.Identity);
        }

        public override string ToString() =>
            $"{PieceId} ({DefinitionId}) at {Position}";
    }
}
