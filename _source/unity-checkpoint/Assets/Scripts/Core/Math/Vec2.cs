using System;
using System.Globalization;

namespace ImpactTheory.Core.Math
{
    /// <summary>
    /// A two-component vector on the horizontal XZ plane, in metres.
    /// </summary>
    /// <remarks>
    /// The off-platform rule (<c>Docs/Physics.md</c> §8) asks whether a piece's <em>footprint</em>
    /// has crossed the platform boundary. A footprint is a horizontal question, so the whole test
    /// collapses to 2D convex-polygon overlap once the piece's corners are projected onto XZ.
    /// Doing that in a dedicated 2D type keeps the intent obvious and stops height creeping into a
    /// calculation where it has no business.
    /// <para>
    /// <c>X</c> maps to world X and <c>Y</c> maps to world <em>Z</em>. That naming is a little
    /// uncomfortable but it is the standard convention for a projected plane, and
    /// <see cref="Vec3.XZ"/> is the only place the mapping is made.
    /// </para>
    /// </remarks>
    [Serializable]
    public struct Vec2 : IEquatable<Vec2>
    {
        public float X;

        /// <summary>World Z. Named Y because this is a 2D vector on the projected plane.</summary>
        public float Y;

        public Vec2(float x, float y)
        {
            X = x;
            Y = y;
        }

        public static Vec2 Zero => new Vec2(0f, 0f);

        public float SqrMagnitude => (X * X) + (Y * Y);

        public float Magnitude => (float)System.Math.Sqrt(SqrMagnitude);

        public Vec2 Normalized
        {
            get
            {
                float m = Magnitude;
                return m > MathUtil.Epsilon ? this / m : Zero;
            }
        }

        /// <summary>
        /// The left-hand perpendicular. Separating-axis tests need an axis per polygon edge, and
        /// for a 2D edge that axis is just the edge rotated a quarter turn.
        /// </summary>
        public Vec2 Perpendicular => new Vec2(-Y, X);

        public static Vec2 operator +(Vec2 a, Vec2 b) => new Vec2(a.X + b.X, a.Y + b.Y);

        public static Vec2 operator -(Vec2 a, Vec2 b) => new Vec2(a.X - b.X, a.Y - b.Y);

        public static Vec2 operator -(Vec2 a) => new Vec2(-a.X, -a.Y);

        public static Vec2 operator *(Vec2 a, float s) => new Vec2(a.X * s, a.Y * s);

        public static Vec2 operator *(float s, Vec2 a) => a * s;

        public static Vec2 operator /(Vec2 a, float s) => new Vec2(a.X / s, a.Y / s);

        public static bool operator ==(Vec2 a, Vec2 b) => a.Equals(b);

        public static bool operator !=(Vec2 a, Vec2 b) => !a.Equals(b);

        public static float Dot(Vec2 a, Vec2 b) => (a.X * b.X) + (a.Y * b.Y);

        public static float Distance(Vec2 a, Vec2 b) => (a - b).Magnitude;

        public static Vec2 Min(Vec2 a, Vec2 b) =>
            new Vec2(System.Math.Min(a.X, b.X), System.Math.Min(a.Y, b.Y));

        public static Vec2 Max(Vec2 a, Vec2 b) =>
            new Vec2(System.Math.Max(a.X, b.X), System.Math.Max(a.Y, b.Y));

        public bool Equals(Vec2 other) => X.Equals(other.X) && Y.Equals(other.Y);

        public override bool Equals(object obj) => obj is Vec2 other && Equals(other);

        public override int GetHashCode()
        {
            unchecked
            {
                return (X.GetHashCode() * 397) ^ Y.GetHashCode();
            }
        }

        public override string ToString() =>
            string.Format(CultureInfo.InvariantCulture, "({0:0.###}, {1:0.###})", X, Y);
    }
}
