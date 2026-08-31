using ImpactTheory.Core.Math;
using UnityEngine;

namespace ImpactTheory.Runtime.Core
{
    /// <summary>
    /// The boundary between Impact Theory's engine-free core and Unity.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The core deliberately uses its own <see cref="Vec3"/> and <see cref="Quat"/> so that the
    /// rules of the game compile and run without Unity - see
    /// <c>Tests/DotNet/ImpactTheory.CoreTests</c>, which proves them in under 70 ms with no editor
    /// installed. The price of that is this file, and it is a small price: field copies, no
    /// allocation, and no maths.
    /// </para>
    /// <para>
    /// Axis and rotation conventions match Unity exactly (X right, Y up, Z forward; Euler applied
    /// Z then X then Y), so nothing is transposed or re-derived crossing this boundary.
    /// </para>
    /// </remarks>
    public static class UnityConversions
    {
        public static Vector3 ToUnity(this Vec3 v) => new Vector3(v.X, v.Y, v.Z);

        public static Vec3 ToCore(this Vector3 v) => new Vec3(v.x, v.y, v.z);

        public static Quaternion ToUnity(this Quat q) => new Quaternion(q.X, q.Y, q.Z, q.W);

        public static Quat ToCore(this Quaternion q) => new Quat(q.x, q.y, q.z, q.w);

        public static Vector2 ToUnity(this Vec2 v) => new Vector2(v.X, v.Y);

        public static Vec2 ToCore(this Vector2 v) => new Vec2(v.x, v.y);
    }
}
