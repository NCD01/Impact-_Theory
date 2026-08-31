namespace ImpactTheory.Core.Math
{
    /// <summary>
    /// Scalar helpers shared across the Impact Theory core.
    /// </summary>
    /// <remarks>
    /// Mirrors the handful of <c>UnityEngine.Mathf</c> members the game rules actually need, so
    /// that the core stays free of <c>UnityEngine</c> and remains testable outside the editor.
    /// </remarks>
    public static class MathUtil
    {
        /// <summary>
        /// Tolerance for treating two lengths as equal, in metres.
        /// </summary>
        /// <remarks>
        /// 1e-5 m is 10 microns. That is far below any distance the game cares about - the
        /// tightest tolerance anywhere in the asset pipeline is 0.002 SU - while still being
        /// comfortably above the noise floor of single-precision arithmetic at the scale of a
        /// platform a few tens of metres across.
        /// </remarks>
        public const float Epsilon = 1e-5f;

        public const float Deg2Rad = 0.0174532924f;
        public const float Rad2Deg = 57.29578f;

        public static float Abs(float v) => v < 0f ? -v : v;

        public static float Min(float a, float b) => a < b ? a : b;

        public static float Max(float a, float b) => a > b ? a : b;

        public static float Clamp(float v, float lo, float hi)
        {
            if (v < lo)
            {
                return lo;
            }

            return v > hi ? hi : v;
        }

        public static float Clamp01(float v) => Clamp(v, 0f, 1f);

        public static int ClampInt(int v, int lo, int hi)
        {
            if (v < lo)
            {
                return lo;
            }

            return v > hi ? hi : v;
        }

        public static float Sqrt(float v) => (float)System.Math.Sqrt(v);

        public static float Sin(float radians) => (float)System.Math.Sin(radians);

        public static float Cos(float radians) => (float)System.Math.Cos(radians);

        public static float Atan2(float y, float x) => (float)System.Math.Atan2(y, x);

        public static float Lerp(float a, float b, float t) => a + ((b - a) * Clamp01(t));

        /// <summary>Linear remap of <paramref name="v"/> from one range to another, clamped.</summary>
        public static float Remap(float v, float fromLo, float fromHi, float toLo, float toHi)
        {
            float span = fromHi - fromLo;
            if (Abs(span) < Epsilon)
            {
                return toLo;
            }

            return Lerp(toLo, toHi, (v - fromLo) / span);
        }

        public static bool Approximately(float a, float b, float tolerance = Epsilon) =>
            Abs(a - b) <= tolerance;

        public static bool Approximately(Vec2 a, Vec2 b, float tolerance = Epsilon) =>
            Approximately(a.X, b.X, tolerance) && Approximately(a.Y, b.Y, tolerance);

        public static bool Approximately(Vec3 a, Vec3 b, float tolerance = Epsilon) =>
            Approximately(a.X, b.X, tolerance) &&
            Approximately(a.Y, b.Y, tolerance) &&
            Approximately(a.Z, b.Z, tolerance);
    }
}
