using ImpactTheory.Core;
using ImpactTheory.Physics;
using ImpactTheory.Runtime.Core;
using ImpactTheory.Runtime.Physics;
using ImpactTheory.Runtime.View;
using ImpactTheory.Structure;
using UnityEngine;

namespace ImpactTheory.Runtime.Structure
{
    /// <summary>
    /// The playable platform in the scene.
    /// </summary>
    /// <remarks>
    /// Holds the authoritative <see cref="PlatformBounds"/> that the off-platform rule tests
    /// against, so the boundary the player sees and the boundary the rule uses are the same object
    /// rather than two numbers that can drift apart.
    /// </remarks>
    public sealed class PlatformBehaviour : MonoBehaviour
    {
        public PlatformBounds Bounds { get; private set; }

        public static PlatformBehaviour Create(
            PlatformBounds bounds, PhysicsConfig config, Transform parent = null)
        {
            GameObject go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = "Platform";
            go.transform.SetParent(parent, false);
            go.transform.position = bounds.Centre.ToUnity();
            go.transform.localScale = new Vector3(bounds.Width, bounds.Height, bounds.Depth);

            BoxCollider collider = go.GetComponent<BoxCollider>();
            collider.sharedMaterial = PhysicsBootstrap.CreateMaterial(
                config.GetMaterial(MaterialFamily.Concrete));

            Renderer renderer = go.GetComponent<Renderer>();
            RuntimeMaterialFactory.Apply(renderer, new Color(0.055f, 0.13f, 0.25f));

            // Presentation is kept separate from the authoritative platform collider. The stand
            // looks substantial but never changes the off-platform rule or catches falling pieces.
            MechanicalPlatformPresentation.Build(parent, bounds);

            PlatformBehaviour platform = go.AddComponent<PlatformBehaviour>();
            platform.Bounds = bounds;
            return platform;
        }

        /// <summary>
        /// Draws the boundary in the editor.
        /// </summary>
        /// <remarks>
        /// <c>Docs/Logging.md</c> §5 singles the platform boundary out as one of the two overlay
        /// items that carry real weight: when a piece is judged still supported and a tester
        /// disagrees, the drawn boundary is what settles the argument.
        /// </remarks>
        private void OnDrawGizmos()
        {
            if (Bounds == null)
            {
                return;
            }

            Gizmos.color = new Color(1f, 0.85f, 0.2f, 0.9f);

            Vector3 a = new Vector3(Bounds.MinX, Bounds.TopY, Bounds.MinZ);
            Vector3 b = new Vector3(Bounds.MaxX, Bounds.TopY, Bounds.MinZ);
            Vector3 c = new Vector3(Bounds.MaxX, Bounds.TopY, Bounds.MaxZ);
            Vector3 d = new Vector3(Bounds.MinX, Bounds.TopY, Bounds.MaxZ);

            Gizmos.DrawLine(a, b);
            Gizmos.DrawLine(b, c);
            Gizmos.DrawLine(c, d);
            Gizmos.DrawLine(d, a);
        }
    }
}
