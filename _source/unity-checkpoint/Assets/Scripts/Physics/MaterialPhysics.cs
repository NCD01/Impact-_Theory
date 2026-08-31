using System.Collections.Generic;
using ImpactTheory.Core;

namespace ImpactTheory.Physics
{
    /// <summary>
    /// The physical properties of one material family.
    /// </summary>
    /// <remarks>
    /// Values are data, never hard-coded per prefab (<c>Docs/Physics.md</c> §5, §10). Changing any
    /// of them is a gameplay change and requires bumping
    /// <see cref="PhysicsConfig.PhysicsConfigVersion"/>, because recorded calibration and stability
    /// results are only meaningful against a known configuration (Addendum 002 §3).
    /// </remarks>
    public sealed class MaterialPhysics
    {
        public MaterialPhysics(
            MaterialFamily family,
            float density,
            float solidFraction,
            float staticFriction,
            float dynamicFriction,
            float restitution)
        {
            Family = family;
            Density = density;
            SolidFraction = solidFraction;
            StaticFriction = staticFriction;
            DynamicFriction = dynamicFriction;
            Restitution = restitution;
        }

        public MaterialFamily Family { get; }

        /// <summary>True bulk density of the material, kg/m³.</summary>
        public float Density { get; }

        /// <summary>
        /// The fraction of a piece's enclosed volume that is actually material.
        /// </summary>
        /// <remarks>
        /// <para>
        /// This is the "effective density term for metals" that <c>Docs/Physics.md</c> §4
        /// anticipated, introduced as data with its reason recorded rather than as a quiet edit to
        /// geometry.
        /// </para>
        /// <para>
        /// The problem it solves is real: a solid steel <c>B05_LARGE_BLOCK</c> at 2 x 2 x 1 m would
        /// mass 31 400 kg, which the specification itself calls "physically correct and probably
        /// unplayable". The resolution is not to lie about steel's density but to be accurate about
        /// what a steel structural member is. Real structural steel is hollow section, I-beam, or
        /// plate - not a solid billet. A welded box section is roughly a quarter material by
        /// enclosed volume, so <c>0.25</c> is a physically defensible figure rather than a fudge,
        /// and it keeps <c>Mass = Volume × Density</c> intact as the governing relationship.
        /// </para>
        /// <para>
        /// Masonry and timber pieces are genuinely solid, so their fraction is 1.
        /// </para>
        /// </remarks>
        public float SolidFraction { get; }

        /// <summary>Density actually used for mass, kg/m³.</summary>
        public float EffectiveDensity => Density * SolidFraction;

        public float StaticFriction { get; }

        public float DynamicFriction { get; }

        public float Restitution { get; }

        /// <summary>
        /// The starting table from <c>Docs/Physics.md</c> §4 and §5.
        /// </summary>
        /// <remarks>
        /// <strong>Documented assumption, reversible (<c>ASM-01</c>, <c>ASM-02</c>).</strong> These
        /// are textbook nominal values, not gameplay-tuned ones. They exist so calibration starts
        /// somewhere coherent instead of somewhere arbitrary. The real values are whatever the
        /// calibration scene proves plays well, and because they live here they can be replaced
        /// without touching a line of gameplay code.
        /// </remarks>
        public static IReadOnlyDictionary<MaterialFamily, MaterialPhysics> CreateDefaultTable()
        {
            Dictionary<MaterialFamily, MaterialPhysics> table =
                new Dictionary<MaterialFamily, MaterialPhysics>();

            void Add(MaterialFamily family, float density, float solidFraction,
                float staticFriction, float dynamicFriction, float restitution)
            {
                table[family] = new MaterialPhysics(
                    family, density, solidFraction, staticFriction, dynamicFriction, restitution);
            }

            //   family                 density  solid   static  dynamic  restitution
            Add(MaterialFamily.Wood, 700f, 1.00f, 0.50f, 0.40f, 0.15f);
            Add(MaterialFamily.Brick, 1900f, 1.00f, 0.70f, 0.60f, 0.10f);
            Add(MaterialFamily.Stone, 2600f, 1.00f, 0.70f, 0.60f, 0.10f);
            Add(MaterialFamily.Concrete, 2400f, 1.00f, 0.75f, 0.65f, 0.10f);
            Add(MaterialFamily.Steel, 7850f, 0.25f, 0.35f, 0.30f, 0.25f);
            Add(MaterialFamily.PaintedSteel, 7850f, 0.25f, 0.40f, 0.35f, 0.25f);
            Add(MaterialFamily.Rubber, 1100f, 1.00f, 1.00f, 0.90f, 0.70f);

            return table;
        }

        public override string ToString() =>
            $"{Family}: {EffectiveDensity:0} kg/m3 effective, friction {StaticFriction:0.##}/" +
            $"{DynamicFriction:0.##}, restitution {Restitution:0.##}";
    }
}
