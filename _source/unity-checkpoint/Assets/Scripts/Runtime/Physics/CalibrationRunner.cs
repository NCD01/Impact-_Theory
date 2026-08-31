using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using ImpactTheory.Core.Logging;
using ImpactTheory.Physics;
using ImpactTheory.Runtime.Core;
using ImpactTheory.Runtime.Gameplay;
using ImpactTheory.Runtime.Structure;
using ImpactTheory.Structure;
using UnityEngine;

namespace ImpactTheory.Runtime.Physics
{
    /// <summary>
    /// Runs the physics calibration scenarios and records what happened.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The permanent calibration environment required by <c>Docs/Physics.md</c> §11 and
    /// <c>Docs/GameDesign.md</c> §17. It is a regression environment, not a one-off: every scenario
    /// is data, so the whole set can be replayed identically after any physics change and compared
    /// against a recorded baseline.
    /// </para>
    /// <para>
    /// The comparison policy lives in <see cref="CalibrationComparer"/>, which is engine-free and
    /// tested. This class only drives the simulation and takes snapshots.
    /// </para>
    /// </remarks>
    public sealed class CalibrationRunner : MonoBehaviour
    {
        private PhysicsConfig _config;
        private PlatformBehaviour _platform;
        private SettleTracker _settle;
        private SettleReport _lastSettleReport;

        private readonly List<CalibrationBaseline> _results = new List<CalibrationBaseline>();

        /// <summary>Baselines produced by the last run.</summary>
        public IReadOnlyList<CalibrationBaseline> Results => _results;

        public bool IsRunning { get; private set; }

        /// <summary>Creates a calibration scene and starts the run.</summary>
        public static CalibrationRunner Launch()
        {
            GameObject root = new GameObject("Impact Theory Calibration");
            CalibrationRunner runner = root.AddComponent<CalibrationRunner>();
            return runner;
        }

        private void Start()
        {
            _config = new PhysicsConfig();
            PhysicsBootstrap.Apply(_config);

            _settle = new SettleTracker(_config.GetSettleSettings());
            _platform = PlatformBehaviour.Create(PlatformBounds.CreateDefault(), _config, transform);
            // Match the gameplay environment. Without the ground, pieces that cross the platform
            // boundary fall forever, so CAL_05 and CAL_09 time out instead of producing a stable
            // removal verdict.
            GameDirector.CreateGround(transform);

            CreateLight();
            StartCoroutine(RunAll());
        }

        private void CreateLight()
        {
            GameObject sun = new GameObject("Sun");
            sun.transform.SetParent(transform, false);
            sun.transform.rotation = Quaternion.Euler(48f, 140f, 0f);

            Light light = sun.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.1f;
        }

        private IEnumerator RunAll()
        {
            IsRunning = true;
            _results.Clear();

            Log.Info(LogCategory.Physics, "calibration run starting", Log.Context(
                "scenarios", CalibrationScenario.All().Count.ToString(),
                "config", _config.Describe()));

            foreach (CalibrationScenario scenario in CalibrationScenario.All())
            {
                yield return RunScenario(scenario);
            }

            IsRunning = false;

            Log.Info(LogCategory.Physics, "calibration run complete", Log.Context(
                "scenarios", _results.Count.ToString(),
                "physicsConfigVersion", _config.PhysicsConfigVersion.ToString()));

            string report = BuildReport();
            Debug.Log(report);

            // The menu path is intentionally interactive, but the same path is also used by the
            // repeatable command-line validation harness. In batch mode there is no editor user to
            // stop play mode, so persist the measured report and exit only after every scenario
            // has resolved. This keeps VAL-014 evidence durable without changing editor behavior.
            if (Application.isBatchMode)
            {
                string projectRoot = Directory.GetParent(Application.dataPath)?.FullName ?? ".";
                string reportPath = Path.Combine(
                    projectRoot, ".agent_temp", "diagnostics", "physics-calibration-report.txt");
                Directory.CreateDirectory(Path.GetDirectoryName(reportPath));
                File.WriteAllText(reportPath, report);
                // The editor-side command-line harness observes IsRunning and exits Unity. Calling
                // Application.Quit from play mode can stop play mode before that observer sees the
                // completed runner, leaving a headless editor alive indefinitely.
            }
        }

