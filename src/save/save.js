/**
 * save.js
 *
 * OWNS: the shape of saved progress, reading and writing it to localStorage, and
 * migrating a save written by an older version of this game.
 *
 * MUST NOT OWN: what a star is worth (src/game/scoring.js) or which level is next
 * (src/game/level.js). This file stores numbers; it does not decide them.
 *
 * The migration contract, which is the reason this file is not four lines long.
 * A save written by version 1.0.0 must still load after the schema changes, or it must
 * be migrated. So every save carries a `schema` integer, migrations are a chain of small
 * functions from one version to the next, and the unit suite loads a genuine v1 save and
 * asserts it comes back complete. A child who has cleared twenty levels does not lose
 * them because the schema gained a field.
 *
 * Every read is defensive. localStorage can hold anything: a truncated write from a
 * closed tab, another site's key in a shared origin during development, or a value a
 * curious eleven year old typed in themselves. A save that cannot be understood is
 * replaced by a fresh one rather than crashing the game, and the fact is reported.
 */

import { DEFAULT_DIFFICULTY, DIFFICULTY } from '../core/constants.js';

/** The key progress is stored under. Namespaced so it cannot collide on a shared host. */
export const SAVE_KEY = 'impact-theory.save.v1';

/** The schema version this build writes. Bump when the shape changes, and add a step. */
export const SAVE_SCHEMA_VERSION = 2;

/**
 * A brand new save.
 *
 * Level 1 is unlocked and nothing else. Difficulty defaults to Easy because the first
 * player is a child; see DEFAULT_DIFFICULTY.
 *
 * @returns {object}
 */
export function createEmptySave() {
  return {
    schema: SAVE_SCHEMA_VERSION,
    difficulty: DEFAULT_DIFFICULTY,
    muted: false,
    /** Highest level id the player may open. Level 1 is always available. */
    unlocked: 1,
    /** Per level results, keyed by level id as a string. */
    levels: {},
    /** Best score in endless mode. */
    endlessBest: 0,
    /** Whether the how to play hint has been shown. It is shown once, ever. */
    seenHint: false,
    /** Whether the camera reacts to impacts. Some players simply do not want it. */
    shake: true,
  };
}

/**
 * Migration steps, from schema N to schema N+1.
 *
 * Each step takes a save at version N and returns one at N+1. Steps are applied in order
 * until the save reaches the current version, so a v1 save passes through every step
 * written since. A step never removes information it cannot reconstruct.
 *
 * @type {Record<number, (save: object) => object>}
 */
const MIGRATIONS = {
  /**
   * 1 to 2. Version 1 stored only a list of cleared level ids and no per level detail.
   * Stars and scores from before the change are unknown, not zero, so each cleared level
   * is restored with `stars: 0` and `score: 0` and a `migrated: true` marker, and the
   * level stays cleared. Losing the unlock would be far worse than losing the stars.
   */
  1: (save) => {
    const levels = {};
    const cleared = Array.isArray(save.cleared) ? save.cleared : [];
    for (const id of cleared) {
      if (!Number.isInteger(id)) continue;
      levels[String(id)] = {
        cleared: true, stars: 0, score: 0, ballsUsed: 0, migrated: true,
      };
    }
    return {
      schema: 2,
      difficulty: save.difficulty ?? DEFAULT_DIFFICULTY,
      muted: save.muted === true,
      unlocked: Math.max(1, cleared.length ? Math.max(...cleared) + 1 : 1),
      levels,
      endlessBest: Number.isFinite(save.endlessBest) ? save.endlessBest : 0,
    };
  },
};

/**
 * Brings a save up to the current schema.
 *
 * Assumes `raw` is a parsed object. Returns the migrated save and a note of what
 * happened, so the caller can report a migration rather than silently changing the
 * player's data. A save from a future version is not downgraded; a fresh save is
 * returned instead, because guessing at fields this build has never seen is how progress
 * gets corrupted.
 *
 * @param {object} raw
 * @returns {{save: object, migratedFrom: number|null, reset: boolean}}
 */
export function migrateSave(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { save: createEmptySave(), migratedFrom: null, reset: true };
  }

  let version = Number.isInteger(raw.schema) ? raw.schema : 1;
  if (version > SAVE_SCHEMA_VERSION) {
    return { save: createEmptySave(), migratedFrom: version, reset: true };
  }

  const from = version;
  let save = raw;
  while (version < SAVE_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { save: createEmptySave(), migratedFrom: from, reset: true };
    save = step(save);
    version = save.schema;
  }

  return {
    save: normalise(save),
    migratedFrom: from === SAVE_SCHEMA_VERSION ? null : from,
    reset: false,
  };
}

/**
 * Forces a save into a legal shape, filling anything missing with a default.
 *
 * This runs on every load, including of a save this build wrote itself, because the
 * cheapest place to catch a corrupt field is before it reaches the game.
 *
 * @param {object} save
 * @returns {object}
 */
