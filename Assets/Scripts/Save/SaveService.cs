using System;
using System.Collections.Generic;
using ImpactTheory.Core.Logging;

namespace ImpactTheory.Save
{
    /// <summary>
    /// Where a save physically lives.
    /// </summary>
    /// <remarks>
    /// The seam that makes the future mobile port cheap. <c>Docs/GameDesign.md</c> §47 requires
    /// gameplay to talk only to the save abstraction and never to know where the data resides -
    /// browser storage on Web, native storage on mobile, and cloud later without rewriting
    /// gameplay. Scattering platform-specific save calls through gameplay code is precisely what
    /// makes that port expensive, and Addendum 005 §10 forbids it.
    /// </remarks>
    public interface ISaveBackend
    {
        /// <summary>Reads the stored payload. Returns false when nothing has been saved yet.</summary>
        bool TryRead(out string payload);

        void Write(string payload);

        /// <summary>Keeps a copy of an unreadable payload under a distinct key, for diagnosis.</summary>
        void WriteBackup(string payload);

        void Delete();

        /// <summary>Human-readable description of the storage location, for logging.</summary>
        string Describe();
    }

    /// <summary>An in-memory backend. Used by the tests, and as a safe fallback.</summary>
    public sealed class MemorySaveBackend : ISaveBackend
    {
        private string _payload;
        private readonly List<string> _backups = new List<string>();

        public bool HasData => _payload != null;

        public IReadOnlyList<string> Backups => _backups;

        public bool TryRead(out string payload)
        {
            payload = _payload;
            return _payload != null;
        }

        public void Write(string payload) => _payload = payload;

        public void WriteBackup(string payload) => _backups.Add(payload);

        public void Delete() => _payload = null;

        public string Describe() => "memory";
    }

    /// <summary>
    /// The single gameplay-facing entry point for persistence.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Centralised, versioned, and migration-aware (<c>Docs/GameDesign.md</c> §46-§48). Gameplay
    /// calls <see cref="Load"/> and <see cref="Save"/> and nothing else; it never sees JSON, a
    /// schema version, or a storage backend.
    /// </para>
    /// <para>
    /// <strong>An unreadable save is never silently discarded.</strong> It is copied to a backup
    /// key first, then replaced with a fresh one. A player whose progress vanishes deserves at
    /// minimum for the broken file to still exist, and a bug report about it is only actionable if
    /// the payload survived.
    /// </para>
    /// </remarks>
    public sealed class SaveService
    {
        private readonly ISaveBackend _backend;

        public SaveService(ISaveBackend backend = null)
        {
            _backend = backend ?? new MemorySaveBackend();
        }

        /// <summary>The loaded state. Never null after <see cref="Load"/>.</summary>
        public SaveData Data { get; private set; } = new SaveData();

        /// <summary>True when the last load had to recover from an unreadable payload.</summary>
        public bool LastLoadRecovered { get; private set; }

        /// <summary>True when the last load migrated an older schema.</summary>
        public bool LastLoadMigrated { get; private set; }

        /// <summary>Version stamped onto saves, so a bad migration can be traced to a build.</summary>
        public string GameVersion { get; set; } = "0.0";

        /// <summary>Loads, migrating or recovering as needed. Always leaves usable state.</summary>
        public SaveData Load()
        {
            LastLoadRecovered = false;
            LastLoadMigrated = false;

            if (!_backend.TryRead(out string payload) || string.IsNullOrWhiteSpace(payload))
            {
                Data = new SaveData { GameVersion = GameVersion };
                Log.Info(LogCategory.Save, "no existing save; starting fresh", Log.Context(
                    "backend", _backend.Describe(),
                    "schemaVersion", SaveData.CurrentSchemaVersion.ToString()));
                return Data;
            }

            try
            {
                SaveData loaded = SaveSerializer.Deserialize(payload);
                Data = Migrate(loaded);

                Log.Info(LogCategory.Save, "save loaded", Log.Context(
                    "backend", _backend.Describe(),
                    "schemaVersion", Data.SchemaVersion.ToString(),
                    "levels", Data.Levels.Count.ToString(),
                    "migrated", LastLoadMigrated.ToString()));
            }
            catch (SaveFormatException e)
            {
                // Preserve before replacing. Deleting a corrupt save loses the only evidence of
                // why it was corrupt.
                _backend.WriteBackup(payload);
                Data = new SaveData { GameVersion = GameVersion };
                LastLoadRecovered = true;

                Log.Error(LogCategory.Save,
                    "save payload could not be read; kept a backup and started fresh",
                    Log.Context(
                        "backend", _backend.Describe(),
                        "reason", e.Message,
                        "payloadLength", payload.Length.ToString()));
            }

            return Data;
        }

