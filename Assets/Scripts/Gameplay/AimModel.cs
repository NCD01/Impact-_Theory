using ImpactTheory.Core.Math;

namespace ImpactTheory.Gameplay
{
    /// <summary>
    /// The player's aim, expressed in world terms rather than screen terms.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Docs/GameDesign.md</c> §22 requires aiming to be implemented independently of any one
    /// device, and says plainly: "Do not couple projectile physics directly to screen coordinates."
    /// So the aim is two angles and a normalised power, and a mouse drag, an arrow key, and a
    /// finger swipe all do the same thing to them - they nudge yaw, pitch, and power. The launch
    /// velocity that comes out is the same regardless of which one moved it.
    /// </para>
    /// <para>
    /// Being engine-free, this is also directly testable, which matters because the mapping from
    /// power to speed is the difference between a shot that topples a tower and one that bounces
    /// off it.
    /// </para>
    /// </remarks>
    public sealed class AimModel
    {
        /// <summary>Lowest pitch the player can aim, degrees. Below this the ball hits the ground immediately.</summary>
        public const float MinPitchDegrees = -10f;

        /// <summary>Highest pitch the player can aim, degrees.</summary>
        public const float MaxPitchDegrees = 60f;

        private float _yawDegrees;
        private float _pitchDegrees = 12f;
        private float _power = 0.6f;

        /// <summary>Rotation about world Y, degrees. Zero aims along +Z.</summary>
        public float YawDegrees
        {
            get => _yawDegrees;
            set => _yawDegrees = Wrap(value);
        }

        /// <summary>Elevation above the horizon, degrees, clamped to the usable range.</summary>
        public float PitchDegrees
        {
            get => _pitchDegrees;
            set => _pitchDegrees = MathUtil.Clamp(value, MinPitchDegrees, MaxPitchDegrees);
        }

        /// <summary>Launch power, 0 to 1.</summary>
        public float Power
        {
            get => _power;
            set => _power = MathUtil.Clamp01(value);
        }

        /// <summary>Adjusts the aim by a relative amount, which is what every input device produces.</summary>
        public void Adjust(float yawDelta, float pitchDelta)
        {
            YawDegrees = _yawDegrees + yawDelta;
            PitchDegrees = _pitchDegrees + pitchDelta;
        }

        public void AdjustPower(float delta) => Power = _power + delta;

        /// <summary>The unit direction the ball will travel.</summary>
        public Vec3 Direction()
        {
            float yaw = _yawDegrees * MathUtil.Deg2Rad;
            float pitch = _pitchDegrees * MathUtil.Deg2Rad;

            float cosPitch = MathUtil.Cos(pitch);

            return new Vec3(
                MathUtil.Sin(yaw) * cosPitch,
                MathUtil.Sin(pitch),
                MathUtil.Cos(yaw) * cosPitch).Normalized;
        }

        /// <summary>
        /// The launch speed, in metres per second.
        /// </summary>
        /// <remarks>
        /// Power maps linearly onto the range between the configured minimum and maximum. Linear
        /// rather than squared, so that the power bar reads as what it does: half the bar is half
        /// the speed. A squared curve makes the low half of the bar feel dead, and this game asks
        /// the player to reason about momentum.
        /// <para>
        /// The minimum is not zero, because a zero-power shot would spend a ball for nothing
        /// (<c>Docs/GameDesign.md</c> §23 makes every ball count).
        /// </para>
        /// </remarks>
        public float Speed(float minSpeed, float maxSpeed) =>
            MathUtil.Lerp(minSpeed, maxSpeed, _power);

        /// <summary>The launch velocity: direction times speed.</summary>
        public Vec3 Velocity(float minSpeed, float maxSpeed) =>
            Direction() * Speed(minSpeed, maxSpeed);

        /// <summary>
        /// Samples the ballistic path the ball will follow, for the trajectory preview.
        /// </summary>
        /// <remarks>
        /// Pure projectile motion under gravity - no drag, because the ball has none. This is the
        /// path the ball takes until it hits something, which is exactly what a preview should
        /// promise and no more. Extending the preview through collisions would be a prediction the
        /// simulation is not obliged to honour.
        /// </remarks>
        public Vec3[] SampleTrajectory(
            Vec3 origin, float minSpeed, float maxSpeed, Vec3 gravity, int samples, float duration)
        {
            if (samples < 2)
            {
                samples = 2;
            }

            Vec3 velocity = Velocity(minSpeed, maxSpeed);
            Vec3[] points = new Vec3[samples];
            float step = duration / (samples - 1);

            for (int i = 0; i < samples; i++)
            {
                float t = step * i;
                points[i] = origin + (velocity * t) + (gravity * (0.5f * t * t));
            }

            return points;
        }

        public void Reset()
        {
            _yawDegrees = 0f;
            _pitchDegrees = 12f;
            _power = 0.6f;
        }

        private static float Wrap(float degrees)
        {
            while (degrees > 180f)
            {
                degrees -= 360f;
            }

            while (degrees < -180f)
            {
                degrees += 360f;
            }

            return degrees;
        }

        public override string ToString() =>
            $"aim yaw={_yawDegrees:0.#} pitch={_pitchDegrees:0.#} power={_power:0.##}";
    }
}
