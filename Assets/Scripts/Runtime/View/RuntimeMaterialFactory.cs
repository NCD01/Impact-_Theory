using System;
using ImpactTheory.Core;
using UnityEngine;

namespace ImpactTheory.Runtime.View
{
    /// <summary>
    /// Creates the small runtime material palette used by generated gameplay geometry.
    /// </summary>
    /// <remarks>
    /// Unity's built-in primitive material can be stripped from a Web build when no serialized
    /// scene or material asset references its shader. The result is Unity's bright magenta error
    /// surface even though the renderer works. This factory loads a project-owned shader from
    /// Resources, which makes inclusion in the Web player explicit and deterministic.
    /// </remarks>
    public static class RuntimeMaterialFactory
    {
        public const string ShaderResourcePath = "Shaders/ImpactTheoryFlatLit";
        public const string ShaderName = "Impact Theory/Flat Lit";

        private static Shader _shader;

        public static Shader GetShader()
        {
            if (_shader != null)
            {
                return _shader;
            }

            _shader = Resources.Load<Shader>(ShaderResourcePath);
            if (_shader == null)
            {
                _shader = Shader.Find(ShaderName);
            }

            if (_shader == null)
            {
                throw new InvalidOperationException(
                    $"Required runtime shader '{ShaderName}' was not included in the player.");
            }

            return _shader;
        }

        public static Material Create(Color colour)
        {
            Material material = new Material(GetShader())
            {
                color = colour,
                hideFlags = HideFlags.DontSave,
            };

            return material;
        }

        public static void Apply(Renderer renderer, Color colour)
        {
            if (renderer != null)
            {
                renderer.sharedMaterial = Create(colour);
            }
        }

        public static Color ColourFor(MaterialFamily material)
        {
            switch (material)
            {
                case MaterialFamily.Wood:
                    return new Color(0.96f, 0.43f, 0.05f);
                case MaterialFamily.Brick:
                    return new Color(0.88f, 0.25f, 0.04f);
                case MaterialFamily.Stone:
                    return new Color(0.25f, 0.29f, 0.35f);
                case MaterialFamily.Concrete:
                    return new Color(0.17f, 0.21f, 0.27f);
                case MaterialFamily.Steel:
                    return new Color(0.13f, 0.31f, 0.55f);
                case MaterialFamily.PaintedSteel:
                    return new Color(0.06f, 0.16f, 0.31f);
                case MaterialFamily.Rubber:
                    return new Color(0.16f, 0.18f, 0.20f);
                default:
                    return new Color(0.45f, 0.47f, 0.50f);
            }
        }
    }
}
