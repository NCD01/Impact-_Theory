using System.Collections.Generic;
using ImpactTheory.Core.Math;
using ImpactTheory.Gameplay;
using ImpactTheory.Structure;

namespace ImpactTheory.CoreTests
{
    /// <summary>
    /// Proves the aim model and validates every hand-authored structure.
    /// </summary>
    /// <remarks>
    /// The structure checks matter more than they look. <c>Docs/GameDesign.md</c> §36 requires
    /// obviously invalid structures to be rejected before physics ever runs - pieces intersecting
    /// illegally, pieces outside the platform, pieces below the surface. Those rules were written
    /// for the procedural generator, but a hand-authored structure can break them just as easily,
    /// and a level that starts with two blocks inside each other explodes on the first frame.
    /// </remarks>
    public static class AimAndStructureTests
    {
        // ---------------------------------------------------------------- aim model

        [Test("aim direction is always a unit vector")]
        public static void DirectionIsNormalised()
        {
            AimModel aim = new AimModel();

            for (float yaw = -180f; yaw <= 180f; yaw += 37f)
            {
                for (float pitch = AimModel.MinPitchDegrees; pitch <= AimModel.MaxPitchDegrees; pitch += 11f)
                {
                    aim.YawDegrees = yaw;
                    aim.PitchDegrees = pitch;
                    Check.Near(1f, aim.Direction().Magnitude, 1e-4f, $"direction at {yaw}/{pitch}");
                }
            }
        }

        [Test("zero yaw and zero pitch aims straight down positive Z")]
        public static void ZeroAimPointsForward()
        {
            AimModel aim = new AimModel { YawDegrees = 0f, PitchDegrees = 0f };
            Check.Near(Vec3.Forward, aim.Direction(), 1e-4f, "direction");
        }

        [Test("positive pitch aims upward and negative pitch aims downward")]
        public static void PitchControlsElevation()
        {
            AimModel aim = new AimModel { YawDegrees = 0f, PitchDegrees = 45f };
            Check.True(aim.Direction().Y > 0f, "45 degrees of pitch did not aim upward");

            aim.PitchDegrees = -10f;
            Check.True(aim.Direction().Y < 0f, "negative pitch did not aim downward");
        }

        [Test("pitch is clamped to the usable range")]
        public static void PitchIsClamped()
        {
            // Below the minimum the ball ploughs into the ground in front of the launcher; above the
            // maximum it lobs harmlessly over everything. Neither is a shot worth spending a ball on.
            AimModel aim = new AimModel { PitchDegrees = 400f };
            Check.Near(AimModel.MaxPitchDegrees, aim.PitchDegrees, 1e-4f, "clamped high");

            aim.PitchDegrees = -400f;
            Check.Near(AimModel.MinPitchDegrees, aim.PitchDegrees, 1e-4f, "clamped low");
        }

        [Test("power is clamped to zero..one")]
        public static void PowerIsClamped()
        {
            AimModel aim = new AimModel();

            aim.Power = 5f;
            Check.Near(1f, aim.Power, 1e-5f, "clamped high");

            aim.Power = -5f;
            Check.Near(0f, aim.Power, 1e-5f, "clamped low");
        }

        [Test("yaw wraps rather than growing without bound")]
        public static void YawWraps()
        {
            // A player who spins the camera for a while would otherwise accumulate a yaw of several
            // thousand degrees, which is harmless until something formats it for the HUD.
            AimModel aim = new AimModel { YawDegrees = 540f };
            Check.True(aim.YawDegrees >= -180f && aim.YawDegrees <= 180f,
                $"yaw did not wrap: {aim.YawDegrees}");
        }

        [Test("power maps linearly from the minimum to the maximum launch speed")]
        public static void SpeedMapsLinearly()
        {
            AimModel aim = new AimModel();

            aim.Power = 0f;
            Check.Near(6f, aim.Speed(6f, 30f), 1e-4f, "speed at zero power");

            aim.Power = 1f;
            Check.Near(30f, aim.Speed(6f, 30f), 1e-4f, "speed at full power");

            aim.Power = 0.5f;
            Check.Near(18f, aim.Speed(6f, 30f), 1e-4f, "speed at half power");
        }

        [Test("a zero-power shot still leaves the launcher")]
        public static void MinimumPowerIsNotZero()
        {
            // Docs/GameDesign.md section 23 makes every ball count, so a shot that simply drops the
            // ball at the player's feet would spend one for nothing.
            AimModel aim = new AimModel { Power = 0f };
            Check.True(aim.Speed(6f, 30f) > 0f, "a zero-power shot has no speed at all");
        }

