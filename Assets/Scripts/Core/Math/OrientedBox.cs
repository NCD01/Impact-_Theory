using System.Collections.Generic;

namespace ImpactTheory.Core.Math
{
    /// <summary>
    /// An oriented box in world space: a centre, half-extents, and a rotation.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is the gameplay-collider primitive for Impact Theory. <c>Docs/Physics.md</c> §6 calls
    /// for boxes on rectangular pieces and compound primitives on complex ones, and explicitly
    /// rules out mesh colliders for Web performance. A structural piece is therefore represented to
    /// the game rules as one or more of these, never as its render mesh.
    /// </para>
    /// <para>
    /// Note what this type is <em>not</em>: it is not a physics collider. Unity owns simulation.
    /// This is the geometry the off-platform rule reasons about after the simulation has settled.
    /// </para>
    /// </remarks>
    public struct OrientedBox
    {
        public Vec3 Centre;
        public Vec3 HalfExtents;
        public Quat Rotation;

        public OrientedBox(Vec3 centre, Vec3 halfExtents, Quat rotation)
        {
            Centre = centre;
            HalfExtents = halfExtents;
            Rotation = rotation;
        }

        /// <summary>Builds a box from a full size rather than half-extents, which is how assets describe themselves.</summary>
        public static OrientedBox FromSize(Vec3 centre, Vec3 size, Quat rotation) =>
            new OrientedBox(centre, size * 0.5f, rotation);

        /// <summary>The eight corners, in world space.</summary>
        public Vec3[] GetCorners()
        {
            Vec3[] corners = new Vec3[8];
            int index = 0;

            for (int sx = -1; sx <= 1; sx += 2)
            {
                for (int sy = -1; sy <= 1; sy += 2)
                {
                    for (int sz = -1; sz <= 1; sz += 2)
                    {
                        Vec3 local = new Vec3(
                            HalfExtents.X * sx,
                            HalfExtents.Y * sy,
                            HalfExtents.Z * sz);

                        corners[index++] = Centre + (Rotation * local);
                    }
                }
            }

            return corners;
        }

        /// <summary>
        /// The box's shadow on the XZ plane.
        /// </summary>
        /// <remarks>
        /// For an axis-aligned box this is a rectangle; for a tilted one it is a hexagon. Both fall
        /// out of taking the convex hull of the projected corners, so no special-casing is needed
        /// for the toppled pieces that matter most to the off-platform rule.
        /// </remarks>
        public ConvexPolygon2D GetFootprint()
        {
            Vec3[] corners = GetCorners();
            Vec2[] projected = new Vec2[corners.Length];
            for (int i = 0; i < corners.Length; i++)
            {
                projected[i] = corners[i].XZ;
            }

            return ConvexPolygon2D.FromPoints(projected);
        }

        /// <summary>The lowest world-space Y of any corner - the box's contact height.</summary>
        public float GetLowestY()
        {
            Vec3[] corners = GetCorners();
            float lowest = corners[0].Y;
            for (int i = 1; i < corners.Length; i++)
            {
                if (corners[i].Y < lowest)
                {
                    lowest = corners[i].Y;
                }
            }

            return lowest;
        }

        /// <summary>The highest world-space Y of any corner.</summary>
        public float GetHighestY()
        {
            Vec3[] corners = GetCorners();
            float highest = corners[0].Y;
            for (int i = 1; i < corners.Length; i++)
            {
                if (corners[i].Y > highest)
                {
                    highest = corners[i].Y;
                }
            }

            return highest;
        }

        /// <summary>The world-space axis-aligned bounds enclosing the box.</summary>
        public void GetWorldBounds(out Vec3 min, out Vec3 max)
        {
            Vec3[] corners = GetCorners();
            min = corners[0];
            max = corners[0];
            for (int i = 1; i < corners.Length; i++)
            {
                min = Vec3.Min(min, corners[i]);
                max = Vec3.Max(max, corners[i]);
            }
        }

        /// <summary>
        /// The combined footprint of several boxes, as one polygon per box.
        /// </summary>
        /// <remarks>
        /// A compound piece such as the arch or the mechanical stabiliser is several boxes, and the
        /// union of their shadows is generally concave - an arch's shadow has a hole under the span
        /// when it stands upright. Rather than build a concave union, callers test each part
        /// separately and combine the answers with OR, which is both simpler and correct for the
        /// only question being asked: does any part of this piece still lie over the platform?
        /// </remarks>
        public static List<ConvexPolygon2D> GetFootprints(IReadOnlyList<OrientedBox> boxes)
        {
            List<ConvexPolygon2D> footprints = new List<ConvexPolygon2D>(boxes.Count);
            for (int i = 0; i < boxes.Count; i++)
            {
                footprints.Add(boxes[i].GetFootprint());
            }

            return footprints;
        }
    }
}
