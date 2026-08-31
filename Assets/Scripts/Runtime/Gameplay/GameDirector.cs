using System.Collections.Generic;
using ImpactTheory.Core.Logging;
using ImpactTheory.Core.Math;
using ImpactTheory.Gameplay;
using ImpactTheory.Physics;
using ImpactTheory.Runtime.Core;
using ImpactTheory.Runtime.Input;
using ImpactTheory.Runtime.Physics;
using ImpactTheory.Runtime.Structure;
using ImpactTheory.Runtime.View;
using ImpactTheory.Save;
using ImpactTheory.Structure;
using UnityEngine;

namespace ImpactTheory.Runtime.Gameplay
{
    /// <summary>
    /// Drives the playable loop: build, aim, fire, resolve, win or fail, restart.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The orchestrator, and deliberately thin. Every rule it applies lives in the engine-free
    /// layer and is covered by tests: <see cref="LevelStateMachine"/> owns the lifecycle,
    /// <see cref="SettleTracker"/> decides when a shot has resolved,
    /// <see cref="OffPlatformEvaluator"/> decides whether the structure is cleared, and
    /// <see cref="ScoreCalculator"/> turns the result into a score.
    /// </para>
    /// <para>
    /// What is left here is the part that genuinely needs an engine: spawning bodies, reading
    /// input, moving a camera, and stepping the simulation.
    /// </para>
    /// </remarks>
    public sealed class GameDirector : MonoBehaviour
    {
        private readonly GameInput _input = new GameInput();
        private readonly AimModel _aim = new AimModel();
        private readonly LevelStateMachine _level = new LevelStateMachine();

        private PhysicsConfig _config;
        private SaveService _save;
        private SettleTracker _settle;
        private StructureDirector _structure;
        private PlatformBehaviour _platform;
        private BallBehaviour _ball;
        private OrbitCameraRig _cameraRig;
        private LineRenderer _trajectory;

        private IReadOnlyList<StructureBlueprint> _campaign;
        private int _levelIndex;
        private int _fixedStepCount;

        /// <summary>Where the ball is launched from, relative to the platform centre.</summary>
        private Vector3 _launchPoint = new Vector3(0f, 0.8f, -9f);

        public GameInput Input => _input;

        public AimModel Aim => _aim;

        public LevelStateMachine Level => _level;

        public StructureDirector Structure => _structure;

        public PhysicsConfig Config => _config;

        public StructureBlueprint CurrentBlueprint =>
            _campaign != null && _levelIndex < _campaign.Count ? _campaign[_levelIndex] : null;

        /// <summary>True while the settle tracker is waiting for the scene to come to rest.</summary>
        public bool IsResolving => _level.Phase == LevelPhase.Resolving;

        public int RemainingPieces { get; private set; }

        private void Awake()
        {
            _config = new PhysicsConfig();
            PhysicsBootstrap.Apply(_config);

            _settle = new SettleTracker(_config.GetSettleSettings());

            _save = new SaveService(new PlayerPrefsSaveBackend())
            {
                GameVersion = Application.version,
            };

            _save.Load();

            Log.FrameProvider = () => Time.frameCount;
            Log.FixedStepProvider = () => _fixedStepCount;

            _level.PhaseChanged += OnPhaseChanged;

            BuildWorld();

            _campaign = BuiltInStructures.Campaign();
            LoadLevel(0);
        }

        private void BuildWorld()
        {
            _platform = PlatformBehaviour.Create(PlatformBounds.CreateDefault(), _config, transform);

            RetroArcadeBackdrop.Create(transform);
            CreateGround(transform);

            _structure = gameObject.AddComponent<StructureDirector>();
            _structure.Platform = _platform;

            _ball = BallBehaviour.Create(_config, transform);
            ArcadeLauncher.Create(_launchPoint, transform);
            _cameraRig = OrbitCameraRig.Create(transform);

            CreateTrajectoryRenderer();
            CreateLight();
        }

