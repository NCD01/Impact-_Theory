using ImpactTheory.Core;
using ImpactTheory.Runtime.View;
using ImpactTheory.Structure;
using UnityEngine;

namespace ImpactTheory.Runtime.Structure
{
    /// <summary>
    /// Builds the non-colliding mechanical stand beneath the playable platform.
    /// </summary>
    internal static class MechanicalPlatformPresentation
    {
        private static readonly Color Navy = new Color(0.055f, 0.13f, 0.25f);
        private static readonly Color Blue = new Color(0.08f, 0.25f, 0.47f);
        private static readonly Color Graphite = new Color(0.10f, 0.12f, 0.15f);
        private static readonly Color Orange = new Color(0.96f, 0.43f, 0.05f);

        public static GameObject Build(Transform parent, PlatformBounds bounds)
        {
            GameObject root = new GameObject("MechanicalPlatformPresentation");
            root.transform.SetParent(parent, false);

            float centreX = bounds.Centre.X;
            float frontZ = bounds.MinZ + 1.15f;

            // Layered front edge turns the large gameplay surface into a readable machine deck.
            CreateBox(root.transform, "FrontDeck",
                new Vector3(centreX, -0.58f, frontZ),
                new Vector3(bounds.Width + 0.8f, 0.55f, 1.45f), Navy);
            CreateBox(root.transform, "FrontDeckInset",
                new Vector3(centreX, -0.61f, frontZ - 0.74f),
                new Vector3(bounds.Width - 1.1f, 0.20f, 0.10f), Graphite);
            CreateBox(root.transform, "FrontDeckAccent",
                new Vector3(centreX, -0.42f, frontZ - 0.81f),
                new Vector3(bounds.Width - 2.0f, 0.10f, 0.08f), Orange);

            // Five blue supports echo the supplied pedestal reference.
            float[] supportX = { -4.6f, -2.3f, 0f, 2.3f, 4.6f };
            for (int i = 0; i < supportX.Length; i++)
            {
                float x = centreX + supportX[i];
                CreateCylinder(root.transform, $"Support{i + 1}",
                    new Vector3(x, -2.18f, frontZ + 0.12f),
                    new Vector3(0.88f, 1.35f, 0.88f), Blue);
                CreateCylinder(root.transform, $"SupportTopCap{i + 1}",
                    new Vector3(x, -0.79f, frontZ + 0.12f),
                    new Vector3(1.02f, 0.10f, 1.02f), Graphite);
                CreateCylinder(root.transform, $"SupportAccent{i + 1}",
                    new Vector3(x, -3.54f, frontZ + 0.12f),
                    new Vector3(0.98f, 0.08f, 0.98f), Orange);
            }

            // Lower rail, central jack and braces make the stand feel supported rather than like
            // another floating slab.
            CreateBox(root.transform, "LowerRail",
                new Vector3(centreX, -4.02f, frontZ + 0.28f),
                new Vector3(bounds.Width - 0.7f, 0.68f, 1.55f), Graphite);
            CreateBox(root.transform, "LowerRailFace",
                new Vector3(centreX, -4.02f, frontZ - 0.54f),
                new Vector3(bounds.Width - 2.0f, 0.18f, 0.08f), Orange);

            CreateBox(root.transform, "LeftBrace",
                new Vector3(centreX - 1.35f, -5.12f, frontZ + 0.25f),
                new Vector3(0.36f, 2.65f, 0.52f), Graphite,
                Quaternion.Euler(0f, 0f, -38f));
            CreateBox(root.transform, "RightBrace",
                new Vector3(centreX + 1.35f, -5.12f, frontZ + 0.25f),
                new Vector3(0.36f, 2.65f, 0.52f), Graphite,
                Quaternion.Euler(0f, 0f, 38f));

            CreateCylinder(root.transform, "JackCollar",
                new Vector3(centreX, -4.72f, frontZ + 0.20f),
                new Vector3(1.22f, 0.22f, 1.22f), Graphite);
            CreateCylinder(root.transform, "JackScrew",
                new Vector3(centreX, -5.45f, frontZ + 0.20f),
                new Vector3(0.38f, 0.72f, 0.38f), Graphite);
            CreateCylinder(root.transform, "JackGrip",
                new Vector3(centreX, -5.86f, frontZ + 0.20f),
                new Vector3(0.86f, 0.22f, 0.86f), Navy);
            CreateBox(root.transform, "PedestalBase",
                new Vector3(centreX, -6.35f, frontZ + 0.20f),
                new Vector3(4.2f, 0.72f, 2.30f), Graphite);
            CreateBox(root.transform, "PedestalFoot",
                new Vector3(centreX, -6.76f, frontZ + 0.20f),
                new Vector3(5.1f, 0.22f, 2.75f), Navy);

            return root;
        }

        private static GameObject CreateBox(
            Transform parent,
            string name,
            Vector3 position,
            Vector3 scale,
            Color colour,
            Quaternion? rotation = null)
        {
            GameObject part = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Prepare(part, parent, name, position, scale, colour, rotation ?? Quaternion.identity);
            return part;
        }

        private static GameObject CreateCylinder(
            Transform parent,
            string name,
            Vector3 position,
            Vector3 scale,
            Color colour)
        {
            GameObject part = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Prepare(part, parent, name, position, scale, colour, Quaternion.identity);
            return part;
        }

        private static void Prepare(
            GameObject part,
            Transform parent,
            string name,
            Vector3 position,
            Vector3 scale,
            Color colour,
            Quaternion rotation)
        {
            part.name = name;
            part.transform.SetParent(parent, false);
            part.transform.position = position;
            part.transform.rotation = rotation;
            part.transform.localScale = scale;

            Collider collider = part.GetComponent<Collider>();
            if (collider != null)
            {
                collider.enabled = false;
                if (Application.isPlaying)
                {
                    Object.Destroy(collider);
                }
                else
                {
                    Object.DestroyImmediate(collider);
                }
            }

            RuntimeMaterialFactory.Apply(part.GetComponent<Renderer>(), colour);
        }
    }
}
