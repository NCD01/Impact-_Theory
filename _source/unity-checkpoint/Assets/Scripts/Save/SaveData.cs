using System.Collections.Generic;

namespace ImpactTheory.Save
{
    /// <summary>What the player has achieved on one level.</summary>
    public sealed class LevelProgress
    {
        public LevelProgress(string levelId)
        {
            LevelId = levelId;
        }

        public string LevelId { get; set; }

        public bool Completed { get; set; }

        public int BestScore { get; set; }

        /// <summary>
        /// Fewest balls used on a successful clear. Zero means never cleared.
        /// </summary>
        /// <remarks>
        /// Tracked separately from <see cref="BestScore"/> because it is the number the game is
        /// actually about (<c>Docs/GameDesign.md</c> §25) and because scoring constants may be
        /// retuned later - a ball count stays comparable across a tuning change in a way a score
        /// does not.
        /// </remarks>
        public int BestBallCount { get; set; }

        public int TimesPlayed { get; set; }
    }

    /// <summary>
    /// The complete persisted state.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Versioned structured data (<c>Docs/GameDesign.md</c> §46, §48). Every payload carries
    /// <see cref="SchemaVersion"/>, and a save that predates the current schema is migrated rather
    /// than discarded - the specification is explicit that normal updates must not silently corrupt
    /// or invalidate existing player data.
    /// </para>
    /// <para>
    /// The persisted surface is deliberately small: local player progress and settings, nothing
    /// else. <c>Governance/PRIVACY_AND_DATA_HANDLING_POLICY.md</c> keeps <c>VAL-007</c> simple only
    /// as long as it stays that way, so do not expand it casually.
    /// </para>
    /// </remarks>
    public sealed class SaveData
    {
        /// <summary>The schema this build writes.</summary>
        public const int CurrentSchemaVersion = 1;

        private readonly Dictionary<string, LevelProgress> _levels =
            new Dictionary<string, LevelProgress>();

        public int SchemaVersion { get; set; } = CurrentSchemaVersion;

        /// <summary>Game version that last wrote this save, for diagnosing a bad migration.</summary>
        public string GameVersion { get; set; } = "0.0";

        public bool TutorialSeen { get; set; }

        /// <summary>Master audio volume, 0 to 1.</summary>
        public float Volume { get; set; } = 0.8f;

        public IReadOnlyDictionary<string, LevelProgress> Levels => _levels;

        public LevelProgress GetOrCreate(string levelId)
        {
            if (!_levels.TryGetValue(levelId, out LevelProgress progress))
            {
                progress = new LevelProgress(levelId);
                _levels[levelId] = progress;
            }

            return progress;
        }

        public LevelProgress Get(string levelId) =>
            _levels.TryGetValue(levelId, out LevelProgress progress) ? progress : null;

        internal void Put(LevelProgress progress) => _levels[progress.LevelId] = progress;

        /// <summary>
        /// Records the outcome of a level.
        /// </summary>
        /// <remarks>
        /// Bests only ever improve. A player who clears a level in three balls and later scrapes
        /// through in eight keeps the three - which is what a "best" means, and what stops a
        /// careless replay from erasing an achievement.
        /// </remarks>
        public void RecordAttempt(string levelId, bool cleared, int score, int ballsUsed)
        {
            LevelProgress progress = GetOrCreate(levelId);
            progress.TimesPlayed++;

            if (!cleared)
            {
                return;
            }

            progress.Completed = true;

            if (score > progress.BestScore)
            {
                progress.BestScore = score;
            }

            if (progress.BestBallCount == 0 || ballsUsed < progress.BestBallCount)
            {
                progress.BestBallCount = ballsUsed;
            }
        }

        public int CompletedLevelCount
        {
            get
            {
                int count = 0;
                foreach (LevelProgress progress in _levels.Values)
                {
                    if (progress.Completed)
                    {
                        count++;
                    }
                }

                return count;
            }
        }

        public int TotalScore
        {
            get
            {
                int total = 0;
                foreach (LevelProgress progress in _levels.Values)
                {
                    total += progress.BestScore;
                }

                return total;
            }
        }
    }
}
