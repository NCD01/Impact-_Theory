using System.Collections.Generic;
using ImpactTheory.Core;
using ImpactTheory.Core.Math;
using ImpactTheory.Physics;
using ImpactTheory.Runtime.Core;
using ImpactTheory.Runtime.Physics;
using ImpactTheory.Runtime.View;
using ImpactTheory.Structure;
using UnityEngine;

namespace ImpactTheory.Runtime.Structure
{
    /// <summary>
    /// One structural piece in the scene: a rigid body, its colliders, and its contact reporting.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The engine adapter for <see cref="PieceState"/>. Unity simulates; this pushes the resulting
    /// transform back into the core object that the win condition reasons about, and reports which
    /// bodies are holding this one up.
    /// </para>
    /// <para>
    /// It contains no rules. Whether this piece counts as removed is
    /// <see cref="OffPlatformEvaluator"/>'s decision, and that lives in tested, engine-free code.
    /// </para>
    /// </remarks>
    [RequireComponent(typeof(Rigidbody))]
    public sealed class StructurePieceBehaviour : MonoBehaviour
    {
        /// <summary>
        /// How far below this body's centre a contact must sit before it counts as support.
        /// </summary>
        /// <remarks>
        /// Small, but not zero. Two blocks standing side by side touch at points scattered around
        /// their shared face, some a hair below centre through numerical noise; without a margin
        /// they would each report the other as support and a cleared level would never register.
        /// </remarks>
        private const float SupportContactMargin = 0.02f;

        private readonly HashSet<string> _supporters = new HashSet<string>();
        private readonly HashSet<string> _pending = new HashSet<string>();

        private Rigidbody _body;

        /// <summary>The core state object this behaviour drives.</summary>
        public PieceState State { get; private set; }

        public PieceDefinition Definition { get; private set; }

        public MaterialFamily Material { get; private set; }

        public Rigidbody Body => _body;

        /// <summary>What is currently holding this piece up, as of the last physics step.</summary>
        public IReadOnlyCollection<string> Supporters => _supporters;

        /// <summary>
        /// Builds a piece in the scene from its definition.
        /// </summary>
        /// <remarks>
        /// Everything physical is derived from data: mass from
        /// <c>Mass = Volume x EffectiveDensity</c>, friction and restitution from the material
        /// table, and colliders from the definition's compound parts. Nothing is set by hand on a
        /// prefab, which is what <c>Docs/Physics.md</c> §5 and §10 require.
        /// </remarks>
        public static StructurePieceBehaviour Create(
            string instanceId,
            PieceDefinition definition,
            MaterialFamily material,
            Vector3 position,
            Quaternion rotation,
            PhysicsConfig config,
            Transform parent = null,
            bool required = true)
        {
            GameObject go = new GameObject(instanceId);
            go.transform.SetParent(parent, false);
            go.transform.SetPositionAndRotation(position, rotation);

            StructurePieceBehaviour piece = go.AddComponent<StructurePieceBehaviour>();
            piece.Initialise(instanceId, definition, material, config, required);
            return piece;
        }

        private void Initialise(
            string instanceId,
            PieceDefinition definition,
            MaterialFamily material,
            PhysicsConfig config,
            bool required)
        {
            Definition = definition;
            Material = material;

            MaterialPhysics physics = config.GetMaterial(material);
            PhysicsMaterial unityMaterial = PhysicsBootstrap.CreateMaterial(physics);

            BuildColliders(definition, unityMaterial);
            BuildVisuals(definition, material);

            _body = GetComponent<Rigidbody>();
            _body.mass = definition.MassKg(physics.EffectiveDensity);

            // Structural pieces are large and slow relative to the ball, so discrete detection is
            // adequate for piece-on-piece contact. The ball is the fast object and carries
            // continuous detection instead - see BallBehaviour.
            _body.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
            _body.interpolation = RigidbodyInterpolation.Interpolate;

            State = new PieceState(
                instanceId,
                definition.Id,
                definition.GetColliderBoxes(),
                transform.position.ToCore(),
                transform.rotation.ToCore(),
                required);
        }