function normalise(save) {
  const clean = createEmptySave();
  clean.difficulty = Object.hasOwn(DIFFICULTY, save.difficulty)
    ? save.difficulty : DEFAULT_DIFFICULTY;
  clean.muted = save.muted === true;
  clean.unlocked = Number.isInteger(save.unlocked) && save.unlocked >= 1 ? save.unlocked : 1;
  clean.endlessBest = Number.isFinite(save.endlessBest) && save.endlessBest >= 0
    ? save.endlessBest : 0;
  clean.seenHint = save.seenHint === true;
  // Defaults to on, so only an explicit false turns it off.
  clean.shake = save.shake !== false;

  if (typeof save.levels === 'object' && save.levels !== null) {
    for (const [key, value] of Object.entries(save.levels)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id < 1) continue;
      if (typeof value !== 'object' || value === null) continue;
      clean.levels[String(id)] = {
        cleared: value.cleared === true,
        stars: clampInt(value.stars, 0, 3),
        score: Math.max(0, Number.isFinite(value.score) ? Math.floor(value.score) : 0),
        ballsUsed: Math.max(0, Number.isFinite(value.ballsUsed) ? Math.floor(value.ballsUsed) : 0),
        ...(value.migrated === true ? { migrated: true } : {}),
      };
    }
  }
  return clean;
}

function clampInt(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, Math.floor(v)));
}

/**
 * Creates the save store.
 *
 * Assumes `storage` behaves like localStorage. It is injected rather than reached for
 * directly so the unit suite can drive migrations without a browser, and so a browser
 * with storage disabled degrades to an in memory save that works for one session rather
 * than throwing on startup.
 *
 * @param {Storage} [storage]
 */
export function createSaveStore(storage = safeStorage()) {
  let state;
  let lastLoadNote = null;

  function load() {
    let raw = null;
    try {
      const text = storage.getItem(SAVE_KEY);
      if (text) raw = JSON.parse(text);
    } catch (err) {
      // A parse failure means the stored text is not our save. Start clean and say so.
      lastLoadNote = `save could not be read (${err.message}), starting fresh`;
      state = createEmptySave();
      return state;
    }
    if (raw === null) {
      state = createEmptySave();
      return state;
    }
    const result = migrateSave(raw);
    state = result.save;
    if (result.reset) lastLoadNote = `save was unreadable or from a newer version, reset`;
    else if (result.migratedFrom !== null) {
      lastLoadNote = `save migrated from schema ${result.migratedFrom} to ${SAVE_SCHEMA_VERSION}`;
    }
    return state;
  }

  function persist() {
    try {
      storage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch {
      // Private browsing and a full quota both land here. The session continues with
      // the in memory save; progress is lost when the tab closes, which is worth far
      // less than the game refusing to run.
      return false;
    }
  }

  /**
   * Records a completed level, keeping the player's best result.
   *
   * A worse replay never lowers a recorded score or star count, which is what players
   * expect and what stops an idle retry from erasing a good run. Unlocks the next level.
   *
   * @param {number} id
   * @param {{stars: number, score: number, ballsUsed: number}} result
   * @returns {object} The stored record for that level.
   */
  function recordLevelResult(id, { stars, score, ballsUsed }) {
    const key = String(id);
    const prev = state.levels[key];
    state.levels[key] = {
      cleared: true,
      stars: Math.max(prev?.stars ?? 0, clampInt(stars, 0, 3)),
      score: Math.max(prev?.score ?? 0, Math.max(0, Math.floor(score))),
      ballsUsed: prev?.cleared
        ? Math.min(prev.ballsUsed || Infinity, Math.max(0, Math.floor(ballsUsed)))
        : Math.max(0, Math.floor(ballsUsed)),
    };
    state.unlocked = Math.max(state.unlocked, id + 1);
    persist();
    return state.levels[key];
  }

  function isUnlocked(id) {
    return id <= state.unlocked;
  }

  function getLevelRecord(id) {
    return state.levels[String(id)] ?? null;
  }

  function setDifficulty(id) {
    if (!Object.hasOwn(DIFFICULTY, id)) return false;
    state.difficulty = id;
    persist();
    return true;
  }

  /** Turns the camera shake on or off. */
  function setShake(on) {
    state.shake = on === true;
    persist();
  }

  /** Records that the how to play hint has been shown, so it is not shown again. */
  function setSeenHint() {
    state.seenHint = true;
    persist();
  }

  function setMuted(muted) {
    state.muted = muted === true;
    persist();
  }

  function setEndlessBest(score) {
    if (!Number.isFinite(score) || score <= state.endlessBest) return false;
    state.endlessBest = Math.floor(score);
    persist();
    return true;
  }

  /** Total stars earned across every level. Shown on the level select. */
  function totalStars() {
    return Object.values(state.levels).reduce((sum, l) => sum + (l.stars ?? 0), 0);
  }

  /** Wipes progress. Only reachable from a confirmed action in settings. */
  function reset() {
    state = createEmptySave();
    persist();
    return state;
  }

  state = load();

  return {
    get state() { return state; },
    get loadNote() { return lastLoadNote; },
    reload: load,
    recordLevelResult,
    isUnlocked,
    getLevelRecord,
    setDifficulty,
    setMuted,
    setShake,
    setSeenHint,
    setEndlessBest,
    totalStars,
    reset,
  };
}

/**
 * Returns localStorage, or an in memory stand-in when it is unavailable.
 *
 * Safari in private mode and a browser with site data blocked both throw on access, not
 * on use, so the check has to be a real read inside a try.
 *
 * @returns {Storage}
 */
function safeStorage() {
  try {
    const probe = '__impact_theory_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    const map = new Map();
    return /** @type {Storage} */ ({
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      get length() { return map.size; },
    });
  }
}
