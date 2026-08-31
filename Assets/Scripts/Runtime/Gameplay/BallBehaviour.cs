using ImpactTheory.Core;
using ImpactTheory.Core.Logging;
using ImpactTheory.Physics;
using ImpactTheory.Runtime.Core;
using ImpactTheory.Runtime.Physics;
using ImpactTheory.Runtime.View;
using UnityEngine;

namespace ImpactTheory.Runtime.Gameplay
{
    /// <summary>
    /// <c>BALL_STANDARD</c> in the scene.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <strong>The ball is a physics object, not a weapon.</strong> Addendum 005 §7 and
    /// <c>Docs/Physics.md</c> §9 fix this: V1 balls transfer force through collision and have no
    /// hit points, no damage number, and no scripted destruction. A piece leaves the platform
    /// because momentum moved it, or it does not leave.
    /// </para>
    /// <para>
    /// There is deliberately no <c>OnCollisionEnter</c> handler applying extra force, no
    /// "destruction radius", and no piece-breaking logic. Everything that happens on impact is
    /// Unity resolving a collision between two rigid bodies with real masses.
    /// </para>
    /// </remarks>
    [RequireComponent(typeof(Rigidbody))]
    [RequireComponent(typeof(SphereCollider))]
    public sealed class BallBehaviour : MonoBehaviour
    {
        private Rigidbody _body;
        private PhysicsConfig _config;
        private Vector3 _origin;
        private bool _reportedImpact;

        public Rigidbody Body => _body;

        /// <summary>True once the ball has left the launcher.</summary>
        public bool IsLaunched { get; private set; }

        public static BallBehaviour Create(PhysicsConfig config, Transform parent = null)
        {
            GameObject go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "BALL_STANDARD";
            go.transform.SetParent(parent, false);
            go.transform.localScale = Vector3.one * (config.BallRadius * 2f);

            Renderer renderer = go.GetComponent<Renderer>();
            RuntimeMaterialFactory.Apply(renderer, new Color(1f, 0.35f, 0.08f));

            SphereCollider collider = go.GetComponent<SphereCollider>();
            collider.sharedMaterial = PhysicsBootstrap.CreateMaterial(
                config.GetMaterial(config.BallMaterial));

            BallBehaviour ball = go.AddComponent<BallBehaviour>();
            ball.Initialise(config);
            return ball;
        }

        private void Initialise(PhysicsConfig config)
        {
            _config = config;

            _body = GetComponent<Rigidbody>();
            _body.mass = config.BallMass;

            // The ball is the one genuinely fast object in the scene: 30 m/s against pieces a metre
            // across. Continuous dynamic detection is what stops it passing through a thin beam
            // between steps, and it is cheap because there is only ever one ball in flight.
            _body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            _body.interpolation = RigidbodyInterpolation.Interpolate;

            _body.isKinematic = true;
        }

        /// <summary>Parks the ball at the launch point, ready to fire.</summary>
        public void PrepareAt(Vector3 position)
        {
            IsLaunched = false;
            _reportedImpact = false;
            _origin = position;

            // Unity does not allow velocity writes while a body is kinematic. Clear the previous
            // shot while briefly dynamic, then park the ball; this keeps the launcher quiet without
            // changing the gameplay state seen by the next frame.
            _body.isKinematic = false;
            _body.linearVelocity = Vector3.zero;
            _body.angularVelocity = Vector3.zero;
            _body.isKinematic = true;
            transform.position = position;
        }

        /// <summary>Launches the ball. The velocity comes from the aim model, not from screen space.</summary>
        public void Launch(Vector3 velocity)
        {
            _body.isKinematic = false;
            _body.linearVelocity = velocity;
            IsLaunched = true;

            Log.Info(LogCategory.Physics, "ball launched", Log.Context(
                "speed", velocity.magnitude.ToString("0.##"),
                "direction", velocity.normalized.ToString("0.###"),
                "mass", _body.mass.ToString("0.#"),
                "momentum", (_body.mass * velocity.magnitude).ToString("0")));
        }

        /// <summary>This body's motion, so the ball participates in the settling rule.</summary>
        public BodyMotion GetMotion() => new BodyMotion(
            "BALL", _body.linearVelocity.magnitude, _body.angularVelocity.magnitude);

        /// <summary>
        /// True once the ball has stopped mattering to the shot.
        /// </summary>
        /// <remarks>
        /// A ball that sails past everything would otherwise hold the shot open until the settle
        /// timeout, which reads to a player as the game having frozen.
        /// </remarks>
        public bool HasEscaped =>
            IsLaunched &&
            (transform.position.y < _config.KillPlaneY ||
             Vector3.Distance(transform.position, _origin) > _config.BallDespawnDistance);

        private void OnCollisionEnter(Collision collision)
        {
            // Logged, not acted upon. The impact is Unity's to resolve; this only records it so a
            // collapse can be reconstructed afterwards.
            if (_reportedImpact || !IsLaunched)
            {
                return;
            }

            _reportedImpact = true;

            float speed = collision.relativeVelocity.magnitude;

            Log.Info(LogCategory.Physics, "first impact", Log.Context(
                "target", collision.gameObject.name,
                "relativeSpeed", speed.ToString("0.##"),
                "impulse", collision.impulse.magnitude.ToString("0.#"),
                "kineticEnergy", (0.5f * _body.mass * speed * speed).ToString("0")));
        }
    }
}
