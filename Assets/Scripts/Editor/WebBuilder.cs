using System;
using System.IO;
using System.Linq;
using ImpactTheory.Runtime;
using ImpactTheory.Runtime.Physics;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ImpactTheory.Editor
{
    /// <summary>
    /// Produces the Web build, which is the primary platform.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Web first is fixed by <c>Docs/GameDesign.md</c> §5, and <c>Docs/Testing.md</c> §1 is blunt
    /// about what counts: <strong>a Unity Editor test is not Web validation.</strong>
    /// <c>VAL-004</c> and <c>VAL-005</c> are satisfied only by a real build loaded in Chrome and
    /// Edge, and <c>PASS</c> is never recorded for a check that was not run.
    /// </para>
    /// <para>
    /// Scriptable so it can run from the command line without a human in the editor:
    /// </para>
    /// <code>
    /// Unity.exe -batchmode -quit -projectPath "C:\apps\Impact Theory" ^
    ///           -executeMethod ImpactTheory.Editor.WebBuilder.BuildFromCommandLine
    /// </code>
    /// </remarks>
    public static class WebBuilder
    {
        private const string OutputDirectory = "Builds/Web";
        private const string SceneDirectory = "Assets/Scenes";
        private const string GameplayScenePath = SceneDirectory + "/Gameplay.unity";
        private static bool _batchCalibrationStarted;

        [InitializeOnLoadMethod]
        private static void InstallBatchCalibrationExitWatcher()
        {
            bool isCalibrationCommand = Environment.GetCommandLineArgs()
                .Contains("ImpactTheory.Editor.WebBuilder.RunCalibration");
            if (!Application.isBatchMode || !isCalibrationCommand)
            {
                return;
            }

            // Entering play mode reloads the editor domain, which clears an update callback
            // registered only by RunCalibration. Reinstall it after every domain reload so a
            // completed unattended calibration always closes the editor.
            _batchCalibrationStarted = false;
            EditorApplication.update -= ExitWhenBatchCalibrationCompletes;
            EditorApplication.update += ExitWhenBatchCalibrationCompletes;
        }

        /// <summary>
        /// Enters play mode with the calibration harness instead of the game.
        /// </summary>
        /// <remarks>
        /// The entry point for `VAL-014`. Produces the physics baseline that every later
        /// regression comparison is measured against - see `Docs/Physics.md` section 11.
        /// </remarks>
        [MenuItem("Impact Theory/Run Physics Calibration", priority = 10)]
        public static void RunCalibration()
        {
            if (EditorApplication.isPlaying)
            {
                Debug.LogWarning("[Impact Theory] Exit play mode before starting calibration.");
                return;
            }

            // Suppress the normal game bootstrap so the calibration harness owns the scene.
            GameBootstrap.AutoStartEnabled = false;

            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("CalibrationLauncher").AddComponent<CalibrationLauncher>();

            if (Application.isBatchMode)
            {
                InstallBatchCalibrationExitWatcher();
            }

            EditorApplication.isPlaying = true;
        }

        private static void ExitWhenBatchCalibrationCompletes()
        {
            CalibrationRunner runner = UnityEngine.Object.FindFirstObjectByType<CalibrationRunner>();
            if (runner == null)
            {
                return;
            }

            if (runner.IsRunning)
            {
                _batchCalibrationStarted = true;
                return;
            }

            if (_batchCalibrationStarted && runner.Results.Count > 0)
            {
                EditorApplication.update -= ExitWhenBatchCalibrationCompletes;
                EditorApplication.Exit(0);
            }
        }

        [MenuItem("Impact Theory/Build Web Player", priority = 20)]
        public static void BuildWebMenu() => Build(development: true);

        [MenuItem("Impact Theory/Build Web Player (Release)", priority = 21)]
        public static void BuildWebReleaseMenu() => Build(development: false);

        /// <summary>Entry point for <c>-executeMethod</c>. Exits with a non-zero code on failure.</summary>
        public static void BuildFromCommandLine()
        {
            bool development = Environment.GetCommandLineArgs().Contains("-itDevelopment");
            BuildReport report = Build(development);

            bool succeeded = report != null && report.summary.result == BuildResult.Succeeded;

            if (Application.isBatchMode)
            {
                EditorApplication.Exit(succeeded ? 0 : 1);
            }
        }

        /// <summary>Builds the Web player and returns the report.</summary>
        public static BuildReport Build(bool development)
        {
            string scenePath = EnsureGameplayScene();

            // Unity 6.3's WebGL build pipeline creates a temporary, extensionless file named
            // "version" in the project directory. Windows treats that name as the tracked
            // extensionless VERSION file, so leaving VERSION in place makes IL2CPP compile the
            // repository version text as C++ and the build deletes the repository file. Keep the repository
            // version in memory for the duration of the build, then restore it even on failure.
            string versionPath = ProjectVersionPath();
            string buildVersion = ReadProjectVersion();
            string versionText = null;
            if (File.Exists(versionPath))
            {
                versionText = File.ReadAllText(versionPath);
                File.Delete(versionPath);
            }

            try
            {
                BuildPlayerOptions options = new BuildPlayerOptions
                {
                    scenes = new[] { scenePath },
                    locationPathName = OutputDirectory,
                    target = BuildTarget.WebGL,
                    targetGroup = BuildTargetGroup.WebGL,
                    options = development
                        ? BuildOptions.Development
                        : BuildOptions.None,
                };

                ConfigureWebGlSettings(development, buildVersion);

                Directory.CreateDirectory(OutputDirectory);

                BuildReport report = BuildPipeline.BuildPlayer(options);
                BuildSummary summary = report.summary;

                if (summary.result == BuildResult.Succeeded)
                {
                    Debug.Log(
                        $"[Impact Theory] Web build succeeded: {summary.totalSize / (1024 * 1024)} MB " +
                        $"in {summary.totalTime.TotalSeconds:0.#}s -> {Path.GetFullPath(OutputDirectory)}");
                }
                else
                {
                    Debug.LogError(
                        $"[Impact Theory] Web build {summary.result} with {summary.totalErrors} error(s).");
                }

                return report;
            }
            finally
            {
                if (versionText != null)
                {
                    File.WriteAllText(versionPath, versionText);
                }
            }
        }

        /// <summary>
        /// Applies the Web player settings the game needs.
        /// </summary>
        /// <remarks>
        /// <para>
        /// Compression is set to Disabled rather than Brotli or Gzip, and that is not laziness. A
        /// compressed Unity Web build served from <c>file://</c> or a plain static server without
        /// the matching <c>Content-Encoding</c> header fails to load with an error that points
        /// nowhere useful. Uncompressed output loads from any static server, which is what
        /// <c>Docs/Testing.md</c> §5 step 2 asks a tester to do. Enable compression when there is a
        /// real host that sets the headers.
        /// </para>
        /// <para>
        /// Exceptions stay enabled in development builds: a physics bug that only reproduces in a
        /// browser is exactly the case where a stack trace is worth the size.
        /// </para>
        /// </remarks>
        private static void ConfigureWebGlSettings(bool development, string buildVersion)
        {
            PlayerSettings.companyName = "NCD";
            PlayerSettings.productName = "Impact Theory";
            PlayerSettings.bundleVersion = buildVersion;

            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.exceptionSupport = development
                ? WebGLExceptionSupport.FullWithStacktrace
                : WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;

            PlayerSettings.runInBackground = true;
            PlayerSettings.defaultWebScreenWidth = 1280;
            PlayerSettings.defaultWebScreenHeight = 720;

            // Web needs a deterministic frame budget more than it needs a high one. Physics is on a
            // fixed step regardless, so an uncapped renderer only steals time from it.
            QualitySettings.vSyncCount = 1;
        }

        /// <summary>
        /// Reads <c>VERSION</c> so the build carries the same version as the repository.
        /// </summary>
        /// <remarks>
        /// <c>Docs/GameDesign.md</c> §3 requires every build to be traceable to a version, a
        /// commit, a date, a platform, and a configuration. Reading the file rather than typing a
        /// number here is what keeps that true without anyone remembering to do it.
        /// </remarks>
        private static string ReadProjectVersion()
        {
            try
            {
                string path = ProjectVersionPath();

                if (File.Exists(path))
                {
                    return File.ReadAllText(path).Trim().TrimStart('v');
                }

                // The repeatable preflight temporarily moves VERSION out of the project root
                // because Unity's WebGL importer treats an extensionless root file as C++ input.
                // Carry the captured value through the child process so the generated player still
                // reports the repository version while that collision is avoided.
                string stagedVersion = Environment.GetEnvironmentVariable(
                    "IMPACT_THEORY_BUILD_VERSION");
                if (!string.IsNullOrWhiteSpace(stagedVersion))
                {
                    return stagedVersion.Trim().TrimStart('v');
                }
            }
            catch (IOException)
            {
                // Falls through to the default below; a build must not fail over a version string.
            }

            return string.IsNullOrEmpty(PlayerSettings.bundleVersion)
                ? "0.0"
                : PlayerSettings.bundleVersion;
        }

        private static string ProjectVersionPath() => Path.Combine(
            Directory.GetParent(Application.dataPath)?.FullName ?? ".", "VERSION");

        /// <summary>
        /// Guarantees a buildable scene exists, creating one if the project has none.
        /// </summary>
        /// <remarks>
        /// The game builds itself from code (<see cref="GameBootstrap"/>), so the scene only has to
        /// exist and contain the bootstrap component. Creating it here rather than committing a
        /// hand-written <c>.unity</c> file avoids fabricating GUIDs and file ids blind, which is
        /// the kind of thing that produces a scene Unity refuses to open.
        /// </remarks>
        [MenuItem("Impact Theory/Create Gameplay Scene", priority = 1)]
        public static string EnsureGameplayScene()
        {
            if (File.Exists(GameplayScenePath))
            {
                return GameplayScenePath;
            }

            Directory.CreateDirectory(SceneDirectory);

            Scene scene = EditorSceneManager.NewScene(
                NewSceneSetup.EmptyScene, NewSceneMode.Single);

            GameObject bootstrap = new GameObject("ImpactTheoryBootstrap");
            bootstrap.AddComponent<GameBootstrap>();

            EditorSceneManager.SaveScene(scene, GameplayScenePath);
            AssetDatabase.Refresh();

            Debug.Log($"[Impact Theory] Created {GameplayScenePath}");
            return GameplayScenePath;
        }
    }
}
