namespace ImpactTheory.Core
{
    /// <summary>
    /// The seven approved material families.
    /// </summary>
    /// <remarks>
    /// <para>
    /// These match the families in the V2 material library
    /// (<c>Assets/Art/Materials/V2/material_library_manifest_v2.json</c>) by name, and that is the
    /// only thing they share with it.
    /// </para>
    /// <para>
    /// <strong>Visual material identity and physics material identity are separate concerns</strong>
    /// (<c>Docs/Physics.md</c> §4, Addendum 005 §9). A piece rendered with the V2 wood shader does
    /// not thereby have wood's density, friction, or restitution - the development agent owns those
    /// numbers and the design agent owns the look. <c>Docs/GameDesign.md</c> §30 requires geometry
    /// and material to stay independent so the asset library does not multiply: one
    /// <c>LONG_BEAM</c> mesh can be wood, steel, or stone by data alone.
    /// </para>
    /// <para>
    /// This enum lives in <c>Core</c> rather than in <c>Physics</c> because it is shared vocabulary.
    /// <c>Structure</c> needs it to say what a piece is made of, and <c>Docs/Architecture.md</c> §3
    /// does not permit <c>Structure</c> to depend on <c>Physics</c>. The physical <em>values</em>
    /// attached to each family live in <c>ImpactTheory.Physics.MaterialPhysics</c>, which is
    /// correctly the physics layer's business.
    /// </para>
    /// </remarks>
    public enum MaterialFamily
    {
        Wood = 0,
        Brick = 1,
        Stone = 2,
        Concrete = 3,
        Steel = 4,
        PaintedSteel = 5,
        Rubber = 6,
    }
}
