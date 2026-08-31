using System.Collections.Generic;
using ImpactTheory.Core.Math;

namespace ImpactTheory.Structure
{
    /// <summary>
    /// Applies the off-platform rule, which decides when the level is won.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <strong>This rule is fixed and must not be reinterpreted</strong> (Addendum 005 §6,
    /// <c>Docs/Physics.md</c> §8). A required structural piece counts as removed only when
    /// <em>both</em> hold:
    /// </para>
    /// <list type="number">
    ///   <item><description>its entire footprint has crossed the platform boundary, and</description></item>
    ///   <item><description>it is no longer physically supported by the platform.</description></item>
    /// </list>
    /// <para>
    /// Both, not either. There is no percentage-of-destruction threshold and no hit-point total.
    /// The two conditions are not redundant, and the two cases that prove it are worth stating: a
    /// piece can be geometrically clear of the boundary while still leaning on something the
    /// platform holds up, and a piece can leave the platform and bounce back onto it. The first is
    /// caught by condition 2, the second by evaluating settled state rather than peak trajectory.
    /// </para>
    /// <para>
    /// Evaluation is world-space geometry throughout. No camera, no screen position, no centre-point
    /// shortcut - a centre-point test would call a 90% overhang removed, and the specification says
    /// plainly that it is not.
    /// </para>
    /// </remarks>
    public sealed class OffPlatformEvaluator
    {
        private readonly float _tolerance;

        /// <param name="tolerance">
        /// Overlap tolerance in metres. Biases borderline cases toward "still on the platform",
        /// which is the safe direction: a piece wrongly judged present costs one more shot, while a
        /// piece wrongly judged removed completes a level with a block still sitting on the
        /// platform.
        /// </param>
        public OffPlatformEvaluator(float tolerance = MathUtil.Epsilon)
        {
            _tolerance = tolerance;
        }

        /// <summary>Applies the rule to a single piece.</summary>
        public RemovalVerdict Evaluate(PieceState piece, PlatformBounds platform, SupportGraph support)
        {
            if (piece == null || platform == null)
            {
                return new RemovalVerdict(piece?.PieceId ?? "?", false, true, null);
            }

            bool footprintClear = !FootprintOverlapsPlatform(piece, platform);

            bool supported = support != null && support.IsSupportedByPlatform(piece.PieceId);

            IReadOnlyList<string> chain = supported
                ? support.GetSupportChainToPlatform(piece.PieceId)
                : System.Array.Empty<string>();

            return new RemovalVerdict(piece.PieceId, footprintClear, supported, chain);
        }

        /// <summary>
        /// Condition 1: does any part of the piece's footprint still lie over the platform?
        /// </summary>
        /// <remarks>
        /// A compound piece is tested part by part and the answers combined with OR. The union of a
        /// compound piece's shadows is generally concave - an upright arch has an opening under its
        /// span - so testing the parts individually is both simpler and more accurate than hulling
        /// them together, which would fill the opening in and make the arch look wider than it is.
        /// </remarks>
        public bool FootprintOverlapsPlatform(PieceState piece, PlatformBounds platform)
        {
            ConvexPolygon2D platformFootprint = platform.GetFootprint();
            OrientedBox[] worldColliders = piece.GetWorldColliders();

            platformFootprint.GetBounds(out Vec2 platformMin, out Vec2 platformMax);

            for (int i = 0; i < worldColliders.Length; i++)
            {
                ConvexPolygon2D pieceFootprint = worldColliders[i].GetFootprint();

                // Cheap axis-aligned rejection before the full separating-axis test. Most pieces in
                // a cleared level are far off the platform, so this is the common path.
                pieceFootprint.GetBounds(out Vec2 pieceMin, out Vec2 pieceMax);
                if (pieceMin.X > platformMax.X + _tolerance ||
                    pieceMax.X < platformMin.X - _tolerance ||
                    pieceMin.Y > platformMax.Y + _tolerance ||
                    pieceMax.Y < platformMin.Y - _tolerance)
                {
                    continue;
                }

                if (ConvexPolygon2D.Overlaps(pieceFootprint, platformFootprint, _tolerance))
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>Applies the rule to every piece in a structure.</summary>
        public List<RemovalVerdict> EvaluateAll(
            IReadOnlyList<PieceState> pieces, PlatformBounds platform, SupportGraph support)
        {
            List<RemovalVerdict> verdicts = new List<RemovalVerdict>(pieces.Count);
            for (int i = 0; i < pieces.Count; i++)
            {
                verdicts.Add(Evaluate(pieces[i], platform, support));
            }

            return verdicts;
        }

        /// <summary>
        /// The win condition: every <em>required</em> piece has left the platform.
        /// </summary>
        /// <remarks>
        /// <c>Docs/GameDesign.md</c> §10 - "If one required structural piece remains supported by
        /// the platform, the level remains incomplete." No threshold, no percentage.
        /// </remarks>
        public bool IsStructureCleared(
            IReadOnlyList<PieceState> pieces, PlatformBounds platform, SupportGraph support)
        {
            for (int i = 0; i < pieces.Count; i++)
            {
                PieceState piece = pieces[i];
                if (!piece.IsRequired)
                {
                    continue;
                }

                if (!Evaluate(piece, platform, support).IsRemoved)
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>How many required pieces are still on the platform.</summary>
        public int CountRemaining(
            IReadOnlyList<PieceState> pieces, PlatformBounds platform, SupportGraph support)
        {
            int remaining = 0;
            for (int i = 0; i < pieces.Count; i++)
            {
                PieceState piece = pieces[i];
                if (!piece.IsRequired)
                {
                    continue;
                }

                if (!Evaluate(piece, platform, support).IsRemoved)
                {
                    remaining++;
                }
            }

            return remaining;
        }
    }
}
