using ImpactTheory.Core.Logging;
using UnityEngine;

namespace ImpactTheory.Runtime.Input
{
    /// <summary>
    /// The single input abstraction. Gameplay asks for actions and never for devices.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Mouse, keyboard, and touch from the start. Addendum 005 §8 forbids building mouse-only
    /// gameplay and retrofitting touch later, and the reason is specific: the retrofit is where aim
    /// precision and camera control assumptions break, because a finger and a pointer disagree
    /// about what a drag means.
    /// </para>
    /// <para>
    /// <strong>Resolving the gesture conflict.</strong> <c>Docs/Architecture.md</c> §4 names it
    /// directly - <c>Camera</c> and <c>AdjustAim</c> compete for the same drag on touch, and it
    /// must be resolved in the mapping rather than improvised per scene. The resolution:
    /// </para>
    /// <list type="table">
    ///   <item><term>One finger drag</term><description>Aim. The common action gets the simplest gesture.</description></item>
    ///   <item><term>Two finger drag</term><description>Camera orbit.</description></item>
    ///   <item><term>Pinch</term><description>Camera zoom.</description></item>
    ///   <item><term>Fire, power, restart</term><description>On-screen controls, not gestures.</description></item>
    /// </list>
    /// <para>
    /// A short finger tap aims at that screen point and fires. A longer finger drag continuously
    /// updates the screen target without firing, so aiming remains precise while an intentional tap
    /// still feels like the arcade control the player expects.
    /// </para>
    /// <para>
    /// On desktop: left-drag aims, right-drag orbits, the wheel sets power, shift+wheel zooms,
    /// space fires, R restarts, Escape cancels.
    /// </para>
    /// </remarks>
    public sealed class GameInput
    {
        private const float OrbitDegreesPerPixel = 0.25f;
        private const float PowerPerWheelNotch = 0.08f;
        private const float PowerPerSecondFromKeys = 0.6f;
        private const float TouchTapMaxTravel = 36f;
        private const float TouchTapMaxDuration = 0.65f;

        private Vector2 _lastPointer;
        private bool _dragging;
        private float _lastPinchDistance;
        private Vector2 _touchStartPosition;
        private float _touchStartTime;
        private bool _touchTapCandidate;

        /// <summary>Set by on-screen controls. Consumed once, like a keypress.</summary>
        private bool _virtualFire;
        private bool _virtualRestart;
        private float _virtualPowerDelta;

        /// <summary>Yaw and pitch change requested this frame, in degrees.</summary>
        public Vector2 AimDelta { get; private set; }

        /// <summary>True when a pointer or finger supplied a direct screen target this frame.</summary>
        public bool HasAimScreenPosition { get; private set; }

        /// <summary>Screen position supplied by the pointer or finger, in Unity's bottom-left coordinates.</summary>
        public Vector2 AimScreenPosition { get; private set; }

        /// <summary>Power change requested this frame, in normalised units.</summary>
        public float PowerDelta { get; private set; }

        /// <summary>Camera orbit requested this frame, in degrees.</summary>
        public Vector2 OrbitDelta { get; private set; }

        /// <summary>Camera zoom requested this frame, in metres.</summary>
        public float ZoomDelta { get; private set; }

        public bool FirePressed { get; private set; }

        public bool CancelPressed { get; private set; }

        public bool RestartPressed { get; private set; }

        /// <summary>True when the most recent input came from a touchscreen.</summary>
        public bool IsTouchActive { get; private set; }

        /// <summary>True when the player is actively adjusting aim, for the HUD to reflect.</summary>
        public bool IsAiming => _dragging;

        /// <summary>
        /// Enables the power controls reserved for a later, more advanced version of the game.
        /// The first-playable alpha deliberately uses one predictable launch strength.
        /// </summary>
        public bool AdvancedPowerEnabled { get; set; }

        /// <summary>Called by an on-screen fire control.</summary>
        public void RequestFire() => _virtualFire = true;

        /// <summary>Called by an on-screen restart control.</summary>
        public void RequestRestart() => _virtualRestart = true;

        /// <summary>Called by an on-screen power control.</summary>
        public void RequestPower(float delta) => _virtualPowerDelta += delta;