        private void BuildColliders(PieceDefinition definition, PhysicsMaterial unityMaterial)
        {
            foreach (ColliderPart part in definition.Colliders)
            {
                // A part that is rotated relative to the piece needs its own child transform;
                // Unity's primitive colliders have a centre but no orientation of their own.
                Transform host = transform;
                bool rotated = part.Rotation != Quat.Identity;

                if (rotated)
                {
                    GameObject child = new GameObject("Collider");
                    child.transform.SetParent(transform, false);
                    child.transform.localPosition = part.Centre.ToUnity();
                    child.transform.localRotation = part.Rotation.ToUnity();
                    host = child.transform;
                }

                Vector3 centre = rotated ? Vector3.zero : part.Centre.ToUnity();
                Vector3 size = (part.HalfExtents * 2f).ToUnity();

                switch (part.Kind)
                {
                    case ColliderKind.Cylinder:
                        AddCylinder(host, centre, part, unityMaterial);
                        break;

                    default:
                        // Boxes cover the rectangular pieces, and the wedge too. A wedge's shadow
                        // is its full base rectangle, so a box is exact for the footprint test and
                        // slightly generous only for the sloped face - which a convex hull will
                        // replace once real V1 meshes are imported (TODO-005).
                        BoxCollider box = host.gameObject.AddComponent<BoxCollider>();
                        box.center = centre;
                        box.size = size;
                        box.sharedMaterial = unityMaterial;
                        break;
                }
            }
        }

        /// <summary>
        /// Builds a visible counterpart for every collider part.
        /// </summary>
        /// <remarks>
        /// The first playable uses collision-matched primitives until the V2 FBX library is wired
        /// into runtime loading. Previously these objects had colliders and rigid bodies only, so
        /// the structure existed physically but was completely invisible to the player.
        /// </remarks>
        private void BuildVisuals(PieceDefinition definition, MaterialFamily material)
        {
            Color colour = RuntimeMaterialFactory.ColourFor(material);
            int index = 0;

            foreach (ColliderPart part in definition.Colliders)
            {
                bool cylinder = part.Kind == ColliderKind.Cylinder;
                GameObject visual = GameObject.CreatePrimitive(
                    cylinder ? PrimitiveType.Cylinder : PrimitiveType.Cube);

                visual.name = $"Visual_{index++:00}";
                visual.transform.SetParent(transform, false);
                visual.transform.localPosition = part.Centre.ToUnity();

                Quaternion rotation = part.Rotation.ToUnity();
                if (cylinder)
                {
                    float halfHeight;
                    float radius;
                    Quaternion axisRotation;

                    switch (part.Axis)
                    {
                        case CylinderAxis.X:
                            halfHeight = part.HalfExtents.X;
                            radius = Mathf.Min(part.HalfExtents.Y, part.HalfExtents.Z);
                            axisRotation = Quaternion.Euler(0f, 0f, 90f);
                            break;
                        case CylinderAxis.Z:
                            halfHeight = part.HalfExtents.Z;
                            radius = Mathf.Min(part.HalfExtents.X, part.HalfExtents.Y);
                            axisRotation = Quaternion.Euler(90f, 0f, 0f);
                            break;
                        default:
                            halfHeight = part.HalfExtents.Y;
                            radius = Mathf.Min(part.HalfExtents.X, part.HalfExtents.Z);
                            axisRotation = Quaternion.identity;
                            break;
                    }

                    visual.transform.localRotation = rotation * axisRotation;
                    visual.transform.localScale = new Vector3(radius * 2f, halfHeight, radius * 2f);
                }
                else
                {
                    visual.transform.localRotation = rotation;
                    visual.transform.localScale = (part.HalfExtents * 2f).ToUnity();
                }

                // CreatePrimitive adds its own collider. Physics is already represented by the
                // authoritative colliders above, so this duplicate must never join the simulation.
                Collider generatedCollider = visual.GetComponent<Collider>();
                if (generatedCollider != null)
                {
                    generatedCollider.enabled = false;
                    if (Application.isPlaying)
                    {
                        Destroy(generatedCollider);
                    }
                    else
                    {
                        DestroyImmediate(generatedCollider);
                    }
                }

                RuntimeMaterialFactory.Apply(visual.GetComponent<Renderer>(), colour);
            }
        }

