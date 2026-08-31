using ImpactTheory.Core.Logging;
using ImpactTheory.Runtime.Core;
using ImpactTheory.Runtime.Gameplay;
using ImpactTheory.Runtime.UI;
using UnityEngine;

namespace ImpactTheory.Runtime
{
    /// <summary>
    /// Creates the game. The single entry point for a running Impact Theory session.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The whole game is constructed from code rather than authored into a scene. That is a
    /// deliberate choice forced by a real constraint and kept for a real benefit.
    /// </para>
    /// <para>
    /// The constraint: no Unity editor is installed (<c>ISSUE-001</c>), so a scene would have to be
    /// hand-written as YAML with fabricated GUIDs and file ids. That is brittle to author blind,
    /// effectively unreviewable in a diff, and the failure mode is a scene that will not open.
    /// </para>
    /// <para>
    /// The benefit, which outlasts the constraint: a code-built world is reproducible, diffable,
    /// and cannot drift from what the tests describe. A scene file can be edited in the inspector
    /// until it disagrees with the blueprint that supposedly defines it; this cannot.
    /// </para>
    /// <para>
    /// Two ways in. Drop this component on any GameObject in a scene, or let the automatic
    /// bootstrap below run - which means an empty scene, including the default one Unity creates
    /// with a new project, boots straight into a playable game.
    /// </para>
    /// </remarks>
    public sealed class GameBootstrap : MonoBehaviour
    {
        /// <summary>Set false to keep the automatic bootstrap from running.</summary>
        public static bool AutoStartEnabled = true;

        private static GameObject _root;

        /// <summary>The ring buffer holding recent records, for the debug overlay and bug reports.</summary>
        public static RingBufferSink LogBuffer { get; private set; }

        /// <summary>
        /// Boots the game as soon as the first scene has loaded, without needing a scene asset.
        /// </summary>
        /// <remarks>
        /// <c>AfterSceneLoad</c> rather than <c>BeforeSceneLoad</c>, so that a hand-placed
        /// <see cref="GameBootstrap"/> in a scene wins and this does not create a second game
        /// alongside it.
        /// </remarks>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void AutoStart()
        {
            if (!AutoStartEnabled || _root != null)
            {
                return;
            }

            if (FindAnyObjectByType<GameDirector>() != null)
            {
                return;
            }

            Launch();
        }

        /// <summary>Builds and starts the game. Safe to call once.</summary>
        public static GameDirector Launch()
        {
            ConfigureLogging();

            _root = new GameObject("Impact Theory");
            DontDestroyOnLoad(_root);

            GameDirector director = _root.AddComponent<GameDirector>();
            _root.AddComponent<HudController>();
            _root.AddComponent<DebugOverlay>();

            Log.Info(LogCategory.Build, "Impact Theory started", Log.Context(
                "unityVersion", Application.unityVersion,
                "platform", Application.platform.ToString(),
                "buildType", Debug.isDebugBuild ? "development" : "release"));

            return director;
        }

        private static void ConfigureLogging()
        {
            Log.Reset();

            // The ring buffer is the sink that matters on the Web target: when a structure
            // collapses wrongly in a browser, attaching a debugger is awkward and the useful
            // artefact is the last few hundred records, copyable in one action
            // (Docs/Logging.md section 4).
            LogBuffer = new RingBufferSink(600);
            Log.AddSink(LogBuffer);
            Log.AddSink(new UnityLogSink());

            // Development builds keep Debug; release drops to Info. TRACE always needs an explicit
            // opt-in, because per-step logging in a browser drowns the console and skews the very
            // frame timings VAL-016 measures (Docs/Logging.md section 2).
            Log.MinimumLevel = Debug.isDebugBuild ? LogLevel.Debug : LogLevel.Info;
        }

        private void Awake()
        {
            // Placed by hand in a scene rather than auto-started.
            if (_root != null && _root != gameObject)
            {
                return;
            }

            if (GetComponent<GameDirector>() != null)
            {
                return;
            }

            ConfigureLogging();
            _root = gameObject;

            gameObject.AddComponent<GameDirector>();
            gameObject.AddComponent<HudController>();
            gameObject.AddComponent<DebugOverlay>();
        }
    }
}
