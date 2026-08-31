using System.Collections.Generic;
using ImpactTheory.Core.Logging;
using ImpactTheory.Physics;
using ImpactTheory.Structure;
using UnityEngine;

namespace ImpactTheory.Runtime.Structure
{
    /// <summary>
    /// Owns the pieces on the platform and answers "is the structure cleared?".
    /// </summary>
    /// <remarks>
    /// <para>
    /// The bridge between the simulation and the win condition. Each evaluation it copies simulated
    /// transforms into the core <see cref="PieceState"/> objects, rebuilds the
    /// <see cref="SupportGraph"/> from the contacts pieces reported, and hands both to
    /// <see cref="OffPlatformEvaluator"/> - which is engine-free and covered by 18 tests.
    /// </para>
    /// <para>
    /// Nothing here decides whether a piece is removed. That separation is what let the rule be
    /// proven before Unity was available at all.
    /// </para>
    /// </remarks>
    public sealed class StructureDirector : MonoBehaviour
    {
        private readonly List<StructurePieceBehaviour> _pieces = new List<StructurePieceBehaviour>();
        private readonly List<PieceState> _states = new List<PieceState>();
        private readonly List<BodyMotion> _motion = new List<BodyMotion>();
        private readonly SupportGraph _support = new SupportGraph();
        private readonly OffPlatformEvaluator _evaluator = new OffPlatformEvaluator();

        public PlatformBehaviour Platform { get; set; }

        public IReadOnlyList<StructurePieceBehaviour> Pieces => _pieces;

        public int PieceCount => _pieces.Count;

        public void Register(StructurePieceBehaviour piece)
        {
            _pieces.Add(piece);
            _states.Add(piece.State);
        }

        /// <summary>Removes every piece from the scene. Called on restart.</summary>
        public void ClearAll()
        {
            foreach (StructurePieceBehaviour piece in _pieces)
            {
                if (piece != null)
                {
                    Destroy(piece.gameObject);
                }
            }

            _pieces.Clear();
            _states.Clear();
            _support.Clear();
        }

        /// <summary>Refreshes core state from the simulation. Call before any evaluation.</summary>
        public void SyncFromSimulation()
        {
            _support.Clear();

            for (int i = 0; i < _pieces.Count; i++)
            {
                StructurePieceBehaviour piece = _pieces[i];
                if (piece == null)
                {
                    continue;
                }

                piece.SyncStateFromTransform();

                foreach (string supporter in piece.Supporters)
                {
                    _support.AddSupport(piece.State.PieceId, supporter);
                }
            }
        }

        /// <summary>The motion of every tracked body, for the settling rule.</summary>
        public IReadOnlyList<BodyMotion> GetMotion()
        {
            _motion.Clear();
            for (int i = 0; i < _pieces.Count; i++)
            {
                if (_pieces[i] != null)
                {
                    _motion.Add(_pieces[i].GetMotion());
                }
            }

            return _motion;
        }

        /// <summary>How many required pieces are still on the platform.</summary>
        public int CountRemaining()
        {
            if (Platform == null)
            {
                return _states.Count;
            }

            return _evaluator.CountRemaining(_states, Platform.Bounds, _support);
        }

        /// <summary>
        /// The win condition: every required piece has left the platform.
        /// </summary>
        /// <remarks>
        /// Delegates entirely to <see cref="OffPlatformEvaluator"/>. Addendum 005 §6 fixes this
        /// rule, and re-implementing any part of it here would be exactly the reinterpretation that
        /// forbids.
        /// </remarks>
        public bool IsCleared() =>
            Platform != null && _evaluator.IsStructureCleared(_states, Platform.Bounds, _support);

        /// <summary>Per-piece verdicts, for logging and the debug overlay.</summary>
        public List<RemovalVerdict> EvaluateAll() =>
            Platform == null
                ? new List<RemovalVerdict>()
                : _evaluator.EvaluateAll(_states, Platform.Bounds, _support);

        /// <summary>
        /// Writes the current verdict for every piece to the log.
        /// </summary>
        /// <remarks>
        /// Logged at shot resolution, because that is the moment the level is decided and the
        /// moment a disagreement about a verdict actually matters. Each line explains itself,
        /// including the support chain that kept a piece in play, which is what
        /// <c>Docs/Logging.md</c> §6 asks for.
        /// </remarks>
        public void LogVerdicts()
        {
            List<RemovalVerdict> verdicts = EvaluateAll();
            int remaining = 0;

            foreach (RemovalVerdict verdict in verdicts)
            {
                if (!verdict.IsRemoved)
                {
                    remaining++;
                }

                Log.Debug(LogCategory.Structure, verdict.Describe());
            }

            Log.Info(LogCategory.Structure, "structure evaluated", Log.Context(
                "pieces", verdicts.Count.ToString(),
                "remaining", remaining.ToString(),
                "cleared", (remaining == 0).ToString()));
        }
    }
}
