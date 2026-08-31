using System.Collections.Generic;
using ImpactTheory.Physics;

namespace ImpactTheory.CoreTests
{
    /// <summary>
    /// Proves the settling rule that decides when a shot has finished resolving.
    /// </summary>
    /// <remarks>
    /// This gates the win check, so its failure modes are gameplay-visible: settle too early and
    /// the level is scored mid-collapse; never settle and the game appears frozen.
    /// </remarks>
    public static class SettlingTests
    {
        private static SettleSettings Settings() =>
            new SettleSettings(0.05f, 0.1f, 0.5f, 10f);

        private static List<BodyMotion> Bodies(params (string id, float linear, float angular)[] rows)
        {
            List<BodyMotion> list = new List<BodyMotion>(rows.Length);
            foreach ((string id, float linear, float angular) in rows)
            {
                list.Add(new BodyMotion(id, linear, angular));
            }

            return list;
        }

        private static SettleReport RunFor(
            SettleTracker tracker, float seconds, float step, List<BodyMotion> bodies)
        {
            SettleReport report = default;
            int steps = (int)System.Math.Round(seconds / step);
            for (int i = 0; i < steps; i++)
            {
                report = tracker.Step(step, bodies);
                if (report.IsResolved)
                {
                    break;
                }
            }

            return report;
        }

        [Test("a still scene settles once the dwell time has elapsed")]
        public static void StillSceneSettlesAfterDwell()
        {
            SettleTracker tracker = new SettleTracker(Settings());
            tracker.Begin();

            List<BodyMotion> still = Bodies(("a", 0f, 0f), ("b", 0.01f, 0.02f));
            SettleReport report = RunFor(tracker, 2f, 0.01f, still);

            Check.True(report.IsResolved, "a motionless scene never settled");
            Check.False(report.TimedOut, "settling was reported as a timeout");
            Check.Near(0.5f, report.Elapsed, 0.02f, "settle time should be the dwell time");
        }

        [Test("a scene is not settled before the dwell time has elapsed")]
        public static void NotSettledBeforeDwell()
        {
            // The reason the dwell exists: a body at the apex of a bounce is momentarily still.
            // Without a dwell requirement the level would be scored at that instant.
            SettleTracker tracker = new SettleTracker(Settings());
            tracker.Begin();

            List<BodyMotion> still = Bodies(("a", 0f, 0f));
            SettleReport report = RunFor(tracker, 0.3f, 0.01f, still);

            Check.False(report.IsResolved, "settled after only 0.3s against a 0.5s dwell");
        }

        [Test("motion above threshold restarts the dwell clock")]
        public static void MotionResetsTheDwell()
        {
            SettleTracker tracker = new SettleTracker(Settings());
            tracker.Begin();

            List<BodyMotion> still = Bodies(("a", 0f, 0f));
            List<BodyMotion> moving = Bodies(("a", 2f, 0f));

            // Almost settled...
            RunFor(tracker, 0.4f, 0.01f, still);

            // ...then it twitches, which must not count as 0.4s already banked.
            tracker.Step(0.01f, moving);

            SettleReport report = RunFor(tracker, 0.3f, 0.01f, still);
            Check.False(report.IsResolved, "the dwell clock was not reset by motion");

            report = RunFor(tracker, 0.4f, 0.01f, still);
            Check.True(report.IsResolved, "never settled after motion stopped");
        }

        [Test("angular motion alone prevents settling")]
        public static void SpinningBodyDoesNotSettle()
        {
            // A cylinder spinning in place has almost no linear speed. Checking linear velocity
            // alone would call this settled while the piece is visibly still rolling.
            SettleTracker tracker = new SettleTracker(Settings());
            tracker.Begin();

            List<BodyMotion> spinning = Bodies(("roller", 0.001f, 5f));
            SettleReport report = RunFor(tracker, 2f, 0.01f, spinning);

            Check.False(report.IsResolved, "a spinning body was treated as settled");
            Check.Equal(1, report.AboveAngularThreshold, "angular threshold count");
            Check.Equal(0, report.AboveLinearThreshold, "linear threshold count");
        }

        [Test("a scene that never settles resolves by timeout and says so")]
        public static void NeverSettlingSceneTimesOut()
        {
            SettleTracker tracker = new SettleTracker(Settings());
            tracker.Begin();

            List<BodyMotion> rolling = Bodies(("a", 1f, 3f), ("b", 0f, 0f));
            SettleReport report = RunFor(tracker, 12f, 0.01f, rolling);

            Check.True(report.IsResolved, "the shot never resolved");
            Check.True(report.TimedOut, "resolution was not flagged as a timeout");
            Check.True(report.Elapsed >= 10f, "resolved before the timeout expired");

            // Docs/Logging.md section 6 asks for a record that explains itself.
            Check.True(
                report.Describe().Contains("TIMEOUT") && report.Describe().Contains("still moving"),
                "the timeout report does not explain what was still moving: " + report.Describe());
        }

        [Test("an empty scene settles immediately")]
        public static void EmptySceneSettles()
        {
            // Reachable once every piece has left the platform and despawned. Without this the
            // tracker would sit out the full timeout with nothing to wait for.
            SettleTracker tracker = new SettleTracker(Settings());
            tracker.Begin();

            SettleReport report = tracker.Step(0.01f, new List<BodyMotion>());

            Check.True(report.IsResolved, "an empty scene did not settle");
            Check.False(report.TimedOut, "an empty scene reported a timeout");
        }

        [Test("Begin clears state so a second shot is measured independently")]
        public static void BeginResetsBetweenShots()
        {
            SettleTracker tracker = new SettleTracker(Settings());

            tracker.Begin();
            RunFor(tracker, 2f, 0.01f, Bodies(("a", 0f, 0f)));
            Check.True(tracker.IsResolved, "first shot did not settle");

            tracker.Begin();
            Check.False(tracker.IsResolved, "the tracker stayed resolved into the next shot");
            Check.Near(0f, tracker.Elapsed, 1e-6f, "elapsed time was not reset");
        }
    }
}
