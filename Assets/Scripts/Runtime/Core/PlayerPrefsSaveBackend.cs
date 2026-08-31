using ImpactTheory.Save;
using UnityEngine;

namespace ImpactTheory.Runtime.Core
{
    /// <summary>
    /// Stores the save through Unity's <see cref="PlayerPrefs"/>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// One backend covers both current targets, which is the point of the abstraction. In a Unity
    /// Web build <c>PlayerPrefs</c> is backed by IndexedDB, which is the "persistent browser-backed
    /// storage appropriate to Unity Web builds" that <c>Docs/GameDesign.md</c> §47 asks for; on
    /// desktop and future mobile it is the platform's own persistent store. Gameplay never learns
    /// which.
    /// </para>
    /// <para>
    /// <c>PlayerPrefs</c> is a modest store and would be the wrong choice for large or
    /// frequently-written data. It is the right choice here because the persisted surface is
    /// deliberately small - local progress and settings - and writes happen once per completed
    /// level. If that surface ever grows, the fix is a different <see cref="ISaveBackend"/>, not a
    /// change anywhere in gameplay.
    /// </para>
    /// <para>
    /// The IndexedDB write in a Web build is asynchronous, so <see cref="PlayerPrefs.Save"/> is
    /// called explicitly rather than relying on Unity flushing at quit - a browser tab is closed,
    /// not quit, and an unflushed save is simply lost.
    /// </para>
    /// </remarks>
    public sealed class PlayerPrefsSaveBackend : ISaveBackend
    {
        private const string Key = "ImpactTheory.Save";
        private const string BackupKey = "ImpactTheory.Save.Corrupt";

        public bool TryRead(out string payload)
        {
            payload = PlayerPrefs.GetString(Key, null);
            return !string.IsNullOrEmpty(payload);
        }

        public void Write(string payload)
        {
            PlayerPrefs.SetString(Key, payload);
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Keeps an unreadable payload under a separate key.
        /// </summary>
        /// <remarks>
        /// Timestamped so that a repeatedly failing load does not overwrite the first and most
        /// informative failure.
        /// </remarks>
        public void WriteBackup(string payload)
        {
            string stamp = System.DateTime.UtcNow.ToString("yyyyMMddHHmmss");
            PlayerPrefs.SetString($"{BackupKey}.{stamp}", payload);
            PlayerPrefs.Save();
        }

        public void Delete()
        {
            PlayerPrefs.DeleteKey(Key);
            PlayerPrefs.Save();
        }

        public string Describe() => $"PlayerPrefs ({Application.platform})";
    }
}
