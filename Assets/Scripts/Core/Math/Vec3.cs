using System;
using System.Globalization;

namespace ImpactTheory.Core.Math
{
    /// <summary>
    /// A three-component vector in Impact Theory world space, in metres.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This deliberately does not use <c>UnityEngine.Vector3</c>. The rules of the game - the
    /// off-platform test, settling, scoring - are pure geometry and pure logic, and
    /// <c>Docs/Testing.md</c> §2 identifies them as the highest-value unit-test target on the
    /// project. Keeping them free of <c>UnityEngine</c> means they compile and run under a plain
    /// .NET test host, so they are genuinely verified rather than merely written.
    /// </para>
    /// <para>
    /// The Unity layer converts at its own boundary. That conversion is a handful of field copies
    /// and costs nothing measurable next to a physics step.
    /// </para>
    /// <para>
    /// Axis convention matches Unity so that nothing has to be mentally transposed: X right,
    /// Y up, Z forward. Gravity acts along -Y. The platform surface is the XZ plane
    /// (<c>Docs/Physics.md</c> §2).
    /// </para>
    /// </remarks>
    [Serializable]
    public struct Vec3 : IEquatable<Vec3>
    {
        public float X;
        public float Y;
        public float Z;

        public Vec3(float x, float y, float z)
        {
            X = x;
            Y = y;
            Z = z;
        }

        public static Vec3 Zero => new Vec3(0f, 0f, 0f);
        public static Vec3 One => new Vec3(1f, 1f, 1f);
        public static Vec3 Right => new Vec3(1f, 0f, 0f);
        public static Vec3 Up => new Vec3(0f, 1f, 0f);
        public static Vec3 Forward => new Vec3(0f, 0f, 1f);

        /// <summary>Standard gravity, downward, as specified in <c>Docs/Physics.md</c> §2.</summary>
        public static Vec3 Gravity => new Vec3(0f, -9.81f, 0f);

        public float SqrMagnitude => (X * X) + (Y * Y) + (Z * Z);

        public float Magnitude => (float)System.Math.Sqrt(SqrMagnitude);

        /// <summary>
        /// The horizontal component only. Used constantly by the off-platform rule, which is a
        /// question about footprint on the XZ plane and never about height.
        /// </summary>
        public Vec2 XZ => new Vec2(X, Z);

        public Vec3 Normalized
        {
            get
            {
                float m = Magnitude;
                // Returning zero rather than NaN for a degenerate vector keeps a single bad
                // frame of physics data from poisoning every downstream calculation silently.
                return m > MathUtil.Epsilon ? this / m : Zero;
            }
        }

        public static Vec3 operator +(Vec3 a, Vec3 b) => new Vec3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);

        public static Vec3 operator -(Vec3 a, Vec3 b) => new Vec3(a.X - b.X, a.Y - b.Y, a.Z - b.Z);

        public static Vec3 operator -(Vec3 a) => new Vec3(-a.X, -a.Y, -a.Z);

        public static Vec3 operator *(Vec3 a, float s) => new Vec3(a.X * s, a.Y * s, a.Z * s);

        public static Vec3 operator *(float s, Vec3 a) => a * s;

        public static Vec3 operator /(Vec3 a, float s) => new Vec3(a.X / s, a.Y / s, a.Z / s);

        public static bool operator ==(Vec3 a, Vec3 b) => a.Equals(b);

        public static bool operator !=(Vec3 a, Vec3 b) => !a.Equals(b);

        public static float Dot(Vec3 a, Vec3 b) => (a.X * b.X) + (a.Y * b.Y) + (a.Z * b.Z);

        public static Vec3 Cross(Vec3 a, Vec3 b) => new Vec3(
            (a.Y * b.Z) - (a.Z * b.Y),
            (a.Z * b.X) - (a.X * b.Z),
            (a.X * b.Y) - (a.Y * b.X));

        public static float Distance(Vec3 a, Vec3 b) => (a - b).Magnitude;

        public static Vec3 Min(Vec3 a, Vec3 b) => new Vec3(
            System.Math.Min(a.X, b.X),
            System.Math.Min(a.Y, b.Y),
            System.Math.Min(a.Z, b.Z));

        public static Vec3 Max(Vec3 a, Vec3 b) => new Vec3(
            System.Math.Max(a.X, b.X),
            System.Math.Max(a.Y, b.Y),
            System.Math.Max(a.Z, b.Z));

        /// <summary>Component-wise multiply. Used for applying a non-uniform scale to a size.</summary>
        public static Vec3 Scale(Vec3 a, Vec3 b) => new Vec3(a.X * b.X, a.Y * b.Y, a.Z * b.Z);

        public static Vec3 Lerp(Vec3 a, Vec3 b, float t)
        {
            t = MathUtil.Clamp01(t);
            return new Vec3(
                a.X + ((b.X - a.X) * t),
                a.Y + ((b.Y - a.Y) * t),
                a.Z + ((b.Z - a.Z) * t));
        }

        /// <summary>
        /// Exact structural equality. Deliberately exact, not tolerant: a tolerant
        /// <c>Equals</c> breaks hashing and makes containers behave unpredictably. Use
        /// <see cref="MathUtil.Approximately(Vec3, Vec3, float)"/> where a tolerance is wanted.
        /// </summary>
        public bool Equals(Vec3 other) =>
            X.Equals(other.X) && Y.Equals(other.Y) && Z.Equals(other.Z);

        public override bool Equals(object obj) => obj is Vec3 other && Equals(other);

        public override int GetHashCode()
        {
            unchecked
            {
                int hash = X.GetHashCode();
                hash = (hash * 397) ^ Y.GetHashCode();
                hash = (hash * 397) ^ Z.GetHashCode();
                return hash;
            }
        }

        public override string ToString() => string.Format(
            CultureInfo.InvariantCulture, "({0:0.###}, {1:0.###}, {2:0.###})", X, Y, Z);
    }
}
