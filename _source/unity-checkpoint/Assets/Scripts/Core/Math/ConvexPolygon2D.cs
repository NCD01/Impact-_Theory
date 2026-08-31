using System;
using System.Collections.Generic;

namespace ImpactTheory.Core.Math
{
    /// <summary>
    /// A convex polygon on the horizontal XZ plane, stored as counter-clockwise vertices.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is the shape the off-platform rule works in. Condition 1 of that rule
    /// (<c>Docs/Physics.md</c> §8) - "its entire footprint has crossed the platform boundary" - is
    /// exactly "the piece's footprint polygon does not overlap the platform's footprint polygon".
    /// </para>
    /// <para>
    /// A piece's footprint is the XZ shadow of its oriented bounding box. For an arbitrarily
    /// rotated box that shadow is a hexagon, not a rectangle, which is why this needs to be a
    /// general convex polygon and not an axis-aligned rectangle test. Getting that wrong would
    /// misjudge exactly the tilted and toppled pieces the rule exists to adjudicate.
    /// </para>
    /// </remarks>
    public sealed class ConvexPolygon2D
    {
        private readonly Vec2[] _vertices;

        private ConvexPolygon2D(Vec2[] vertices)
        {
            _vertices = vertices;
        }

        public IReadOnlyList<Vec2> Vertices => _vertices;

        public int Count => _vertices.Length;

        /// <summary>
        /// Builds the convex hull of a point set.
        /// </summary>
        /// <remarks>
        /// Andrew's monotone chain: sort, then sweep a lower and an upper hull. O(n log n), and for
        /// the eight corners of a box it is effectively free. Collinear points are dropped so that
        /// an axis-aligned box yields four vertices rather than six, which keeps the separating-axis
        /// test from testing the same axis twice.
        /// </remarks>
        public static ConvexPolygon2D FromPoints(IReadOnlyList<Vec2> points)
        {
            if (points == null)
            {
                throw new ArgumentNullException(nameof(points));
            }

            if (points.Count == 0)
            {
                throw new ArgumentException("A polygon needs at least one point.", nameof(points));
            }

            Vec2[] sorted = new Vec2[points.Count];
            for (int i = 0; i < points.Count; i++)
            {
                sorted[i] = points[i];
            }

            Array.Sort(sorted, (a, b) =>
            {
                int cmp = a.X.CompareTo(b.X);
                return cmp != 0 ? cmp : a.Y.CompareTo(b.Y);
            });

            // Degenerate inputs are legitimate: a piece can be scaled to nothing in a test, and a
            // point or a line still needs to answer "do you overlap the platform?" sensibly.
            if (sorted.Length < 3)
            {
                return new ConvexPolygon2D(Deduplicate(sorted));
            }

            Vec2[] hull = new Vec2[sorted.Length * 2];
            int k = 0;

            for (int i = 0; i < sorted.Length; i++)
            {
                while (k >= 2 && Cross(hull[k - 2], hull[k - 1], sorted[i]) <= 0f)
                {
                    k--;
                }

                hull[k++] = sorted[i];
            }

            int lower = k + 1;
            for (int i = sorted.Length - 2; i >= 0; i--)
            {
                while (k >= lower && Cross(hull[k - 2], hull[k - 1], sorted[i]) <= 0f)
                {
                    k--;
                }

                hull[k++] = sorted[i];
            }

            // The last point repeats the first.
            Vec2[] result = new Vec2[System.Math.Max(k - 1, 1)];
            Array.Copy(hull, result, result.Length);

            return new ConvexPolygon2D(result.Length >= 3 ? result : Deduplicate(sorted));
        }

        /// <summary>Builds an axis-aligned rectangle from its centre and half-extents.</summary>
        public static ConvexPolygon2D FromRect(Vec2 centre, Vec2 halfExtents)
        {
            float hx = MathUtil.Abs(halfExtents.X);
            float hy = MathUtil.Abs(halfExtents.Y);

            return new ConvexPolygon2D(new[]
            {
                new Vec2(centre.X - hx, centre.Y - hy),
                new Vec2(centre.X + hx, centre.Y - hy),
                new Vec2(centre.X + hx, centre.Y + hy),
                new Vec2(centre.X - hx, centre.Y + hy),
            });
        }