        /// <summary>
        /// Ground well below the platform, so fallen pieces land somewhere visible.
        /// </summary>
        /// <remarks>
        /// Gameplay-relevant, not decoration. A piece resting on the ground is not supported by the
        /// platform, so it is removed - which is exactly the "fallen past the platform" row of the
        /// <c>Docs/Physics.md</c> §8 table. Letting pieces fall forever would work too, but a
        /// player needs to see that a piece is gone.
        /// </remarks>
        internal static void CreateGround(Transform parent)
        {
            GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ground.name = "Ground";
            ground.transform.SetParent(parent, false);
            ground.transform.position = new Vector3(0f, -8.5f, -3f);
            ground.transform.localScale = new Vector3(120f, 1f, 12f);

            Renderer renderer = ground.GetComponent<Renderer>();
            RuntimeMaterialFactory.Apply(renderer, new Color(0.035f, 0.025f, 0.10f));
            // Keep the collider as the catch floor, but let the arcade backdrop own the lower
            // frame so the play space does not turn into a dark slab.
            renderer.enabled = false;
        }

        private void CreateLight()
        {
            GameObject lightObject = new GameObject("Sun");
            lightObject.transform.SetParent(transform, false);
            lightObject.transform.rotation = Quaternion.Euler(48f, 140f, 0f);

            Light light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.15f;
            light.shadows = LightShadows.Soft;
            light.color = new Color(1f, 0.97f, 0.91f);
        }

        private void CreateTrajectoryRenderer()
        {
            GameObject line = new GameObject("TrajectoryPreview");
            line.transform.SetParent(transform, false);

            _trajectory = line.AddComponent<LineRenderer>();
            _trajectory.widthMultiplier = 0.07f;
            _trajectory.positionCount = 0;
            _trajectory.useWorldSpace = true;
            _trajectory.material = new Material(Shader.Find("Sprites/Default"));
            _trajectory.startColor = new Color(1f, 0.85f, 0.3f, 0.95f);
            _trajectory.endColor = new Color(1f, 0.55f, 0.2f, 0.15f);
        }

        /// <summary>Builds a level from its blueprint and hands control to the state machine.</summary>
        public void LoadLevel(int index)
        {
            if (_campaign == null || _campaign.Count == 0)
            {
                return;
            }

            _levelIndex = Mathf.Clamp(index, 0, _campaign.Count - 1);
            StructureBlueprint blueprint = _campaign[_levelIndex];

            _structure.ClearAll();

            foreach (PiecePlacement placement in blueprint.Placements)
            {
                PieceDefinition definition = PieceLibrary.Get(placement.DefinitionId);
                if (definition == null)
                {
                    Log.Error(LogCategory.Asset,
                        $"blueprint {blueprint.Id} references unknown piece {placement.DefinitionId}");
                    continue;
                }

                StructurePieceBehaviour piece = StructurePieceBehaviour.Create(
                    $"{placement.DefinitionId}#{_structure.PieceCount:00}",
                    definition,
                    placement.Material,
                    placement.Position.ToUnity(),
                    placement.Rotation.ToUnity(),
                    _config,
                    transform,
                    placement.Required);

                _structure.Register(piece);
            }

            blueprint.GetExtents(out Vec3 centre, out float radius);
            // Include the mechanical pedestal in the opening shot. Physics extents only describe
            // the falling pieces, but the platform is part of the player's requested composition.
            Vector3 frameCentre = centre.ToUnity();
            frameCentre.y = -1.35f;
            _cameraRig.Frame(frameCentre, Mathf.Max(radius, 8.4f));

            _aim.Reset();
            _settle.Begin();
            _ball.PrepareAt(_launchPoint);

            Log.StructureSeed = blueprint.Seed;
            _level.BeginLevel(blueprint.Id, blueprint.BallAllowance, blueprint.Difficulty);

            Log.Info(LogCategory.Game, "level loaded", Log.Context(
                "level", blueprint.Id,
                "pieces", _structure.PieceCount.ToString(),
                "ballAllowance", blueprint.BallAllowance.ToString()));

            RemainingPieces = _structure.PieceCount;
        }

