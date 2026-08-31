using System.Globalization;
using System.Threading;
using ImpactTheory.Save;

namespace ImpactTheory.CoreTests
{
    /// <summary>
    /// Proves the save format, its migration path, and its behaviour on corrupt data.
    /// </summary>
    /// <remarks>
    /// <c>Docs/GameDesign.md</c> §48 sets the standard these tests hold the system to: normal
    /// updates must not silently corrupt or invalidate existing player data. Most of these tests
    /// are about that sentence.
    /// </remarks>
    public static class SaveTests
    {
        private static SaveData Populated()
        {
            SaveData data = new SaveData { TutorialSeen = true, Volume = 0.65f };
            data.RecordAttempt("REG_SIMPLE_TOWER", cleared: true, score: 1750, ballsUsed: 2);
            data.RecordAttempt("REG_TWO_COLUMN_BEAM", cleared: false, score: 0, ballsUsed: 4);
            data.RecordAttempt("LVL_GATEHOUSE", cleared: true, score: 2400, ballsUsed: 1);
            return data;
        }

        [Test("a save round-trips through JSON without losing anything", Requirement = "VAL-007")]
        public static void RoundTripPreservesEverything()
        {
            SaveData original = Populated();
            SaveData restored = SaveSerializer.Deserialize(SaveSerializer.Serialize(original));

            Check.Equal(original.SchemaVersion, restored.SchemaVersion, "schema version");
            Check.True(restored.TutorialSeen, "tutorialSeen");
            Check.Near(0.65f, restored.Volume, 1e-4f, "volume");
            Check.Equal(3, restored.Levels.Count, "level count");

            LevelProgress tower = restored.Get("REG_SIMPLE_TOWER");
            Check.True(tower != null, "tower progress is missing");
            Check.True(tower.Completed, "tower completed flag");
            Check.Equal(1750, tower.BestScore, "tower best score");
            Check.Equal(2, tower.BestBallCount, "tower best ball count");
            Check.Equal(1, tower.TimesPlayed, "tower times played");

            LevelProgress beam = restored.Get("REG_TWO_COLUMN_BEAM");
            Check.False(beam.Completed, "a failed attempt was recorded as completed");
            Check.Equal(0, beam.BestBallCount, "a failed attempt set a best ball count");
            Check.Equal(1, beam.TimesPlayed, "failed attempts should still count as played");
        }

        [Test("the save format does not depend on the machine's number formatting",
            Requirement = "VAL-007")]
        public static void SerialisationIsCultureInvariant()
        {
            // On a machine with a comma decimal separator, a naive serialiser writes "0,65" and
            // produces a file every other machine rejects. This is the classic save-corruption bug
            // and it only ever reproduces on someone else's computer.
            CultureInfo original = Thread.CurrentThread.CurrentCulture;

            try
            {
                Thread.CurrentThread.CurrentCulture = new CultureInfo("de-DE");

                SaveData data = new SaveData { Volume = 0.65f };
                string json = SaveSerializer.Serialize(data);

                Check.True(
                    json.Contains("0.65"),
                    $"volume was not written with an invariant decimal point: {json}");
                Check.False(json.Contains("0,65"), "volume was written with a comma separator");

                Check.Near(0.65f, SaveSerializer.Deserialize(json).Volume, 1e-4f, "round-tripped volume");
            }
            finally
            {
                Thread.CurrentThread.CurrentCulture = original;
            }
        }

        [Test("level ids containing awkward characters survive a round trip", Requirement = "VAL-007")]
        public static void StringsAreEscaped()
        {
            SaveData data = new SaveData();
            data.RecordAttempt("weird\"id\\with\nescapes\t", cleared: true, score: 10, ballsUsed: 1);

            SaveData restored = SaveSerializer.Deserialize(SaveSerializer.Serialize(data));

            Check.True(
                restored.Get("weird\"id\\with\nescapes\t") != null,
                "an id containing quotes, backslashes, and control characters did not survive");
        }