        /// <summary>Samples every device and reduces it to actions. Call once per frame.</summary>
        public void Sample(float deltaTime)
        {
            AimDelta = Vector2.zero;
            HasAimScreenPosition = false;
            PowerDelta = AdvancedPowerEnabled ? _virtualPowerDelta : 0f;
            OrbitDelta = Vector2.zero;
            ZoomDelta = 0f;
            FirePressed = _virtualFire;
            CancelPressed = false;
            RestartPressed = _virtualRestart;

            _virtualFire = false;
            _virtualRestart = false;
            _virtualPowerDelta = 0f;

#if ENABLE_LEGACY_INPUT_MANAGER
            if (UnityEngine.Input.touchCount > 0)
            {
                IsTouchActive = true;
                SampleTouch();
            }
            else
            {
                SamplePointerAndKeys(deltaTime);
            }
#else
            ReportUnsupportedInputBackend();
#endif
        }

#if ENABLE_LEGACY_INPUT_MANAGER
        private void SampleTouch()
        {
            int count = UnityEngine.Input.touchCount;

            if (count == 1)
            {
                Touch touch = UnityEngine.Input.GetTouch(0);
                _lastPinchDistance = 0f;

                if (touch.phase == TouchPhase.Began)
                {
                    _touchStartPosition = touch.position;
                    _touchStartTime = Time.unscaledTime;
                    _touchTapCandidate = true;
                    _dragging = false;
                    AimScreenPosition = touch.position;
                    HasAimScreenPosition = true;
                }

                if (touch.phase == TouchPhase.Moved)
                {
                    // Touch aim is target-based, not delta-based. The game converts this screen
                    // point into a world-space impact point, so a finger stays over the target it
                    // is aiming at instead of drifting with the history of the drag.
                    AimScreenPosition = touch.position;
                    HasAimScreenPosition = true;

                    if (Vector2.Distance(_touchStartPosition, touch.position) > TouchTapMaxTravel)
                    {
                        _touchTapCandidate = false;
                    }
                }

                if (touch.phase == TouchPhase.Ended)
                {
                    bool isTap = _touchTapCandidate &&
                        Time.unscaledTime - _touchStartTime <= TouchTapMaxDuration &&
                        Vector2.Distance(_touchStartPosition, touch.position) <= TouchTapMaxTravel &&
                        !IsHudActionTap(touch.position);

                    if (IsHudActionTap(touch.position))
                    {
                        HasAimScreenPosition = false;
                    }
                    else
                    {
                        AimScreenPosition = touch.position;
                        HasAimScreenPosition = true;
                    }

                    if (isTap)
                    {
                        FirePressed = true;
                    }

                    _touchTapCandidate = false;
                    _dragging = false;
                    return;
                }

                if (touch.phase == TouchPhase.Canceled)
                {
                    _touchTapCandidate = false;
                    _dragging = false;
                    return;
                }

                _dragging = touch.phase == TouchPhase.Moved;
                return;
            }

            _dragging = false;

            if (count < 2)
            {
                return;
            }

            Touch first = UnityEngine.Input.GetTouch(0);
            Touch second = UnityEngine.Input.GetTouch(1);

            // Pinch and two-finger drag arrive together; separating them by which changed more
            // keeps a slightly uneven pinch from also swinging the camera.
            float pinch = Vector2.Distance(first.position, second.position);
            float pinchDelta = _lastPinchDistance > 0f ? pinch - _lastPinchDistance : 0f;
            _lastPinchDistance = pinch;

            Vector2 averageDelta = (first.deltaPosition + second.deltaPosition) * 0.5f;

            if (Mathf.Abs(pinchDelta) > averageDelta.magnitude)
            {
                ZoomDelta = -pinchDelta * 0.02f;
            }
            else
            {
                OrbitDelta = new Vector2(
                    averageDelta.x * OrbitDegreesPerPixel,
                    averageDelta.y * OrbitDegreesPerPixel);
            }
        }

        private static bool IsHudActionTap(Vector2 touchPosition)
        {
            // GUI uses a top-left origin while touch positions use a bottom-left origin. Keep
            // taps on the two action buttons with the button itself, rather than firing once from
            // the button and once from the general tap gesture.
            float scale = Mathf.Clamp(Screen.width / 1280f, 0.75f, 2.2f);
            float guiX = touchPosition.x / scale;
            float guiY = (Screen.height - touchPosition.y) / scale;
            float width = Screen.width / scale;
            float height = Screen.height / scale;

            bool fireButton = guiX >= width - 196f && guiX <= width - 24f &&
                guiY >= height - 92f && guiY <= height - 36f;
            bool restartButton = guiX >= 24f && guiX <= 174f &&
                guiY >= height - 92f && guiY <= height - 36f;

            return fireButton || restartButton;
        }

