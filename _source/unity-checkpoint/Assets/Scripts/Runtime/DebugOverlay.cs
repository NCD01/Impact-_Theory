using System.Text;
using ImpactTheory.Core.Logging;
using ImpactTheory.Runtime.Gameplay;
using ImpactTheory.Runtime.Structure;
using ImpactTheory.Structure;
using UnityEngine;

namespace ImpactTheory.Runtime
{
    /// <summary>
    /// The development-only debug overlay.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Surfaces what <c>Docs/Logging.md</c> §5 asks for: structure and piece ids, the platform
    /// boundary, ball velocity, shot count, remaining pieces, physics state, seed, and performance.
    /// </para>
    /// <para>
    /// Two of those carry more weight than the rest. <strong>The platform boundary and each piece's
    /// removal verdict</strong> are the visual explanation of the off-platform rule - when a piece
    /// is judged still supported and a tester disagrees, this overlay is what settles it, because
    /// it prints the actual support chain that kept the piece in play.
    /// </para>
    /// <para>
    /// <strong>Never exposed in production gameplay</strong> (Addendum 005 §10). It is compiled out
    /// of release builds entirely by the <see cref="Available"/> gate, not merely hidden behind a
    /// key, so a curious player cannot reach it.
    /// </para>
    /// </remarks>
    [RequireComponent(typeof(GameDirector))]
    public sealed class DebugOverlay : MonoBehaviour
    {
        private GameDirector _director;
        private GUIStyle _style;
        private Texture2D _background;
        private bool _visible;
        private bool _showVerdicts;

        private float _frameAccumulator;
        private int _frameSamples;
        private float _displayedFps;

        /// <summary>
        /// True only in a development build or the editor.
        /// </summary>
        /// <remarks>
        /// <c>Debug.isDebugBuild</c> is true in the editor and in a build made with "Development
        /// Build" ticked, and false in a shipping build - which is exactly the line the governance
        /// draws.
        /// </remarks>
        public static bool Available => Debug.isDebugBuild;

        private void Awake()
        {
            _director = GetComponent<GameDirector>();

            if (!Available)
            {
                enabled = false;
            }
        }

        private void OnDestroy() => Destroy(_background);

        private void Update()
        {
            _frameAccumulator += Time.unscaledDeltaTime;
            _frameSamples++;

            if (_frameAccumulator >= 0.25f)
            {
                _displayedFps = _frameSamples / _frameAccumulator;
                _frameAccumulator = 0f;
                _frameSamples = 0;
            }

#if ENABLE_LEGACY_INPUT_MANAGER
            if (UnityEngine.Input.GetKeyDown(KeyCode.F1))
            {
                _visible = !_visible;
            }

            if (UnityEngine.Input.GetKeyDown(KeyCode.F2))
            {
                _showVerdicts = !_showVerdicts;
            }

            if (UnityEngine.Input.GetKeyDown(KeyCode.F3))
            {
                DumpLog();
            }
#endif
        }

        private void OnGUI()
        {
            if (!Available || !_visible)
            {
                return;
            }

            EnsureStyle();

            Rect area = new Rect(Screen.width - 430f, 16f, 414f, _showVerdicts ? 520f : 250f);
            GUI.DrawTexture(area, _background);

            GUI.Label(new Rect(area.x + 12f, area.y + 10f, area.width - 24f, area.height - 20f),
                BuildReport(), _style);
        }

        private string BuildReport()
        {
            StringBuilder report = new StringBuilder(1024);
            StructureDirector structure = _director.Structure;

            report.AppendLine("IMPACT THEORY - DEBUG  (F1 hide, F2 verdicts, F3 dump log)");
            report.AppendLine();

            report.AppendLine($"level        {_director.Level.LevelId}");
            report.AppendLine($"phase        {_director.Level.Phase}");
            report.AppendLine($"seed         {Log.StructureSeed ?? "(authored)"}");
            report.AppendLine($"balls        {_director.Level.Balls}");
            report.AppendLine($"pieces       {_director.RemainingPieces} of {structure.PieceCount} remaining");
            report.AppendLine();

            report.AppendLine($"fps          {_displayedFps:0.#}");
            report.AppendLine($"fixedStep    {Time.fixedDeltaTime:0.####} s");
            report.AppendLine($"bodies       {structure.PieceCount + 1}");
            report.AppendLine($"physicsCfg   v{_director.Config.PhysicsConfigVersion}");
            report.AppendLine($"gravity      {UnityEngine.Physics.gravity.y:0.##} m/s2");
            report.AppendLine($"solver       {UnityEngine.Physics.defaultSolverIterations}");
            report.AppendLine();
            report.AppendLine($"aim          {_director.Aim}");

            if (!_showVerdicts)
            {
                return report.ToString();
            }

            report.AppendLine();
            report.AppendLine("--- off-platform verdicts ---");

            foreach (RemovalVerdict verdict in structure.EvaluateAll())
            {
                report.AppendLine(verdict.IsRemoved
                    ? $"  GONE   {verdict.PieceId}"
                    : $"  ON     {verdict.PieceId}  ({verdict.Reason})");
            }

            return report.ToString();
        }

        /// <summary>
        /// Writes the ring buffer to the console so a tester can copy it out of a browser.
        /// </summary>
        /// <remarks>
        /// The whole point of the ring buffer sink. A bug report that carries the last few hundred
        /// records is a test case; one that says "the tower fell over oddly" is a story.
        /// </remarks>
        private static void DumpLog()
        {
            if (GameBootstrap.LogBuffer == null)
            {
                return;
            }

            Debug.Log("=== IMPACT THEORY LOG DUMP ===\n" + GameBootstrap.LogBuffer.Dump());
        }

        private void EnsureStyle()
        {
            if (_style != null)
            {
                return;
            }

            _background = new Texture2D(1, 1);
            _background.SetPixel(0, 0, new Color(0.02f, 0.03f, 0.05f, 0.90f));
            _background.Apply();

            _style = new GUIStyle(GUI.skin.label)
            {
                fontSize = 13,
                richText = false,
                wordWrap = false,
                normal = { textColor = new Color(0.62f, 0.95f, 0.72f) },
            };
        }
    }
}