        /// <summary>
        /// Approximates a cylinder with a capsule.
        /// </summary>
        /// <remarks>
        /// Unity has no cylinder collider. A capsule is the closest primitive and, critically, it
        /// <em>rolls</em> - which is the entire reason <c>A04_ROLLER</c> exists (Addendum 003 §7,
        /// <c>Docs/Physics.md</c> §6, which says never a box). The capsule's rounded ends make it
        /// slightly shorter in contact than a true cylinder; that is a known approximation to
        /// revisit during calibration, and it is far better than removing the rolling behaviour.
        /// </remarks>
        private static void AddCylinder(
            Transform host, Vector3 centre, ColliderPart part, PhysicsMaterial unityMaterial)
        {
            CapsuleCollider capsule = host.gameObject.AddComponent<CapsuleCollider>();
            capsule.center = centre;
            capsule.sharedMaterial = unityMaterial;

            switch (part.Axis)
            {
                case CylinderAxis.X:
                    capsule.direction = 0;
                    capsule.height = part.HalfExtents.X * 2f;
                    capsule.radius = Mathf.Min(part.HalfExtents.Y, part.HalfExtents.Z);
                    break;

                case CylinderAxis.Z:
                    capsule.direction = 2;
                    capsule.height = part.HalfExtents.Z * 2f;
                    capsule.radius = Mathf.Min(part.HalfExtents.X, part.HalfExtents.Y);
                    break;

                default:
                    capsule.direction = 1;
                    capsule.height = part.HalfExtents.Y * 2f;
                    capsule.radius = Mathf.Min(part.HalfExtents.X, part.HalfExtents.Z);
                    break;
            }
        }

        /// <summary>Copies the simulated transform into the core state object.</summary>
        public void SyncStateFromTransform() =>
            State.SetTransform(transform.position.ToCore(), transform.rotation.ToCore());

        /// <summary>This body's motion, for the settling rule.</summary>
        public BodyMotion GetMotion() => new BodyMotion(
            State.PieceId,
            _body.linearVelocity.magnitude,
            _body.angularVelocity.magnitude);

        private void FixedUpdate()
        {
            // Contacts are reported by Unity after the step, so the set filled during the previous
            // step becomes the answer for this one. Swapping here rather than clearing means the
            // supporter set is never momentarily empty, which would otherwise let a settled piece
            // read as unsupported for a single frame and win the level early.
            _supporters.Clear();
            foreach (string supporter in _pending)
            {
                _supporters.Add(supporter);
            }

            _pending.Clear();
        }

        private void OnCollisionStay(Collision collision) => RecordContacts(collision);

        private void OnCollisionEnter(Collision collision) => RecordContacts(collision);

        /// <summary>
        /// Decides, from contact geometry, whether the other body is holding this one up.
        /// </summary>
        /// <remarks>
        /// <para>
        /// This is the one genuinely heuristic step in the win condition, and it is deliberately
        /// confined here rather than spread through the rules. Two conditions must both hold: the
        /// contact must sit below this body's centre of mass, and the other body's centre must sit
        /// below this one's.
        /// </para>
        /// <para>
        /// Requiring both is what keeps a pile of fallen pieces from propping itself up on
        /// paperwork. Contact alone would mean two blocks resting side by side each "supported" the
        /// other, so a single piece brushing something still on the platform would mark the whole
        /// pile supported and the level could never complete - which is exactly why
        /// <see cref="SupportGraph"/> takes directed edges and not contacts.
        /// </para>
        /// </remarks>
        private void RecordContacts(Collision collision)
        {
            float myCentreY = _body.worldCenterOfMass.y;

            string otherId = ResolveContactId(collision, out float otherCentreY);
            if (otherId == null)
            {
                return;
            }

            if (otherCentreY >= myCentreY)
            {
                return;
            }

            int contactCount = collision.contactCount;
            for (int i = 0; i < contactCount; i++)
            {
                if (collision.GetContact(i).point.y < myCentreY - SupportContactMargin)
                {
                    _pending.Add(otherId);
                    return;
                }
            }
        }

        private static string ResolveContactId(Collision collision, out float centreY)
        {
            StructurePieceBehaviour otherPiece =
                collision.collider.GetComponentInParent<StructurePieceBehaviour>();

            if (otherPiece != null)
            {
                centreY = otherPiece._body.worldCenterOfMass.y;
                return otherPiece.State.PieceId;
            }

            PlatformBehaviour platform =
                collision.collider.GetComponentInParent<PlatformBehaviour>();

            if (platform != null)
            {
                centreY = platform.transform.position.y;
                return PlatformBounds.NodeId;
            }

            // Ground, debris walls, and anything else are not the platform, and resting on them is
            // precisely what "removed" means.
            centreY = 0f;
            return null;
        }
    }
}