        [Test("a save with missing fields loads with sensible defaults", Requirement = "VAL-007")]
        public static void MissingFieldsFallBackToDefaults()
        {
            // A hand-edited or partially written file should still load. Being strict here would
            // punish the player for a problem they did not cause.
            SaveData data = SaveSerializer.Deserialize("{\"schemaVersion\":1}");

            Check.Equal(1, data.SchemaVersion, "schema version");
            Check.Equal(0, data.Levels.Count, "level count");
            Check.False(data.TutorialSeen, "tutorialSeen default");
            Check.Near(0.8f, data.Volume, 1e-4f, "volume default");
        }

        [Test("malformed payloads are rejected clearly rather than half-read", Requirement = "VAL-007")]
        public static void MalformedPayloadsAreRejected()
        {
            Check.Throws<SaveFormatException>(
                () => SaveSerializer.Deserialize("not json at all"), "garbage");
            Check.Throws<SaveFormatException>(
                () => SaveSerializer.Deserialize("{\"schemaVersion\":1"), "truncated object");
            Check.Throws<SaveFormatException>(
                () => SaveSerializer.Deserialize("[1,2,3]"), "an array is not a save");
            Check.Throws<SaveFormatException>(
                () => SaveSerializer.Deserialize(""), "empty payload");
        }

        [Test("a corrupt save is backed up rather than thrown away", Requirement = "VAL-007")]
        public static void CorruptSaveIsPreservedAndRecovered()
        {
            // The behaviour that matters most in this file. A player whose progress vanishes
            // deserves at minimum for the broken file to still exist, or the bug report is
            // unactionable.
            MemorySaveBackend backend = new MemorySaveBackend();
            backend.Write("{ this is not valid json");

            SaveService service = new SaveService(backend);
            SaveData data = service.Load();

            Check.True(service.LastLoadRecovered, "the load did not report a recovery");
            Check.Equal(1, backend.Backups.Count, "the corrupt payload was not backed up");
            Check.True(
                backend.Backups[0].Contains("not valid json"),
                "the backup does not contain the original payload");
            Check.Equal(0, data.Levels.Count, "recovery should start from a clean save");
        }

        [Test("loading with no existing save starts fresh without error")]
        public static void FirstRunStartsFresh()
        {
            SaveService service = new SaveService(new MemorySaveBackend());
            SaveData data = service.Load();

            Check.False(service.LastLoadRecovered, "a first run was reported as a recovery");
            Check.Equal(SaveData.CurrentSchemaVersion, data.SchemaVersion, "schema version");
            Check.Equal(0, data.Levels.Count, "level count");
        }

        [Test("saving and reloading through the service preserves progress", Requirement = "VAL-007")]
        public static void ServiceRoundTrip()
        {
            MemorySaveBackend backend = new MemorySaveBackend();

            SaveService first = new SaveService(backend) { GameVersion = "0.11" };
            first.Load();
            first.RecordAttempt("LVL_GATEHOUSE", cleared: true, score: 2400, ballsUsed: 1);

            SaveService second = new SaveService(backend);
            SaveData reloaded = second.Load();

            Check.False(second.LastLoadRecovered, "reload reported a recovery");
            Check.Equal("0.11", reloaded.GameVersion, "game version stamp");
            Check.Equal(2400, reloaded.Get("LVL_GATEHOUSE").BestScore, "best score");
            Check.Equal(1, reloaded.Get("LVL_GATEHOUSE").BestBallCount, "best ball count");
        }