        [Test("the trajectory preview starts at the launcher and falls under gravity")]
        public static void TrajectoryIsBallistic()
        {
            AimModel aim = new AimModel { YawDegrees = 0f, PitchDegrees = 30f, Power = 1f };
            Vec3 origin = new Vec3(0f, 2.5f, -14f);

            Vec3[] path = aim.SampleTrajectory(origin, 6f, 30f, Vec3.Gravity, 24, 2f);

            Check.Equal(24, path.Length, "sample count");
            Check.Near(origin, path[0], 1e-4f, "the preview must start at the launch point");

            // Launched upward, so the path must rise, reach an apex, and start falling. Asserting
            // against the apex rather than against the last sample matters: at 30 degrees and
            // 30 m/s the apex is at t = 1.53 s, so a 2 s preview ends while the ball is still well
            // above where it started. Comparing first and last samples would be testing the
            // preview window, not the physics.
            int apex = 0;
            for (int i = 1; i < path.Length; i++)
            {
                if (path[i].Y > path[apex].Y)
                {
                    apex = i;
                }
            }

            Check.True(apex > 0, "the trajectory did not rise on an upward shot");
            Check.True(
                apex < path.Length - 1,
                $"the trajectory never came back down - apex is the last sample ({apex})");
            Check.True(
                path[path.Length - 1].Y < path[apex].Y,
                "the final sample is not below the apex");

            // And it must go forward, not sideways, at zero yaw.
            Check.True(path[23].Z > path[0].Z, "the trajectory did not travel forward");
            Check.Near(0f, path[23].X, 1e-3f, "the trajectory drifted sideways at zero yaw");
        }

        // ---------------------------------------------------------------- structures

        private static IEnumerable<StructureBlueprint> AllStructures()
        {
            List<StructureBlueprint> all = new List<StructureBlueprint>();
            all.AddRange(BuiltInStructures.Campaign());
            all.Add(BuiltInStructures.PlatformEdgeTest());
            return all;
        }

        [Test("every structure references only pieces that exist in the library")]
        public static void StructuresReferenceRealPieces()
        {
            foreach (StructureBlueprint blueprint in AllStructures())
            {
                Check.True(blueprint.Placements.Count > 0, $"{blueprint.Id} has no pieces");

                foreach (PiecePlacement placement in blueprint.Placements)
                {
                    Check.True(
                        PieceLibrary.Get(placement.DefinitionId) != null,
                        $"{blueprint.Id} references unknown piece {placement.DefinitionId}");
                }
            }
        }

        [Test("every structure grants at least one ball")]
        public static void StructuresGrantBalls()
        {
            foreach (StructureBlueprint blueprint in AllStructures())
            {
                Check.True(
                    blueprint.BallAllowance > 0,
                    $"{blueprint.Id} grants {blueprint.BallAllowance} balls, so it cannot be played");
            }
        }

        [Test("no piece starts below the platform surface")]
        public static void NoPieceStartsBuriedInThePlatform()
        {
            // A piece spawned intersecting the platform is ejected violently on the first physics
            // step, which looks like a physics bug and is actually an authoring bug.
            PlatformBounds platform = PlatformBounds.CreateDefault();

            foreach (StructureBlueprint blueprint in AllStructures())
            {
                foreach (PiecePlacement placement in blueprint.Placements)
                {
                    PieceState piece = PieceLibrary.Get(placement.DefinitionId)
                        .CreateInstance("t", placement.Position, placement.Rotation);

                    Check.True(
                        piece.GetLowestY() >= platform.TopY - 0.01f,
                        $"{blueprint.Id}/{placement.DefinitionId} starts at y={piece.GetLowestY():0.###}, " +
                        $"below the platform surface at {platform.TopY:0.###}");
                }
            }
        }

        [Test("campaign structures spawn entirely within the platform boundary")]
        public static void CampaignStructuresStartOnThePlatform()
        {
            // Docs/GameDesign.md section 12: "Structures must initially spawn completely within the
            // legal platform area unless a future game rule explicitly allows otherwise."
            //
            // The regression platform-edge fixture is the documented exception and is checked
            // separately below - overhanging the boundary is the entire point of that one.
            PlatformBounds platform = PlatformBounds.CreateDefault();
            OffPlatformEvaluator evaluator = new OffPlatformEvaluator();

            foreach (StructureBlueprint blueprint in BuiltInStructures.Campaign())
            {
                foreach (PiecePlacement placement in blueprint.Placements)
                {
                    PieceState piece = PieceLibrary.Get(placement.DefinitionId)
                        .CreateInstance("t", placement.Position, placement.Rotation);

                    foreach (OrientedBox box in piece.GetWorldColliders())
                    {
                        box.GetWorldBounds(out Vec3 min, out Vec3 max);

                        Check.True(
                            min.X >= platform.MinX - 0.01f && max.X <= platform.MaxX + 0.01f &&
                            min.Z >= platform.MinZ - 0.01f && max.Z <= platform.MaxZ + 0.01f,
                            $"{blueprint.Id}/{placement.DefinitionId} extends outside the platform: " +
                            $"x [{min.X:0.##}, {max.X:0.##}], z [{min.Z:0.##}, {max.Z:0.##}]");
                    }
                }

                // And a structure that starts already cleared would be a level with no game in it.
                Check.False(
                    evaluator.IsStructureCleared(
                        BuildStates(blueprint), platform, new SupportGraph()),
                    $"{blueprint.Id} is already cleared before a ball is fired");
            }
        }