        private void Update()
        {
            _input.Sample(Time.deltaTime);

            _cameraRig.Orbit(_input.OrbitDelta.x, _input.OrbitDelta.y);
            _cameraRig.Zoom(_input.ZoomDelta);

            if (_input.RestartPressed)
            {
                RestartLevel();
                return;
            }

            switch (_level.Phase)
            {
                case LevelPhase.Ready:
                case LevelPhase.Aiming:
                    UpdateAiming();
                    break;

                case LevelPhase.Won:
                case LevelPhase.Failed:
                    HideTrajectory();
                    break;
            }
        }

        private void UpdateAiming()
        {
            if (_input.HasAimScreenPosition)
            {
                AimAtScreenPosition(_input.AimScreenPosition);
                _level.BeginAim();
            }
            else if (_input.AimDelta != Vector2.zero)
            {
                _aim.Adjust(_input.AimDelta.x, _input.AimDelta.y);
                _level.BeginAim();
            }

            if (_input.PowerDelta != 0f)
            {
                _aim.AdjustPower(_input.PowerDelta);
            }

            if (_input.CancelPressed)
            {
                _aim.Reset();
                _level.CancelAim();
            }

            ShowTrajectory();

            if (_input.FirePressed)
            {
                Fire();
            }
        }

        /// <summary>
        /// Converts the player's screen target into a ballistic aim that reaches the structure's
        /// depth. This keeps a finger on the thing it is aiming at instead of treating the gesture
        /// as a relative joystick.
        /// </summary>
        private void AimAtScreenPosition(Vector2 screenPosition)
        {
            if (_cameraRig == null || _cameraRig.Camera == null)
            {
                return;
            }

            Ray ray = _cameraRig.Camera.ScreenPointToRay(screenPosition);
            Plane targetPlane = new Plane(Vector3.forward, Vector3.zero);
            if (!targetPlane.Raycast(ray, out float distance))
            {
                return;
            }

            Vector3 target = ray.GetPoint(distance);

            // The camera intentionally includes the launcher in the frame, so its optical center
            // is below the structure. Re-anchor the target plane around the visible structure
            // center while preserving the finger's horizontal and vertical offset from screen
            // center. Without this correction a tap on the front columns becomes a below-deck
            // pitch because the camera focus is lower than the gameplay target.
            Ray screenCentreRay = _cameraRig.Camera.ScreenPointToRay(
                new Vector3(Screen.width * 0.5f, Screen.height * 0.5f, 0f));
            if (targetPlane.Raycast(screenCentreRay, out float centreDistance))
            {
                Vector3 screenCentreTarget = screenCentreRay.GetPoint(centreDistance);
                target.y += 3f - screenCentreTarget.y;
            }

            Vector3 offset = target - _launchPoint;
            float horizontalDistance = new Vector2(offset.x, offset.z).magnitude;
            if (horizontalDistance < 0.1f || offset.z <= 0.1f)
            {
                return;
            }

            float yaw = Mathf.Atan2(offset.x, offset.z) * Mathf.Rad2Deg;
            float speed = _aim.Speed(_config.BallMinLaunchSpeed, _config.BallMaxLaunchSpeed);
            float gravity = -_config.Gravity.Y;
            float speedSquared = speed * speed;
            float discriminant = speedSquared * speedSquared -
                gravity * (gravity * horizontalDistance * horizontalDistance +
                    2f * offset.y * speedSquared);

            float pitch;
            if (discriminant > 0f)
            {
                float lowArcTangent =
                    (speedSquared - Mathf.Sqrt(discriminant)) / (gravity * horizontalDistance);
                pitch = Mathf.Atan(lowArcTangent) * Mathf.Rad2Deg;
            }
            else
            {
                // If a target is outside the current power's ballistic envelope, still aim at it
                // visibly rather than snapping to the previous target.
                pitch = Mathf.Atan2(offset.y, horizontalDistance) * Mathf.Rad2Deg;
            }

            _aim.YawDegrees = yaw;
            _aim.PitchDegrees = pitch;
        }