        [Test("an older schema is migrated rather than discarded", Requirement = "VAL-007")]
        public static void OlderSchemaIsMigrated()
        {
            MemorySaveBackend backend = new MemorySaveBackend();
            backend.Write(
                "{\"schemaVersion\":0,\"gameVersion\":\"0.1\",\"tutorialSeen\":true,\"volume\":0.5," +
                "\"levels\":[{\"levelId\":\"REG_SIMPLE_TOWER\",\"completed\":true," +
                "\"bestScore\":900,\"bestBallCount\":3,\"timesPlayed\":7}]}");

            SaveService service = new SaveService(backend);
            SaveData data = service.Load();

            Check.True(service.LastLoadMigrated, "the load did not report a migration");
            Check.False(service.LastLoadRecovered, "an old save was treated as corrupt");
            Check.Equal(SaveData.CurrentSchemaVersion, data.SchemaVersion, "schema version after migration");
            Check.Equal(900, data.Get("REG_SIMPLE_TOWER").BestScore, "progress lost during migration");
            Check.Equal(7, data.Get("REG_SIMPLE_TOWER").TimesPlayed, "play count lost during migration");
        }

        [Test("a save from a newer build is left alone rather than guessed at", Requirement = "VAL-007")]
        public static void NewerSchemaIsNotDowngraded()
        {
            // Guessing at a future schema is how a downgrade silently destroys progress. Better to
            // load what parses and change nothing.
            MemorySaveBackend backend = new MemorySaveBackend();
            backend.Write(
                "{\"schemaVersion\":99,\"levels\":[{\"levelId\":\"X\",\"bestScore\":5}]}");

            SaveService service = new SaveService(backend);
            SaveData data = service.Load();

            Check.False(service.LastLoadMigrated, "a newer save was migrated downward");
            Check.Equal(99, data.SchemaVersion, "the newer schema version was overwritten");
            Check.Equal(5, data.Get("X").BestScore, "progress from a newer save was lost");
        }

        [Test("best score and best ball count only ever improve")]
        public static void BestsOnlyImprove()
        {
            SaveData data = new SaveData();

            data.RecordAttempt("L", cleared: true, score: 2000, ballsUsed: 2);
            data.RecordAttempt("L", cleared: true, score: 900, ballsUsed: 7);

            LevelProgress progress = data.Get("L");
            Check.Equal(2000, progress.BestScore, "a worse score overwrote the best");
            Check.Equal(2, progress.BestBallCount, "a worse ball count overwrote the best");
            Check.Equal(2, progress.TimesPlayed, "times played");

            data.RecordAttempt("L", cleared: true, score: 2600, ballsUsed: 1);
            Check.Equal(2600, progress.BestScore, "a better score did not replace the best");
            Check.Equal(1, progress.BestBallCount, "a better ball count did not replace the best");
        }

        [Test("a failed attempt never marks a level completed")]
        public static void FailureDoesNotComplete()
        {
            SaveData data = new SaveData();
            data.RecordAttempt("L", cleared: true, score: 1000, ballsUsed: 3);
            data.RecordAttempt("L", cleared: false, score: 0, ballsUsed: 8);

            LevelProgress progress = data.Get("L");
            Check.True(progress.Completed, "a later failure un-completed a cleared level");
            Check.Equal(1000, progress.BestScore, "a later failure reset the best score");
            Check.Equal(3, progress.BestBallCount, "a later failure reset the best ball count");
        }

        [Test("aggregate progress totals are correct")]
        public static void AggregatesAreCorrect()
        {
            SaveData data = Populated();

            Check.Equal(2, data.CompletedLevelCount, "completed level count");
            Check.Equal(1750 + 2400, data.TotalScore, "total score");
        }

        [Test("resetting clears both the in-memory state and the backend")]
        public static void ResetClearsEverything()
        {
            MemorySaveBackend backend = new MemorySaveBackend();
            SaveService service = new SaveService(backend);

            service.Load();
            service.RecordAttempt("L", cleared: true, score: 100, ballsUsed: 1);
            Check.True(backend.HasData, "fixture error: nothing was saved");

            service.Reset();

            Check.False(backend.HasData, "the backend still holds data after a reset");
            Check.Equal(0, service.Data.Levels.Count, "in-memory state survived a reset");
        }
    }
}