        private void SamplePointerAndKeys(float deltaTime)
        {
            Vector2 pointer = UnityEngine.Input.mousePosition;

            if (UnityEngine.Input.GetMouseButtonDown(0) || UnityEngine.Input.GetMouseButtonDown(1))
            {
                _lastPointer = pointer;
                _dragging = true;
            }

            if (UnityEngine.Input.GetMouseButtonUp(0) && UnityEngine.Input.GetMouseButton(1) == false)
            {
                _dragging = false;
            }

            Vector2 delta = pointer - _lastPointer;
            _lastPointer = pointer;

            if (UnityEngine.Input.GetMouseButton(0))
            {
                if (!IsHudActionTap(pointer))
                {
                    AimScreenPosition = pointer;
                    HasAimScreenPosition = true;
                }
            }
            else if (UnityEngine.Input.GetMouseButton(1))
            {
                OrbitDelta = new Vector2(
                    delta.x * OrbitDegreesPerPixel, delta.y * OrbitDegreesPerPixel);
            }

            // Keyboard aim, for precision the mouse cannot give on a trackpad.
            float keyYaw = 0f;
            float keyPitch = 0f;

            if (UnityEngine.Input.GetKey(KeyCode.LeftArrow) || UnityEngine.Input.GetKey(KeyCode.A))
            {
                keyYaw -= 1f;
            }

            if (UnityEngine.Input.GetKey(KeyCode.RightArrow) || UnityEngine.Input.GetKey(KeyCode.D))
            {
                keyYaw += 1f;
            }

            if (UnityEngine.Input.GetKey(KeyCode.UpArrow) || UnityEngine.Input.GetKey(KeyCode.W))
            {
                keyPitch += 1f;
            }

            if (UnityEngine.Input.GetKey(KeyCode.DownArrow) || UnityEngine.Input.GetKey(KeyCode.S))
            {
                keyPitch -= 1f;
            }

            if (keyYaw != 0f || keyPitch != 0f)
            {
                const float keyDegreesPerSecond = 45f;
                AimDelta += new Vector2(
                    keyYaw * keyDegreesPerSecond * deltaTime,
                    keyPitch * keyDegreesPerSecond * deltaTime);
            }

            float wheel = UnityEngine.Input.mouseScrollDelta.y;
            bool shift = UnityEngine.Input.GetKey(KeyCode.LeftShift) ||
                         UnityEngine.Input.GetKey(KeyCode.RightShift);

            if (shift)
            {
                ZoomDelta -= wheel;
            }
            else if (AdvancedPowerEnabled)
            {
                PowerDelta += wheel * PowerPerWheelNotch;
            }

            if (AdvancedPowerEnabled && UnityEngine.Input.GetKey(KeyCode.Q))
            {
                PowerDelta -= PowerPerSecondFromKeys * deltaTime;
            }

            if (AdvancedPowerEnabled && UnityEngine.Input.GetKey(KeyCode.E))
            {
                PowerDelta += PowerPerSecondFromKeys * deltaTime;
            }

            if (UnityEngine.Input.GetKeyDown(KeyCode.Space) ||
                UnityEngine.Input.GetKeyDown(KeyCode.Return))
            {
                FirePressed = true;
            }

            if (UnityEngine.Input.GetKeyDown(KeyCode.Escape))
            {
                CancelPressed = true;
            }

            if (UnityEngine.Input.GetKeyDown(KeyCode.R))
            {
                RestartPressed = true;
            }
        }
#else
        private static bool _warned;

        /// <summary>
        /// Reports a misconfigured input backend once, loudly, instead of failing silently.
        /// </summary>
        /// <remarks>
        /// Reachable when Player Settings has Active Input Handling set to "Input System Package
        /// (New)" only. Unity 6 projects can default to that, and the failure mode without this
        /// message is a game that runs, renders, and ignores every control - which is a genuinely
        /// confusing thing to debug.
        /// </remarks>
        private static void ReportUnsupportedInputBackend()
        {
            if (_warned)
            {
                return;
            }

            _warned = true;
            Log.Fatal(LogCategory.Input,
                "no supported input backend is compiled in. Set Player Settings > Active Input " +
                "Handling to 'Input Manager (Old)' or 'Both'. All controls are dead until then.");
        }
#endif
    }
}
