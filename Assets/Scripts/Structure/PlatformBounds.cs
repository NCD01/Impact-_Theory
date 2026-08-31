using ImpactTheory.Core.Math;

namespace ImpactTheory.Structure
{
    /// <summary>
    /// The playable platform: the volume a structure is built on and must be cleared from.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Docs/GameDesign.md</c> §12 requires the platform to carry a defined width, depth, height,
    /// world-space boundary, collision surface, and detection region. This type is the boundary and
    /// the detection region; Unity owns the collision surface.
    /// </para>
    /// <para>
    /// The platform is axis-aligned in V1. That is a deliberate simplification, not an oversight:
    /// an axis-aligned rectangle makes the boundary test cheap and, more usefully, makes it obvious
    /// to a tester what the boundary is. A rotated platform is a data change plus a footprint
    /// polygon change, and nothing in the rule itself would need to move.
    /// </para>
    /// <para>
    /// The platform is never itself a structural piece to be removed (<c>Docs/GameDesign.md</c> §12).
    /// </para>
    /// </remarks>
    public sealed class PlatformBounds
    {
        /// <summary>Identifies the platform inside a <see cref="SupportGraph"/>.</summary>
        public const string NodeId = "__PLATFORM__";

        public PlatformBounds(Vec3 centre, float width, float depth, float height)
        {
            Centre = centre;
            Width = width;
            Depth = depth;
            Height = height;
        }

        /// <summary>Centre of the platform volume, not of its top surface.</summary>
        public Vec3 Centre { get; }

        /// <summary>Extent along world X, in metres.</summary>
        public float Width { get; }

        /// <summary>Extent along world Z, in metres.</summary>
        public float Depth { get; }

        /// <summary>Extent along world Y, in metres.</summary>
        public float Height { get; }

        /// <summary>World Y of the surface structures rest on.</summary>
        public float TopY => Centre.Y + (Height * 0.5f);

        public float MinX => Centre.X - (Width * 0.5f);

        public float MaxX => Centre.X + (Width * 0.5f);

        public float MinZ => Centre.Z - (Depth * 0.5f);

        public float MaxZ => Centre.Z + (Depth * 0.5f);

        /// <summary>The platform's horizontal boundary, as the polygon the footprint test runs against.</summary>
        public ConvexPolygon2D GetFootprint() =>
            ConvexPolygon2D.FromRect(
                new Vec2(Centre.X, Centre.Z),
                new Vec2(Width * 0.5f, Depth * 0.5f));

        /// <summary>
        /// The default V1 platform.
        /// </summary>
        /// <remarks>
        /// 12 m x 12 m gives roughly a 12 x 12 grid of 1 SU blocks, which comfortably holds the
        /// manual test structures while leaving clear ground on every side for pieces to land on.
        /// The top surface sits at y = 0 so that a piece placed at y = 0 with a centre-bottom pivot
        /// rests exactly on the platform, which makes hand-authored structures readable.
        /// </remarks>
        public static PlatformBounds CreateDefault() =>
            new PlatformBounds(new Vec3(0f, -0.25f, 0f), 12f, 12f, 0.5f);

        public override string ToString() =>
            $"Platform {Width:0.##}x{Depth:0.##} m, top y={TopY:0.###}";
    }
}
