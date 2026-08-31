using UnityEngine;

namespace ImpactTheory.Runtime.View
{
    /// <summary>
    /// The non-gameplay environment behind the first playable arena.
    /// </summary>
    /// <remarks>
    /// This is intentionally a presentation layer. It does not carry colliders, affect camera
    /// framing, or participate in scoring and physics. The image is loaded from Resources so the
    /// Web player includes it even though the world is built entirely at runtime.
    /// </remarks>
    public sealed class RetroArcadeBackdrop : MonoBehaviour
    {
        private const string TextureResourcePath = "Backgrounds/NCD_RetroArcade_Background_v2";
        private const string ShaderResourcePath = "Shaders/ImpactTheoryBackdrop";

        public static RetroArcadeBackdrop Create(Transform parent = null)
        {
            GameObject go = new GameObject("NCD Retro Arcade Backdrop");
            go.name = "NCD Retro Arcade Backdrop";
            go.transform.SetParent(parent, false);
            go.transform.SetPositionAndRotation(
                new Vector3(0f, 1.5f, 17f),
                Quaternion.Euler(0f, 180f, 0f));
            go.transform.localScale = new Vector3(60f, 46f, 1f);

            MeshFilter meshFilter = go.AddComponent<MeshFilter>();
            meshFilter.sharedMesh = CreateQuadMesh();
            MeshRenderer renderer = go.AddComponent<MeshRenderer>();

            RetroArcadeBackdrop backdrop = go.AddComponent<RetroArcadeBackdrop>();
            backdrop.ApplyMaterial(renderer);
            return backdrop;
        }

        private static Mesh CreateQuadMesh()
        {
            Mesh mesh = new Mesh { name = "Retro Arcade Backdrop Quad" };
            mesh.vertices = new[]
            {
                new Vector3(-0.5f, -0.5f, 0f),
                new Vector3(0.5f, -0.5f, 0f),
                new Vector3(-0.5f, 0.5f, 0f),
                new Vector3(0.5f, 0.5f, 0f),
            };
            mesh.uv = new[]
            {
                new Vector2(0f, 0f),
                new Vector2(1f, 0f),
                new Vector2(0f, 1f),
                new Vector2(1f, 1f),
            };
            mesh.triangles = new[] { 0, 2, 1, 2, 3, 1 };
            mesh.RecalculateBounds();
            return mesh;
        }

        private void ApplyMaterial(Renderer renderer)
        {
            Texture2D texture = Resources.Load<Texture2D>(TextureResourcePath);
            Shader shader = Resources.Load<Shader>(ShaderResourcePath);
            if (texture == null || shader == null)
            {
                Debug.LogError(
                    $"NCD retro arcade backdrop could not load texture or shader: " +
                    $"texture={texture != null}, shader={shader != null}");
                return;
            }

            Material material = new Material(shader)
            {
                hideFlags = HideFlags.DontSave,
                mainTexture = texture,
            };

            renderer.sharedMaterial = material;
        }
    }
}