        /// <summary>Writes the current state.</summary>
        public void Save()
        {
            Data.SchemaVersion = SaveData.CurrentSchemaVersion;
            Data.GameVersion = GameVersion;

            try
            {
                _backend.Write(SaveSerializer.Serialize(Data));

                Log.Debug(LogCategory.Save, "save written", Log.Context(
                    "backend", _backend.Describe(),
                    "levels", Data.Levels.Count.ToString()));
            }
            catch (Exception e)
            {
                // A failed write must not take the game down with it. Losing a high score is
                // annoying; crashing on the results screen is worse.
                Log.Error(LogCategory.Save, "save failed", Log.Context(
                    "backend", _backend.Describe(),
                    "error", e.Message));
            }
        }

        /// <summary>Records a level outcome and persists immediately.</summary>
        public void RecordAttempt(string levelId, bool cleared, int score, int ballsUsed)
        {
            Data.RecordAttempt(levelId, cleared, score, ballsUsed);
            Save();
        }

        /// <summary>Deletes the save and starts over.</summary>
        public void Reset()
        {
            _backend.Delete();
            Data = new SaveData { GameVersion = GameVersion };
            Log.Info(LogCategory.Save, "save reset", Log.Context("backend", _backend.Describe()));
        }

        /// <summary>
        /// Brings an older payload up to the current schema.
        /// </summary>
        /// <remarks>
        /// <para>
        /// The schema is at version 1, so there is nothing to migrate yet and this is deliberately
        /// a skeleton rather than speculative machinery. What matters is that the shape is here
        /// before it is needed: a stepwise chain, each step moving exactly one version, so that a
        /// save from any past build converges on the present one.
        /// </para>
        /// <para>
        /// The one case that is real today is a payload claiming version 0 or a version this build
        /// does not recognise - written by a pre-release build, or hand-edited. It is treated as
        /// current rather than discarded, because the fields either parse or fall back to their
        /// defaults, and preserving progress beats being strict about a version stamp.
        /// </para>
        /// <para>
        /// A payload from a <em>newer</em> build is a different matter and is left alone. Guessing
        /// at a future schema is how a downgrade silently destroys progress.
        /// </para>
        /// </remarks>
        private SaveData Migrate(SaveData loaded)
        {
            if (loaded.SchemaVersion == SaveData.CurrentSchemaVersion)
            {
                return loaded;
            }

            if (loaded.SchemaVersion > SaveData.CurrentSchemaVersion)
            {
                Log.Warn(LogCategory.Save,
                    "save was written by a newer build; leaving it as-is rather than guessing",
                    Log.Context(
                        "payloadSchema", loaded.SchemaVersion.ToString(),
                        "thisBuildSchema", SaveData.CurrentSchemaVersion.ToString()));

                return loaded;
            }

            int from = loaded.SchemaVersion;

            // Future migrations chain here, one version per step:
            //   if (loaded.SchemaVersion == 1) { ...; loaded.SchemaVersion = 2; }
            //   if (loaded.SchemaVersion == 2) { ...; loaded.SchemaVersion = 3; }

            loaded.SchemaVersion = SaveData.CurrentSchemaVersion;
            LastLoadMigrated = true;

            Log.Info(LogCategory.Save, "save migrated", Log.Context(
                "from", from.ToString(),
                "to", SaveData.CurrentSchemaVersion.ToString(),
                "levels", loaded.Levels.Count.ToString()));

            return loaded;
        }
    }
}
