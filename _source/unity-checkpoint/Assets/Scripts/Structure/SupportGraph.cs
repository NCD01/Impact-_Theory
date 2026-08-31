using System.Collections.Generic;

namespace ImpactTheory.Structure
{
    /// <summary>
    /// Records which pieces hold up which, so the second half of the off-platform rule can be answered.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The off-platform rule (<c>Docs/Physics.md</c> §8) needs to know whether a piece is "no longer
    /// physically supported by the platform" - and the specification is explicit that support counts
    /// "directly or through another piece resting on it". That is a reachability question, so this
    /// models it as a directed graph and answers it by traversal.
    /// </para>
    /// <para>
    /// <strong>Edges are directed, and the direction matters.</strong> An edge means "A is held up by
    /// B", not merely "A touches B". Two pieces that have fallen off the platform and come to rest
    /// leaning against each other touch constantly, and if contact alone implied support then any one
    /// of them brushing a piece still on the platform would make the whole pile count as supported -
    /// and the level would never complete. The Unity layer derives direction from contact normals,
    /// so a side-by-side graze produces no edge at all.
    /// </para>
    /// <para>
    /// Cycles are possible and are handled. Two pieces genuinely propping each other up form a
    /// two-cycle, and the traversal's visited set stops it from looping.
    /// </para>
    /// </remarks>
    public sealed class SupportGraph
    {
        private readonly Dictionary<string, HashSet<string>> _supportedBy =
            new Dictionary<string, HashSet<string>>();

        /// <summary>
        /// Records that <paramref name="supportedPieceId"/> is held up by
        /// <paramref name="supporterId"/>.
        /// </summary>
        /// <param name="supportedPieceId">The piece resting on something.</param>
        /// <param name="supporterId">
        /// What it rests on: another piece's id, or <see cref="PlatformBounds.NodeId"/> for the
        /// platform itself.
        /// </param>
        public void AddSupport(string supportedPieceId, string supporterId)
        {
            if (string.IsNullOrEmpty(supportedPieceId) || string.IsNullOrEmpty(supporterId))
            {
                return;
            }

            // A piece cannot hold itself up. Contact resolution can briefly report this during a
            // collapse, and letting it through would make the piece permanently "supported".
            if (supportedPieceId == supporterId)
            {
                return;
            }

            if (!_supportedBy.TryGetValue(supportedPieceId, out HashSet<string> supporters))
            {
                supporters = new HashSet<string>();
                _supportedBy[supportedPieceId] = supporters;
            }

            supporters.Add(supporterId);
        }

        /// <summary>Convenience for the common case of a piece resting directly on the platform.</summary>
        public void AddPlatformSupport(string supportedPieceId) =>
            AddSupport(supportedPieceId, PlatformBounds.NodeId);

        /// <summary>What directly holds this piece up. Empty if nothing does.</summary>
        public IReadOnlyCollection<string> GetDirectSupporters(string pieceId)
        {
            if (pieceId != null && _supportedBy.TryGetValue(pieceId, out HashSet<string> supporters))
            {
                return supporters;
            }

            return System.Array.Empty<string>();
        }

        /// <summary>
        /// True when a chain of support leads from this piece to the platform.
        /// </summary>
        /// <remarks>
        /// Breadth-first from the piece. The traversal is over the "held up by" edges, so reaching
        /// <see cref="PlatformBounds.NodeId"/> means the platform is ultimately carrying this
        /// piece's weight - which is exactly the condition the rule asks about.
        /// </remarks>
        public bool IsSupportedByPlatform(string pieceId)
        {
            if (string.IsNullOrEmpty(pieceId))
            {
                return false;
            }

            HashSet<string> visited = new HashSet<string> { pieceId };
            Queue<string> pending = new Queue<string>();
            pending.Enqueue(pieceId);

            while (pending.Count > 0)
            {
                string current = pending.Dequeue();

                if (!_supportedBy.TryGetValue(current, out HashSet<string> supporters))
                {
                    continue;
                }

                foreach (string supporter in supporters)
                {
                    if (supporter == PlatformBounds.NodeId)
                    {
                        return true;
                    }

                    if (visited.Add(supporter))
                    {
                        pending.Enqueue(supporter);
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// The full chain from a piece to the platform, or an empty list when it is unsupported.
        /// </summary>
        /// <remarks>
        /// This exists for the debug overlay and for logging. <c>Docs/Logging.md</c> §6 makes the
        /// point that "physics settled" is nearly useless while a record that explains the decision
        /// is what diagnoses a bug - and when a tester disagrees with a removal verdict, the useful
        /// artefact is the exact chain that was still holding the piece up.
        /// </remarks>
        public IReadOnlyList<string> GetSupportChainToPlatform(string pieceId)
        {
            if (string.IsNullOrEmpty(pieceId))
            {
                return System.Array.Empty<string>();
            }

            Dictionary<string, string> cameFrom = new Dictionary<string, string>();
            HashSet<string> visited = new HashSet<string> { pieceId };
            Queue<string> pending = new Queue<string>();
            pending.Enqueue(pieceId);

            while (pending.Count > 0)
            {
                string current = pending.Dequeue();

                if (!_supportedBy.TryGetValue(current, out HashSet<string> supporters))
                {
                    continue;
                }

                foreach (string supporter in supporters)
                {
                    if (supporter == PlatformBounds.NodeId)
                    {
                        cameFrom[PlatformBounds.NodeId] = current;
                        return BuildChain(cameFrom, pieceId);
                    }

                    if (visited.Add(supporter))
                    {
                        cameFrom[supporter] = current;
                        pending.Enqueue(supporter);
                    }
                }
            }

            return System.Array.Empty<string>();
        }

        /// <summary>Drops every recorded edge. Called when a shot begins to resolve.</summary>
        public void Clear() => _supportedBy.Clear();

        /// <summary>Number of pieces with at least one recorded supporter.</summary>
        public int TrackedPieceCount => _supportedBy.Count;

        private static IReadOnlyList<string> BuildChain(
            IReadOnlyDictionary<string, string> cameFrom, string origin)
        {
            List<string> reversed = new List<string> { PlatformBounds.NodeId };
            string cursor = PlatformBounds.NodeId;

            while (cameFrom.TryGetValue(cursor, out string previous))
            {
                reversed.Add(previous);
                if (previous == origin)
                {
                    break;
                }

                cursor = previous;
            }

            reversed.Reverse();
            return reversed;
        }
    }
}