        private IEnumerator RunScenario(CalibrationScenario scenario)
        {
            Log.Info(LogCategory.Physics, $"calibration scenario {scenario.Id}", Log.Context(
                "behaviour", scenario.Behaviour.ToString(),
                "expected", scenario.ExpectedBehaviour));

            List<StructurePieceBehaviour> pieces = new List<StructurePieceBehaviour>();
            SupportGraph support = new SupportGraph();
            OffPlatformEvaluator evaluator = new OffPlatformEvaluator();

            int index = 0;
            foreach (CalibrationPiece piece in scenario.Pieces)
            {
                PieceDefinition definition = PieceLibrary.Get(piece.DefinitionId);
                if (definition == null)
                {
                    Log.Error(LogCategory.Asset,
                        $"{scenario.Id} references unknown piece {piece.DefinitionId}");
                    continue;
                }

                pieces.Add(StructurePieceBehaviour.Create(
                    $"{piece.DefinitionId}#{index++:00}",
                    definition,
                    piece.Material,
                    piece.Position.ToUnity(),
                    piece.Rotation.ToUnity(),
                    _config,
                    transform));
            }

            BallBehaviour ball = null;
            if (scenario.FiresBall)
            {
                // Let the structure settle before firing, or the shot lands on a scene that is
                // still resolving its own spawn contacts and the result is not reproducible.
                yield return WaitForSettle(pieces, null);

                ball = BallBehaviour.Create(_config, transform);
                ball.PrepareAt(scenario.ShotOrigin.ToUnity());
                ball.Launch(scenario.ShotVelocity.ToUnity());
            }

            yield return WaitForSettle(pieces, ball);

            _results.Add(Snapshot(scenario, pieces, support, evaluator));

            foreach (StructurePieceBehaviour piece in pieces)
            {
                Destroy(piece.gameObject);
            }

            if (ball != null)
            {
                Destroy(ball.gameObject);
            }

            // One frame for the destroys to take effect before the next scenario spawns.
            yield return null;
        }

        private IEnumerator WaitForSettle(
            List<StructurePieceBehaviour> pieces, BallBehaviour ball)
        {
            _settle.Begin();

            while (!_settle.IsResolved)
            {
                List<BodyMotion> motion = new List<BodyMotion>(pieces.Count + 1);

                foreach (StructurePieceBehaviour piece in pieces)
                {
                    if (piece != null)
                    {
                        motion.Add(piece.GetMotion());
                    }
                }

                if (ball != null && ball.IsLaunched && !ball.HasEscaped)
                {
                    motion.Add(ball.GetMotion());
                }

                _lastSettleReport = _settle.Step(Time.fixedDeltaTime, motion);
                yield return new WaitForFixedUpdate();
            }
        }

        private CalibrationBaseline Snapshot(
            CalibrationScenario scenario,
            List<StructurePieceBehaviour> pieces,
            SupportGraph support,
            OffPlatformEvaluator evaluator)
        {
            support.Clear();

            List<PieceState> states = new List<PieceState>(pieces.Count);

            foreach (StructurePieceBehaviour piece in pieces)
            {
                if (piece == null)
                {
                    continue;
                }

                piece.SyncStateFromTransform();
                states.Add(piece.State);

                foreach (string supporter in piece.Supporters)
                {
                    support.AddSupport(piece.State.PieceId, supporter);
                }
            }

            CalibrationBaseline baseline =
                new CalibrationBaseline(scenario.Id, _config.PhysicsConfigVersion)
                {
                    SettleTime = _settle.Elapsed,
                    TimedOut = _settle.TimedOut,
                    Resolution = _lastSettleReport,
                };

            foreach (PieceState state in states)
            {
                RemovalVerdict verdict = evaluator.Evaluate(state, _platform.Bounds, support);
                baseline.Add(new PieceSnapshot(
                    state.PieceId, state.Position, state.Rotation, verdict.IsRemoved));
            }

            Log.Info(LogCategory.Physics, $"{scenario.Id} settled", Log.Context(
                "settleTime", baseline.SettleTime.ToString("0.##"),
                "timedOut", baseline.TimedOut.ToString(),
                "pieces", baseline.Pieces.Count.ToString()));

            return baseline;
        }

        /// <summary>
        /// A human-readable report of the run.
        /// </summary>
        /// <remarks>
        /// Includes each scenario's stated expectation next to its measured result, because the
        /// first calibration run has no baseline to compare against - a person has to read it and
        /// judge whether the physics is behaving, which they cannot do from numbers alone.
        /// </remarks>
        public string BuildReport()
        {
            StringBuilder report = new StringBuilder(2048);

            report.AppendLine("=== IMPACT THEORY PHYSICS CALIBRATION ===");
            report.AppendLine(_config.Describe());
            report.AppendLine();

            IReadOnlyList<CalibrationScenario> scenarios = CalibrationScenario.All();

            for (int i = 0; i < _results.Count && i < scenarios.Count; i++)
            {
                CalibrationBaseline baseline = _results[i];
                CalibrationScenario scenario = scenarios[i];

                report.AppendLine(baseline.ToString());
                report.AppendLine("  resolution: " + baseline.Resolution.Describe());
                report.AppendLine("  expected: " + scenario.ExpectedBehaviour);

                foreach (PieceSnapshot snapshot in baseline.Pieces)
                {
                    report.AppendLine(
                        $"    {snapshot.PieceId,-28} {snapshot.Position}  " +
                        $"{(snapshot.Removed ? "REMOVED" : "on platform")}");
                }

                report.AppendLine();
            }

            return report.ToString();
        }
    }
}
