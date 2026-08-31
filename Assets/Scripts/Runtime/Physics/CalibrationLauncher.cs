using UnityEngine;

namespace ImpactTheory.Runtime.Physics
{
    /// <summary>
    /// Starts the calibration harness when play mode begins.
    /// </summary>
    /// <remarks>
    /// <para>
    /// A separate component from <see cref="CalibrationRunner"/> for one practical reason: the
    /// editor menu item places this in the scene <em>before</em> entering play mode, and the
    /// runner's own <c>Start</c> would otherwise fire during edit mode where there is no physics
    /// stepping and coroutines do not run.
    /// </para>
    /// <para>
    /// It also suppresses the normal game bootstrap, so the calibration scene contains only the
    /// experiment. Running the game and the calibration harness in the same scene would put two
    /// platforms and two sets of pieces in one physics world, and the results would be meaningless.
    /// </para>
    /// </remarks>
    public sealed class CalibrationLauncher : MonoBehaviour
    {
        private void Awake() => GameBootstrap.AutoStartEnabled = false;

        private void Start()
        {
            Debug.Log("[Impact Theory] Starting physics calibration. This produces the VAL-014 " +
                      "baseline; read the report against each scenario's stated expectation.");

            CalibrationRunner.Launch();
        }
    }
}
