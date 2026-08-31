/**
 * save.test.js
 *
 * Covers: that a save written by an older schema still loads with its progress intact,
 * that corrupt or hostile stored data cannot crash the game, and that recording a level
 * result keeps the player's best rather than their most recent.
 *
 * The migration test is the important one. The brief requires that a save written by
 * v1.0.0 still loads after the schema changes, so this test loads a genuine version 1
 * save, of the shape that version actually wrote, and asserts the unlock survives.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  createSaveStore,
  createEmptySave,
  migrateSave,
  SAVE_KEY,
  SAVE_SCHEMA_VERSION,
} from '../../src/save/save.js';

/** A minimal stand-in for localStorage, so these tests need no browser. */
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() { return map.size; },
    _map: map,
  };
}

/** The exact shape schema version 1 wrote: a list of cleared ids and nothing else. */
const V1_SAVE = {
  schema: 1,
  cleared: [1, 2, 3, 4, 5],
  difficulty: 'normal',
  muted: true,
};

describe('save migration', () => {
  it('migrates a version 1 save and keeps every level the player cleared', () => {
    const { save, migratedFrom, reset } = migrateSave(V1_SAVE);
    expect(reset).toBe(false);
    expect(migratedFrom).toBe(1);
    expect(save.schema).toBe(SAVE_SCHEMA_VERSION);
    for (const id of V1_SAVE.cleared) {
      expect(save.levels[String(id)].cleared, `level ${id}`).toBe(true);
    }
    // Version 1 stored no stars, so they are unknown rather than earned, but the unlock
    // is the thing that must not be lost.
    expect(save.unlocked).toBe(6);
    expect(save.levels['5'].migrated).toBe(true);
  });

  it('carries the player settings through a migration', () => {
    const { save } = migrateSave(V1_SAVE);
    expect(save.difficulty).toBe('normal');
    expect(save.muted).toBe(true);
  });

  it('leaves a current schema save alone', () => {
    const current = createEmptySave();
    current.unlocked = 4;
    const { save, migratedFrom } = migrateSave(current);
    expect(migratedFrom).toBeNull();
    expect(save.unlocked).toBe(4);
  });

  it('resets rather than guessing at a save from a newer version', () => {
    const future = { ...createEmptySave(), schema: SAVE_SCHEMA_VERSION + 5, unlocked: 99 };
    const { save, reset } = migrateSave(future);
    expect(reset).toBe(true);
    expect(save.unlocked).toBe(1);
  });

  it('resets on data that is not a save at all', () => {
    for (const junk of [null, 42, 'hello', [], undefined]) {
      expect(migrateSave(junk).reset, String(junk)).toBe(true);
    }
  });
});

