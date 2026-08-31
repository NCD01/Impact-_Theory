using UnityEngine;

namespace ImpactTheory.Runtime.View
{
    /// <summary>
    /// The gameplay camera: orbits a focus point, with distance and height under player control.
    /// </summary>
    /// <remarks>
    /// <para>
    /// An orbit rig rather than a fixed camera, because the player's central question is "what is
    /// holding this structure up?" (<c>Docs/GameDesign.md</c> §9) and that cannot be answered from
    /// one angle. Seeing behind the structure is gameplay, not a convenience.
    /// </para>
    /// <para>
    /// The camera never touches game logic. The off-platform rule is world-space geometry and
    /// "must reliably determine this state regardless of camera angle"
    /// (<c>Docs/GameDesign.md</c> §11), so nothing here can influence whether a piece counts as
    /// removed.
    /// </para>
    /// </remarks>
    public sealed class OrbitCameraRig : MonoBehaviour
    {
        private const float MinPitch = 6f;
        private const float MaxPitch = 78f;
        private const float MinDistance = 6f;
        private const float MaxDistance = 45f;

        private Camera _camera;
        // Start just behind and to the side of the launcher. Looking straight back from the
        // impact side made the trajectory collapse into a vertical screen-space line and hid the
        // structure behind it.
        private float _yaw = 0f;
        private float _pitch = 8f;
        private float _distance = 24f;

        public Camera Camera => _camera;

        public Vector3 Focus { get; set; } = new Vector3(0f, 2f, 0f);

        public float Yaw => _yaw;

        public static OrbitCameraRig Create(Transform parent = null)
        {
            GameObject go = new GameObject("CameraRig");
            go.transform.SetParent(parent, false);

            OrbitCameraRig rig = go.AddComponent<OrbitCameraRig>();

            GameObject cameraObject = new GameObject("Main Camera");
            cameraObject.transform.SetParent(go.transform, false);
            cameraObject.tag = "MainCamera";

            rig._camera = cameraObject.AddComponent<Camera>();
            rig._camera.fieldOfView = 55f;
            rig._camera.nearClipPlane = 0.1f;
            rig._camera.farClipPlane = 500f;
            rig._camera.backgroundColor = new Color(0.025f, 0.01f, 0.08f);
            rig._camera.clearFlags = CameraClearFlags.SolidColor;

            cameraObject.AddComponent<AudioListener>();

            rig.Apply();
            return rig;
        }

        /// <summary>Orbits by a relative amount, in degrees.</summary>
        public void Orbit(float yawDelta, float pitchDelta)
        {
            _yaw += yawDelta;

            // Inverted deliberately: dragging up should tilt the view down over the structure,
            // which is what every 3D editor and most games do.
            _pitch = Mathf.Clamp(_pitch - pitchDelta, MinPitch, MaxPitch);
            Apply();
        }

        /// <summary>Changes the orbit distance, in metres.</summary>
        public void Zoom(float delta)
        {
            _distance = Mathf.Clamp(_distance + delta, MinDistance, MaxDistance);
            Apply();
        }

        /// <summary>
        /// Frames the camera on a structure of a given size.
        /// </summary>
        /// <remarks>
        /// Called when a level loads so a tall tower and a low bridge both start readable. The
        /// game must not be tied to one fixed resolution or framing
        /// (<c>Docs/GameDesign.md</c> §6).
        /// </remarks>
        public void Frame(Vector3 centre, float radius)
        {
            Focus = centre;
            _distance = Mathf.Clamp(radius * 3.1f, 18f, MaxDistance);
            Apply();
        }

        private void LateUpdate() => Apply();

        private void Apply()
        {
            if (_camera == null)
            {
                return;
            }

            Quaternion rotation = Quaternion.Euler(_pitch, _yaw, 0f);
            Vector3 offset = rotation * new Vector3(0f, 0f, -_distance);

            _camera.transform.position = Focus + offset;
            _camera.transform.rotation = Quaternion.LookRotation(Focus - _camera.transform.position);
        }
    }
}
