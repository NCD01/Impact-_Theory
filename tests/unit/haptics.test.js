/**
 * haptics.test.js
 *
 * Covers: that the device buzzes for impacts worth feeling and not for the rest, that a
 * collapse cannot turn the motor into one continuous drone, and that a device with no
 * vibration motor plays the game silently rather than throwing.
 *
 * `navigator.vibrate` is stubbed, so these run in Node with no browser. The clock is
 * injected for the same reason: rate limiting can be driven exactly rather than waited on.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { createHaptics } from '../../src/game/haptics.js';
import { HAPTICS } from '../../src/core/constants.js';

/**
 * Replaces globalThis.navigator for one test.
 *
 * defineProperty rather than assignment: Node exposes `navigator` as a getter only
 * property, so a plain assignment throws "Cannot set property navigator of #<Object>
 * which has only a getter".
 */
function setNavigator(value) {
  Object.defineProperty(globalThis, 'navigator', {
    value, configurable: true, writable: true,
  });
}

/** Installs a fake navigator.vibrate and records every call. */
function stubVibrate(impl) {
  const calls = [];
  setNavigator({
    vibrate: (arg) => {
      calls.push(arg);
      if (impl) return impl(arg);
      return true;
    },
  });
  return calls;
}

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
});

describe('haptics on a device that can vibrate', () => {
  let calls;
  beforeEach(() => { calls = stubVibrate(); });

  it('reports itself available', () => {
    expect(createHaptics().available).toBe(true);
  });

  it('buzzes for an impact worth feeling', () => {
    const h = createHaptics();
    expect(h.impact(HAPTICS.FULL_STRENGTH_ENERGY_J, 0)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(typeof calls[0]).toBe('number');
  });

  it('stays silent for an impact below the floor', () => {
    const h = createHaptics();
    expect(h.impact(HAPTICS.MIN_ENERGY_J - 1, 0)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('buzzes longer for a bigger hit, up to a cap', () => {
    const h = createHaptics();
    h.impact(HAPTICS.MIN_ENERGY_J, 0);
    h.impact(HAPTICS.FULL_STRENGTH_ENERGY_J, 10000);
    h.impact(HAPTICS.FULL_STRENGTH_ENERGY_J * 50, 20000);

    const [small, full, huge] = calls;
    expect(small).toBeGreaterThanOrEqual(HAPTICS.MIN_DURATION_MS);
    expect(full).toBeGreaterThan(small);
    // Saturates rather than growing without bound.
    expect(huge).toBe(HAPTICS.MAX_DURATION_MS);
    expect(huge).toBeLessThanOrEqual(HAPTICS.MAX_DURATION_MS);
  });

  it('rate limits, so a collapse is a series of knocks and not one drone', () => {
    const h = createHaptics();
    // Thirty qualifying impacts inside a single interval, which is what a collapse is.
    for (let i = 0; i < 30; i += 1) h.impact(HAPTICS.FULL_STRENGTH_ENERGY_J, i);
    expect(calls).toHaveLength(1);

    // Past the interval, the next one gets through.
    expect(h.impact(HAPTICS.FULL_STRENGTH_ENERGY_J, HAPTICS.MIN_INTERVAL_MS + 1)).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('plays a pattern on a level clear', () => {
    const h = createHaptics();
    h.levelClear();
    expect(calls[0]).toEqual(HAPTICS.CLEAR_PATTERN_MS);
  });

  it('stops the motor when asked', () => {
    const h = createHaptics();
    h.stop();
    expect(calls[0]).toBe(0);
  });

  it('does nothing at all once turned off', () => {
    const h = createHaptics();
    h.setEnabled(false);
    expect(h.impact(HAPTICS.FULL_STRENGTH_ENERGY_J, 0)).toBe(false);
    h.levelClear();
    // The only call is the stop() that setEnabled(false) issues to cancel a buzz already
    // running; nothing else reaches the motor.
    expect(calls.filter((c) => c !== 0)).toHaveLength(0);
  });

  it('can be turned back on', () => {
    const h = createHaptics();
    h.setEnabled(false);
    h.setEnabled(true);
    expect(h.impact(HAPTICS.FULL_STRENGTH_ENERGY_J, 0)).toBe(true);
  });
});

describe('haptics on a device that cannot vibrate', () => {
  it('reports itself unavailable and never throws', () => {
    setNavigator({});
    const h = createHaptics();
    expect(h.available).toBe(false);
    expect(() => {
      h.impact(999999, 0);
      h.levelClear();
      h.stop();
      h.setEnabled(true);
    }).not.toThrow();
    expect(h.impact(999999, 0)).toBe(false);
  });

  it('survives a browser that throws from vibrate', () => {
    // Some browsers throw when the page is not visible or not user activated.
    stubVibrate(() => { throw new Error('NotAllowedError'); });
    const h = createHaptics();
    expect(() => h.impact(HAPTICS.FULL_STRENGTH_ENERGY_J, 0)).not.toThrow();
    expect(h.impact(HAPTICS.FULL_STRENGTH_ENERGY_J, 10000)).toBe(false);
    expect(() => h.levelClear()).not.toThrow();
    expect(() => h.stop()).not.toThrow();
  });
});

describe('haptics tuning', () => {
  it('only fires on impacts well above the damage floor', () => {
    // Plenty of impacts are worth counting as damage without being worth feeling in the
    // hand, so the haptic floor sits far above the damage one.
    expect(HAPTICS.MIN_ENERGY_J).toBeGreaterThan(100);
  });

  it('keeps every buzz short', () => {
    expect(HAPTICS.MAX_DURATION_MS).toBeLessThanOrEqual(60);
    expect(HAPTICS.MIN_DURATION_MS).toBeGreaterThan(0);
    expect(HAPTICS.MIN_DURATION_MS).toBeLessThan(HAPTICS.MAX_DURATION_MS);
  });
});