describe('save store', () => {
  let storage;

  beforeEach(() => { storage = memoryStorage(); });

  it('starts a fresh player at level 1 with nothing cleared', () => {
    const store = createSaveStore(storage);
    expect(store.state.unlocked).toBe(1);
    expect(store.isUnlocked(1)).toBe(true);
    expect(store.isUnlocked(2)).toBe(false);
    expect(store.totalStars()).toBe(0);
  });

  it('unlocks the next level when one is cleared', () => {
    const store = createSaveStore(storage);
    store.recordLevelResult(1, { stars: 2, score: 1500, ballsUsed: 4 });
    expect(store.isUnlocked(2)).toBe(true);
    expect(store.getLevelRecord(1).stars).toBe(2);
  });

  it('keeps the best result rather than the most recent', () => {
    const store = createSaveStore(storage);
    store.recordLevelResult(1, { stars: 3, score: 5000, ballsUsed: 2 });
    store.recordLevelResult(1, { stars: 1, score: 900, ballsUsed: 9 });
    const rec = store.getLevelRecord(1);
    expect(rec.stars).toBe(3);
    expect(rec.score).toBe(5000);
    expect(rec.ballsUsed).toBe(2);
  });

  it('never lowers the unlock when an earlier level is replayed', () => {
    const store = createSaveStore(storage);
    store.recordLevelResult(1, { stars: 3, score: 100, ballsUsed: 1 });
    store.recordLevelResult(2, { stars: 3, score: 100, ballsUsed: 1 });
    store.recordLevelResult(1, { stars: 1, score: 50, ballsUsed: 8 });
    expect(store.state.unlocked).toBe(3);
  });

  it('persists across a reload of the same storage', () => {
    const first = createSaveStore(storage);
    first.recordLevelResult(1, { stars: 3, score: 4200, ballsUsed: 3 });
    first.setDifficulty('normal');

    const second = createSaveStore(storage);
    expect(second.state.unlocked).toBe(2);
    expect(second.state.difficulty).toBe('normal');
    expect(second.getLevelRecord(1).score).toBe(4200);
  });

  it('survives stored text that is not JSON', () => {
    const s = memoryStorage({ [SAVE_KEY]: 'not json {{{' });
    const store = createSaveStore(s);
    expect(store.state.unlocked).toBe(1);
    expect(store.loadNote).toMatch(/could not be read/);
  });

  it('survives a save with hostile field types', () => {
    const s = memoryStorage({
      [SAVE_KEY]: JSON.stringify({
        schema: 2,
        difficulty: 'godmode',
        muted: 'yes',
        unlocked: -50,
        endlessBest: 'lots',
        levels: { abc: { cleared: true }, 3: 'not an object', 4: { cleared: true, stars: 99 } },
      }),
    });
    const store = createSaveStore(s);
    expect(store.state.difficulty).toBe('easy');
    expect(store.state.muted).toBe(false);
    expect(store.state.unlocked).toBe(1);
    expect(store.state.endlessBest).toBe(0);
    expect(store.state.levels.abc).toBeUndefined();
    expect(store.state.levels['3']).toBeUndefined();
    // Stars are clamped to the legal range rather than believed.
    expect(store.state.levels['4'].stars).toBe(3);
  });

  it('refuses an unknown difficulty', () => {
    const store = createSaveStore(storage);
    expect(store.setDifficulty('impossible')).toBe(false);
    expect(store.state.difficulty).toBe('easy');
    expect(store.setDifficulty('normal')).toBe(true);
  });

  it('only raises the endless best', () => {
    const store = createSaveStore(storage);
    expect(store.setEndlessBest(500)).toBe(true);
    expect(store.setEndlessBest(200)).toBe(false);
    expect(store.state.endlessBest).toBe(500);
  });

  it('keeps working when storage throws on write', () => {
    const hostile = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    const store = createSaveStore(hostile);
    expect(() => store.recordLevelResult(1, { stars: 3, score: 1, ballsUsed: 1 })).not.toThrow();
    // The session continues with an in memory save, which is worth more than refusing
    // to run.
    expect(store.isUnlocked(2)).toBe(true);
  });

  it('resets progress on request', () => {
    const store = createSaveStore(storage);
    store.recordLevelResult(1, { stars: 3, score: 10, ballsUsed: 1 });
    store.reset();
    expect(store.state.unlocked).toBe(1);
    expect(store.totalStars()).toBe(0);
  });

  it('totals stars across levels', () => {
    const store = createSaveStore(storage);
    store.recordLevelResult(1, { stars: 3, score: 1, ballsUsed: 1 });
    store.recordLevelResult(2, { stars: 2, score: 1, ballsUsed: 1 });
    expect(store.totalStars()).toBe(5);
  });
});

describe('camera shake preference', () => {
  it('is off in a brand new save', () => {
    expect(createEmptySave().shake).toBe(false);
  });

  it('turns shake off for a player who already had it on', () => {
    // The setting shipped on, was reported as unpleasant twice, and the default changed.
    // Changing only the default would have left every existing player with the setting
    // being complained about, so the 2 to 3 migration turns it off for them.
    const withShakeOn = {
      schema: 2,
      difficulty: 'easy',
      muted: false,
      unlocked: 7,
      levels: { 1: { cleared: true, stars: 3, score: 900, ballsUsed: 4 } },
      endlessBest: 0,
      seenHint: true,
      shake: true,
    };
    const { save, migratedFrom, reset } = migrateSave(withShakeOn);
    expect(reset).toBe(false);
    expect(migratedFrom).toBe(2);
    expect(save.shake).toBe(false);
    // And nothing else is disturbed by the migration.
    expect(save.unlocked).toBe(7);
    expect(save.levels['1'].stars).toBe(3);
    expect(save.seenHint).toBe(true);
  });

  it('carries a schema 1 save all the way to the current version with shake off', () => {
    const { save } = migrateSave({ schema: 1, cleared: [1, 2, 3], difficulty: 'normal' });
    expect(save.schema).toBe(SAVE_SCHEMA_VERSION);
    expect(save.shake).toBe(false);
    expect(save.unlocked).toBe(4);
    expect(save.difficulty).toBe('normal');
  });

  it('respects a player who turns it back on', () => {
    const store = createSaveStore(memoryStorage());
    expect(store.state.shake).toBe(false);
    store.setShake(true);
    expect(store.state.shake).toBe(true);
    store.setShake(false);
    expect(store.state.shake).toBe(false);
  });
});

describe('a migrated save is written back', () => {
  it('stores the upgraded save rather than migrating again on every load', () => {
    const storage = memoryStorage({
      [SAVE_KEY]: JSON.stringify({ schema: 1, cleared: [1, 2], difficulty: 'normal' }),
    });

    const first = createSaveStore(storage);
    expect(first.loadNote).toMatch(/migrated from schema 1/);

    // The stored text should now be at the current schema, so a second load has nothing
    // to migrate and reports no note.
    const stored = JSON.parse(storage.getItem(SAVE_KEY));
    expect(stored.schema).toBe(SAVE_SCHEMA_VERSION);
    expect(stored.shake).toBe(false);

    const second = createSaveStore(storage);
    expect(second.loadNote).toBeNull();
    expect(second.state.unlocked).toBe(3);
    expect(second.state.difficulty).toBe('normal');
  });
});