        /// <summary>
        /// True when the two polygons share any area, or touch.
        /// </summary>
        /// <remarks>
        /// <para>
        /// Separating-axis test. Two convex shapes are disjoint exactly when some axis exists on
        /// which their projections do not overlap, and for convex polygons it is enough to test the
        /// edge normals of both.
        /// </para>
        /// <para>
        /// <paramref name="tolerance"/> biases the answer toward "overlapping", and that direction
        /// is deliberate. The specification is explicit that a block "touching the platform with a
        /// small portion still counts as remaining" (<c>Docs/GameDesign.md</c> §11), so a piece
        /// grazing the boundary must not be scored as removed. Judging a borderline piece still
        /// present is a level that takes one more shot; judging it removed is a level that completes
        /// while a piece is visibly still on the platform, which is the far worse failure.
        /// </para>
        /// </remarks>
        public static bool Overlaps(ConvexPolygon2D a, ConvexPolygon2D b, float tolerance = MathUtil.Epsilon)
        {
            if (a == null || b == null)
            {
                return false;
            }

            return !HasSeparatingAxis(a, b, tolerance) && !HasSeparatingAxis(b, a, tolerance);
        }

        /// <summary>True when the point lies inside the polygon or on its boundary.</summary>
        public bool Contains(Vec2 point, float tolerance = MathUtil.Epsilon)
        {
            if (_vertices.Length < 3)
            {
                return false;
            }

            for (int i = 0; i < _vertices.Length; i++)
            {
                Vec2 current = _vertices[i];
                Vec2 next = _vertices[(i + 1) % _vertices.Length];
                if (Cross(current, next, point) < -tolerance)
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>The axis-aligned bounds, useful as a cheap rejection test before the full SAT.</summary>
        public void GetBounds(out Vec2 min, out Vec2 max)
        {
            min = _vertices[0];
            max = _vertices[0];
            for (int i = 1; i < _vertices.Length; i++)
            {
                min = Vec2.Min(min, _vertices[i]);
                max = Vec2.Max(max, _vertices[i]);
            }
        }

        /// <summary>Signed area, positive for counter-clockwise winding.</summary>
        public float SignedArea()
        {
            if (_vertices.Length < 3)
            {
                return 0f;
            }

            float sum = 0f;
            for (int i = 0; i < _vertices.Length; i++)
            {
                Vec2 current = _vertices[i];
                Vec2 next = _vertices[(i + 1) % _vertices.Length];
                sum += (current.X * next.Y) - (next.X * current.Y);
            }

            return sum * 0.5f;
        }

        public float Area() => MathUtil.Abs(SignedArea());

        private static bool HasSeparatingAxis(ConvexPolygon2D from, ConvexPolygon2D other, float tolerance)
        {
            for (int i = 0; i < from._vertices.Length; i++)
            {
                Vec2 current = from._vertices[i];
                Vec2 next = from._vertices[(i + 1) % from._vertices.Length];
                Vec2 edge = next - current;

                if (edge.SqrMagnitude < MathUtil.Epsilon * MathUtil.Epsilon)
                {
                    continue;
                }

                Vec2 axis = edge.Perpendicular.Normalized;

                Project(from, axis, out float minA, out float maxA);
                Project(other, axis, out float minB, out float maxB);

                // Separated only if the gap genuinely exceeds the tolerance. Touching is not
                // separation - see the remarks on Overlaps.
                if (minA > maxB + tolerance || minB > maxA + tolerance)
                {
                    return true;
                }
            }

            return false;
        }

        private static void Project(ConvexPolygon2D polygon, Vec2 axis, out float min, out float max)
        {
            min = Vec2.Dot(polygon._vertices[0], axis);
            max = min;

            for (int i = 1; i < polygon._vertices.Length; i++)
            {
                float d = Vec2.Dot(polygon._vertices[i], axis);
                if (d < min)
                {
                    min = d;
                }
                else if (d > max)
                {
                    max = d;
                }
            }
        }

        private static float Cross(Vec2 origin, Vec2 a, Vec2 b) =>
            ((a.X - origin.X) * (b.Y - origin.Y)) - ((a.Y - origin.Y) * (b.X - origin.X));

        private static Vec2[] Deduplicate(Vec2[] points)
        {
            List<Vec2> unique = new List<Vec2>(points.Length);
            foreach (Vec2 p in points)
            {
                bool seen = false;
                foreach (Vec2 u in unique)
                {
                    if (MathUtil.Approximately(u, p))
                    {
                        seen = true;
                        break;
                    }
                }

                if (!seen)
                {
                    unique.Add(p);
                }
            }

            return unique.ToArray();
        }
    }
}
