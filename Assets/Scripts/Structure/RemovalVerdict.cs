using System.Collections.Generic;

namespace ImpactTheory.Structure
{
    /// <summary>Why a piece was or was not judged removed.</summary>
    public enum RemovalReason
    {
        /// <summary>Both conditions met: footprint fully clear of the boundary, and unsupported.</summary>
        Removed = 0,

        /// <summary>Part of the footprint still lies over the platform.</summary>
        FootprintStillOverPlatform = 1,

        /// <summary>Footprint is clear, but the platform still carries the piece through a support chain.</summary>
        StillSupportedByPlatform = 2,

        /// <summary>Neither condition met.</summary>
        OverPlatformAndSupported = 3,
    }

    /// <summary>
    /// The result of applying the off-platform rule to one piece.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Carries both conditions separately rather than a bare boolean, because the rule is a
    /// conjunction and the interesting failures are the ones where a tester and the game disagree
    /// about <em>which half</em> is unsatisfied. <c>Docs/Logging.md</c> §6 asks logs to answer "why
    /// did it do that?", and a verdict that only says "not removed" cannot.
    /// </para>
    /// <para>
    /// The support chain is captured when the piece is still supported, so the debug overlay can
    /// draw the exact path back to the platform.
    /// </para>
    /// </remarks>
    public readonly struct RemovalVerdict
    {
        public RemovalVerdict(
            string pieceId,
            bool footprintClearOfPlatform,
            bool supportedByPlatform,
            IReadOnlyList<string> supportChain)
        {
            PieceId = pieceId;
            FootprintClearOfPlatform = footprintClearOfPlatform;
            SupportedByPlatform = supportedByPlatform;
            SupportChain = supportChain ?? System.Array.Empty<string>();
        }

        public string PieceId { get; }

        /// <summary>Condition 1: the entire footprint has crossed the platform boundary.</summary>
        public bool FootprintClearOfPlatform { get; }

        /// <summary>Condition 2 (inverted): the platform still carries this piece.</summary>
        public bool SupportedByPlatform { get; }

        /// <summary>The chain from this piece to the platform, when one exists.</summary>
        public IReadOnlyList<string> SupportChain { get; }

        /// <summary>
        /// Removed only when both conditions hold. Both, never either
        /// (<c>Docs/Physics.md</c> §8, Addendum 005 §6).
        /// </summary>
        public bool IsRemoved => FootprintClearOfPlatform && !SupportedByPlatform;

        public RemovalReason Reason
        {
            get
            {
                if (IsRemoved)
                {
                    return RemovalReason.Removed;
                }

                if (!FootprintClearOfPlatform && SupportedByPlatform)
                {
                    return RemovalReason.OverPlatformAndSupported;
                }

                return FootprintClearOfPlatform
                    ? RemovalReason.StillSupportedByPlatform
                    : RemovalReason.FootprintStillOverPlatform;
            }
        }

        /// <summary>A one-line explanation suitable for a log record or the debug overlay.</summary>
        public string Describe()
        {
            switch (Reason)
            {
                case RemovalReason.Removed:
                    return $"{PieceId}: removed - footprint clear of the platform and unsupported";

                case RemovalReason.FootprintStillOverPlatform:
                    return $"{PieceId}: not removed - footprint still overlaps the platform boundary";

                case RemovalReason.StillSupportedByPlatform:
                    return $"{PieceId}: not removed - footprint is clear but the platform still " +
                           $"supports it via {string.Join(" -> ", SupportChain)}";

                default:
                    return $"{PieceId}: not removed - still over the platform and still supported";
            }
        }

        public override string ToString() => Describe();
    }
}