        private void Fire()
        {
            if (!_level.Fire())
            {
                return;
            }

            Vec3 velocity = _aim.Velocity(_config.BallMinLaunchSpeed, _config.BallMaxLaunchSpeed);

            _ball.PrepareAt(_launchPoint);
            _ball.Launch(velocity.ToUnity());

            _settle.Begin();
            HideTrajectory();

            Log.Info(LogCategory.Game, "shot fired", Log.Context(
                "level", _level.LevelId,
                "ball", _level.Balls.Used.ToString(),
                "of", _level.Balls.Allowed.ToString(),
                "aim", _aim.ToString()));
        }

        private void FixedUpdate()
        {
            _fixedStepCount++;

            if (_level.Phase != LevelPhase.Resolving && _level.Phase != LevelPhase.Settling)
            {
                return;
            }

            List<BodyMotion> bodies = new List<BodyMotion>(_structure.GetMotion());

            // The ball counts toward settling while it is still in play. Once it has escaped, it
            // stops being part of the question - otherwise a ball sailing into the distance would
            // hold the shot open until the timeout.
            if (_level.Phase == LevelPhase.Resolving && _ball.IsLaunched && !_ball.HasEscaped)
            {
                bodies.Add(_ball.GetMotion());
            }

            SettleReport report = _settle.Step(Time.fixedDeltaTime, bodies);
            if (!report.IsResolved)
            {
                return;
            }

            if (_level.Phase == LevelPhase.Settling)
            {
                OnInitialSettle(report);
            }
            else
            {
                OnShotSettled(report);
            }
        }

        private void OnInitialSettle(SettleReport report)
        {
            _structure.SyncFromSimulation();
            RemainingPieces = _structure.CountRemaining();

            Log.Info(LogCategory.Physics, "initial structure " + report.Describe());
            _level.StructureSettled();
        }

        private void OnShotSettled(SettleReport report)
        {
            _structure.SyncFromSimulation();

            bool cleared = _structure.IsCleared();
            RemainingPieces = _structure.CountRemaining();

            Log.Info(LogCategory.Physics, "shot " + report.Describe());
            _structure.LogVerdicts();

            _level.ResolveShot(cleared);

            if (_level.Phase == LevelPhase.Ready)
            {
                _ball.PrepareAt(_launchPoint);
                _settle.Begin();
            }
        }

        private void OnPhaseChanged(LevelPhase from, LevelPhase to)
        {
            Log.Info(LogCategory.Game, $"phase {from} -> {to}", Log.Context(
                "level", _level.LevelId ?? "?",
                "ballsUsed", _level.Balls.Used.ToString(),
                "ballsRemaining", _level.Balls.Remaining.ToString()));

            if (to != LevelPhase.Won && to != LevelPhase.Failed)
            {
                return;
            }

            bool won = to == LevelPhase.Won;
            Log.Info(LogCategory.Game,
                (won ? "LEVEL CLEARED - " : "LEVEL FAILED - ") + _level.Score.Describe());

            // Persisted at the moment the level resolves, not at quit. A browser tab is closed
            // rather than quit, so anything held until shutdown is simply lost.
            _save?.RecordAttempt(_level.LevelId, won, _level.Score.Total, _level.Balls.Used);
        }

        /// <summary>Persisted progress, for the HUD and the debug overlay.</summary>
        public SaveData Progress => _save?.Data;

        private void ShowTrajectory()
        {
            Vec3[] points = _aim.SampleTrajectory(
                _launchPoint.ToCore(),
                _config.BallMinLaunchSpeed,
                _config.BallMaxLaunchSpeed,
                _config.Gravity,
                28,
                1.8f);

            _trajectory.positionCount = points.Length;
            for (int i = 0; i < points.Length; i++)
            {
                _trajectory.SetPosition(i, points[i].ToUnity());
            }
        }

        private void HideTrajectory() => _trajectory.positionCount = 0;

        /// <summary>Restarts the current level from the beginning.</summary>
        public void RestartLevel()
        {
            LoadLevel(_levelIndex);
            Log.Info(LogCategory.Game, "level restarted", Log.Context("level", _level.LevelId));
        }

        /// <summary>Advances to the next level, wrapping at the end of the campaign.</summary>
        public void NextLevel() => LoadLevel((_levelIndex + 1) % _campaign.Count);

        public int LevelIndex => _levelIndex;

        public int LevelCount => _campaign?.Count ?? 0;
    }
}
