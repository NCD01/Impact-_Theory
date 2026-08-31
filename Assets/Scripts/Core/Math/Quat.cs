using System;
using System.Globalization;

namespace ImpactTheory.Core.Math
{
    /// <summary>
    /// A unit quaternion describing an orientation in Impact Theory world space.
    /// </summary>
    /// <remarks>
    /// Kept deliberately compatible with <c>UnityEngine.Quaternion</c> in both component layout
    /// and Euler convention, so that converting at the Unity boundary is a straight field copy and
    /// an orientation authored in the inspector means the same thing here. Divergence in rotation
    /// convention is the kind of bug that shows up as a piece lying on its side only in a built
    /// player, so it is worth matching exactly rather than approximately.
    /// </remarks>
    [Serializable]
    public struct Quat : IEquatable<Quat>
    {
        public float X;
        public float Y;
        public float Z;
        public float W;

        public Quat(float x, float y, float z, float w)
        {
            X = x;
            Y = y;
            Z = z;
            W = w;
        }

        public static Quat Identity => new Quat(0f, 0f, 0f, 1f);

        public float SqrMagnitude => (X * X) + (Y * Y) + (Z * Z) + (W * W);

        public float Magnitude => MathUtil.Sqrt(SqrMagnitude);

        public Quat Normalized
        {
            get
            {
                float m = Magnitude;
                if (m < MathUtil.Epsilon)
                {
                    return Identity;
                }

                return new Quat(X / m, Y / m, Z / m, W / m);
            }
        }

        /// <summary>The inverse rotation. Valid for unit quaternions, which is all this type holds.</summary>
        public Quat Conjugate => new Quat(-X, -Y, -Z, W);

        /// <summary>
        /// A rotation about an arbitrary axis.
        /// </summary>
        public static Quat FromAxisAngle(Vec3 axis, float degrees)
        {
            Vec3 n = axis.Normalized;
            float half = degrees * MathUtil.Deg2Rad * 0.5f;
            float s = MathUtil.Sin(half);
            return new Quat(n.X * s, n.Y * s, n.Z * s, MathUtil.Cos(half));
        }

        /// <summary>
        /// Euler angles in degrees, using Unity's convention.
        /// </summary>
        /// <remarks>
        /// Unity applies Z, then X, then Y, which composes as <c>Ry * Rx * Rz</c>. Getting this
        /// order wrong produces rotations that look correct for single-axis cases and quietly wrong
        /// for combined ones - exactly the cases a laid-down or rotated structural piece hits.
        /// </remarks>
        public static Quat FromEuler(float xDegrees, float yDegrees, float zDegrees)
        {
            Quat qx = FromAxisAngle(Vec3.Right, xDegrees);
            Quat qy = FromAxisAngle(Vec3.Up, yDegrees);
            Quat qz = FromAxisAngle(Vec3.Forward, zDegrees);
            return qy * qx * qz;
        }

        public static Quat FromEuler(Vec3 degrees) => FromEuler(degrees.X, degrees.Y, degrees.Z);

        /// <summary>Hamilton product. <c>a * b</c> applies <paramref name="b"/> first.</summary>
        public static Quat operator *(Quat a, Quat b) => new Quat(
            (a.W * b.X) + (a.X * b.W) + (a.Y * b.Z) - (a.Z * b.Y),
            (a.W * b.Y) - (a.X * b.Z) + (a.Y * b.W) + (a.Z * b.X),
            (a.W * b.Z) + (a.X * b.Y) - (a.Y * b.X) + (a.Z * b.W),
            (a.W * b.W) - (a.X * b.X) - (a.Y * b.Y) - (a.Z * b.Z));

        /// <summary>
        /// Rotates a vector.
        /// </summary>
        /// <remarks>
        /// Uses the standard <c>t = 2 * cross(q.xyz, v); v' = v + q.w * t + cross(q.xyz, t)</c>
        /// form rather than <c>q * v * q'</c>. Same result, fewer operations, and it is called once
        /// per corner per piece per evaluation.
        /// </remarks>
        public static Vec3 operator *(Quat q, Vec3 v)
        {
            Vec3 u = new Vec3(q.X, q.Y, q.Z);
            Vec3 t = Vec3.Cross(u, v) * 2f;
            return v + (t * q.W) + Vec3.Cross(u, t);
        }

        public static bool operator ==(Quat a, Quat b) => a.Equals(b);

        public static bool operator !=(Quat a, Quat b) => !a.Equals(b);

        public bool Equals(Quat other) =>
            X.Equals(other.X) && Y.Equals(other.Y) && Z.Equals(other.Z) && W.Equals(other.W);

        public override bool Equals(object obj) => obj is Quat other && Equals(other);

        public override int GetHashCode()
        {
            unchecked
            {
                int hash = X.GetHashCode();
                hash = (hash * 397) ^ Y.GetHashCode();
                hash = (hash * 397) ^ Z.GetHashCode();
                hash = (hash * 397) ^ W.GetHashCode();
                return hash;
            }
        }

        public override string ToString() => string.Format(
            CultureInfo.InvariantCulture, "({0:0.###}, {1:0.###}, {2:0.###}, {3:0.###})", X, Y, Z, W);
    }
}
