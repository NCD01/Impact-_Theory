using ImpactTheory.Core;
using ImpactTheory.Physics;
using ImpactTheory.Runtime.Structure;
using ImpactTheory.Runtime.View;
using ImpactTheory.Structure;
using NUnit.Framework;
using UnityEngine;

namespace ImpactTheory.RuntimeTests
{
    [TestFixture]
    public sealed class RuntimePresentationTests
    {
        [Test]
        public void ProjectShaderIsAvailable()
        {
            Shader shader = RuntimeMaterialFactory.GetShader();

            Assert.That(shader, Is.Not.Null);
            Assert.That(shader.name, Is.EqualTo(RuntimeMaterialFactory.ShaderName));
        }

        [Test]
        public void GeneratedPieceHasVisibleGeometryAndSupportedMaterials()
        {
            StructurePieceBehaviour piece = StructurePieceBehaviour.Create(
                "visual-test",
                PieceLibrary.Get("B01_SMALL_BLOCK"),
                MaterialFamily.Wood,
                Vector3.zero,
                Quaternion.identity,
                new PhysicsConfig());

            try
            {
                Renderer[] renderers = piece.GetComponentsInChildren<Renderer>();
                Assert.That(renderers.Length, Is.GreaterThan(0));

                foreach (Renderer renderer in renderers)
                {
                    Assert.That(renderer.sharedMaterial, Is.Not.Null);
                    Assert.That(renderer.sharedMaterial.shader, Is.Not.Null);
                    Assert.That(renderer.sharedMaterial.shader.name,
                        Is.EqualTo(RuntimeMaterialFactory.ShaderName));
                }
            }
            finally
            {
                Object.DestroyImmediate(piece.gameObject);
            }
        }

        [Test]
        public void MechanicalStandIsVisibleButCannotAffectPhysics()
        {
            GameObject root = new GameObject("platform-presentation-test");

            try
            {
                PlatformBehaviour.Create(
                    PlatformBounds.CreateDefault(), new PhysicsConfig(), root.transform);

                Transform stand = root.transform.Find("MechanicalPlatformPresentation");
                Assert.That(stand, Is.Not.Null);
                Assert.That(stand.GetComponentsInChildren<Renderer>().Length, Is.GreaterThan(12));
                Assert.That(stand.GetComponentsInChildren<Collider>().Length, Is.EqualTo(0),
                    "visual stand parts must not catch balls or falling structure pieces");
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        [Test]
        public void DefaultCameraStartsBehindTheLauncherSide()
        {
            OrbitCameraRig rig = OrbitCameraRig.Create();

            try
            {
                rig.Frame(new Vector3(0f, 3f, 0f), 6f);

                Assert.That(rig.Camera.transform.position.z, Is.LessThan(rig.Focus.z));
                Assert.That(rig.Yaw, Is.InRange(0f, 45f));
            }
            finally
            {
                Object.DestroyImmediate(rig.gameObject);
            }
        }
    }
}
