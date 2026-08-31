using UnityEngine;

namespace ImpactTheory.Runtime.View
{
    /// <summary>
    /// A small readable arcade launcher assembled from renderable primitives.
    /// </summary>
    /// <remarks>
    /// The launcher is presentation only. The gameplay ball remains the single physics object and
    /// its muzzle position is supplied by <see cref="ImpactTheory.Runtime.Gameplay.GameDirector"/>.
    /// </remarks>
    public sealed class ArcadeLauncher : MonoBehaviour
    {
        public static ArcadeLauncher Create(Vector3 muzzlePosition, Transform parent = null)
        {
            GameObject rootObject = new GameObject("NCD Arcade Launcher");
            rootObject.transform.SetParent(parent, false);

            ArcadeLauncher launcher = rootObject.AddComponent<ArcadeLauncher>();
            launcher.Build(muzzlePosition);
            return launcher;
        }

        private void Build(Vector3 muzzlePosition)
        {
            CreatePrimitive(
                PrimitiveType.Cylinder,
                "Launcher Base",
                new Vector3(muzzlePosition.x, -6.8f, muzzlePosition.z),
                Quaternion.identity,
                new Vector3(2.8f, 0.42f, 2.8f),
                new Color(0.92f, 0.20f, 0.78f));

            CreatePrimitive(
                PrimitiveType.Cylinder,
                "Launcher Stem",
                new Vector3(muzzlePosition.x, -5.35f, muzzlePosition.z),
                Quaternion.identity,
                new Vector3(1.55f, 1.05f, 1.55f),
                new Color(0.06f, 0.62f, 0.95f));

            Vector3 barrelStart = new Vector3(muzzlePosition.x, -3.1f, muzzlePosition.z - 1.9f);
            Vector3 barrelDirection = muzzlePosition - barrelStart;
            CreatePrimitive(
                PrimitiveType.Cylinder,
                "Launcher Barrel",
                barrelStart + (barrelDirection * 0.5f),
                Quaternion.FromToRotation(Vector3.up, barrelDirection.normalized),
                new Vector3(1.05f, barrelDirection.magnitude * 0.5f, 1.05f),
                new Color(0.18f, 0.10f, 0.46f));

            CreatePrimitive(
                PrimitiveType.Cylinder,
                "Launcher Muzzle",
                muzzlePosition,
                Quaternion.Euler(90f, 0f, 0f),
                new Vector3(1.28f, 0.18f, 1.28f),
                new Color(1f, 0.55f, 0.08f));
        }

        private GameObject CreatePrimitive(
            PrimitiveType type,
            string objectName,
            Vector3 position,
            Quaternion rotation,
            Vector3 scale,
            Color colour)
        {
            GameObject part = GameObject.CreatePrimitive(type);
            part.name = objectName;
            part.transform.SetParent(transform, false);
            part.transform.SetPositionAndRotation(position, rotation);
            part.transform.localScale = scale;

            // These are visual launcher parts, not gameplay obstacles. CreatePrimitive adds a
            // collider automatically, and leaving it enabled makes the ball collide with the
            // muzzle on the first physics step instead of reaching the structure.
            Collider generatedCollider = part.GetComponent<Collider>();
            if (generatedCollider != null)
            {
                generatedCollider.enabled = false;
            }

            RuntimeMaterialFactory.Apply(part.GetComponent<Renderer>(), colour);
            return part;
        }
    }
}