        [Test("the platform-edge regression fixture really does overhang the boundary",
            Requirement = "VAL-015")]
        public static void EdgeFixtureOverhangsDeliberately()
        {
            // The documented exception to the rule above, asserted rather than assumed - if this
            // fixture ever stopped overhanging, it would silently stop testing what it exists for.
            PlatformBounds platform = PlatformBounds.CreateDefault();
            bool anyOverhang = false;

            foreach (PiecePlacement placement in BuiltInStructures.PlatformEdgeTest().Placements)
            {
                PieceState piece = PieceLibrary.Get(placement.DefinitionId)
                    .CreateInstance("t", placement.Position, placement.Rotation);

                foreach (OrientedBox box in piece.GetWorldColliders())
                {
                    box.GetWorldBounds(out Vec3 min, out Vec3 max);
                    if (max.X > platform.MaxX || min.X < platform.MinX ||
                        max.Z > platform.MaxZ || min.Z < platform.MinZ)
                    {
                        anyOverhang = true;
                    }
                }
            }

            Check.True(anyOverhang, "the platform-edge fixture no longer overhangs anything");
        }

        [Test("no two pieces start deeply intersecting each other")]
        public static void PiecesDoNotStartInsideEachOther()
        {
            // Docs/GameDesign.md section 36 lists "pieces intersecting illegally" and "excessive
            // clipping" as grounds for rejecting a structure before simulating it. Overlapping
            // rigid bodies are resolved by the solver pushing them apart hard, so a structure that
            // starts clipped detonates on load.
            //
            // The tolerance allows the small shared faces that stacking legitimately produces and
            // the modelled joints inside a compound piece.
            const float allowedPenetration = 0.05f;

            foreach (StructureBlueprint blueprint in AllStructures())
            {
                List<PieceState> pieces = BuildStates(blueprint);

                for (int i = 0; i < pieces.Count; i++)
                {
                    for (int j = i + 1; j < pieces.Count; j++)
                    {
                        AssertNotDeeplyOverlapping(
                            blueprint.Id, pieces[i], pieces[j], allowedPenetration);
                    }
                }
            }
        }

        private static List<PieceState> BuildStates(StructureBlueprint blueprint)
        {
            List<PieceState> pieces = new List<PieceState>();
            int index = 0;

            foreach (PiecePlacement placement in blueprint.Placements)
            {
                pieces.Add(PieceLibrary.Get(placement.DefinitionId).CreateInstance(
                    $"{placement.DefinitionId}#{index++}",
                    placement.Position,
                    placement.Rotation,
                    placement.Required));
            }

            return pieces;
        }

        private static void AssertNotDeeplyOverlapping(
            string blueprintId, PieceState a, PieceState b, float allowed)
        {
            foreach (OrientedBox boxA in a.GetWorldColliders())
            {
                boxA.GetWorldBounds(out Vec3 minA, out Vec3 maxA);

                foreach (OrientedBox boxB in b.GetWorldColliders())
                {
                    boxB.GetWorldBounds(out Vec3 minB, out Vec3 maxB);

                    float overlapX = MathUtil.Min(maxA.X, maxB.X) - MathUtil.Max(minA.X, minB.X);
                    float overlapY = MathUtil.Min(maxA.Y, maxB.Y) - MathUtil.Max(minA.Y, minB.Y);
                    float overlapZ = MathUtil.Min(maxA.Z, maxB.Z) - MathUtil.Max(minA.Z, minB.Z);

                    if (overlapX <= allowed || overlapY <= allowed || overlapZ <= allowed)
                    {
                        continue;
                    }

                    throw new TestFailure(
                        $"{blueprintId}: {a.PieceId} and {b.PieceId} start intersecting by " +
                        $"({overlapX:0.###}, {overlapY:0.###}, {overlapZ:0.###}) m");
                }
            }
        }
    }
}
