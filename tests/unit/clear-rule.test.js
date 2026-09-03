/**
 * clear-rule.test.js
 *
 * Covers: when a piece counts as knocked down, and therefore when a level is cleared.
 *
 * Every one of the five wrong answers this rule has given is a test here, named after the
 * thing the owner actually saw. All five reached him rather than a test, because the rule
 * used to live inside a module that needed a physics world to run. It is a function of four
 * numbers now, so none of them can come back quietly.
 */

import { describe, expect, it } from 'vitest';

import { isKnockedDown, allKnockedDown, countStanding } from '../../src/game/clear-rule.js';
import { PLAYFIELD } from '../../src/core/constants.js';

/** A platform 2.1 SU high spanning 8 SU, which is the wide base the levels use. */
const PLATFORM = { top: 2.1, minX: -4, maxX: 4 };

/** A piece standing upright in the middle of that platform. */
function standing(overrides = {}) {
  return {
    tiltRadians: 0,
    centreY: PLATFORM.top + 1.5,
    x: 0,
    distanceFromOrigin: 0,
    ...overrides,
  };
}

describe('a piece that is upright and on the platform is standing', () => {
  it('counts an untouched piece as standing', () => {
    expect(isKnockedDown(standing(), PLATFORM)).toBe(false);
  });

  it('counts a piece sitting right on the deck surface as standing', () => {
    expect(isKnockedDown(standing({ centreY: PLATFORM.top + 0.5 }), PLATFORM)).toBe(false);
  });

  it('counts a piece leaning slightly as standing', () => {
    const slight = PLAYFIELD.TILT_TO_COUNT_DOWN - 0.05;
    expect(isKnockedDown(standing({ tiltRadians: slight }), PLATFORM)).toBe(false);
  });

  it('counts a piece near the deck edge as standing', () => {
    expect(isKnockedDown(standing({ x: PLATFORM.maxX - 0.1 }), PLATFORM)).toBe(false);
  });
});

describe('a piece that is knocked over or off is down', () => {
  it('counts a piece lying flat as down', () => {
    expect(isKnockedDown(standing({ tiltRadians: Math.PI / 2 }), PLATFORM)).toBe(true);
  });

  it('counts a piece tilted past the threshold as down', () => {
    const past = PLAYFIELD.TILT_TO_COUNT_DOWN + 0.05;
    expect(isKnockedDown(standing({ tiltRadians: past }), PLATFORM)).toBe(true);
  });

  it('counts a piece on the sand as down', () => {
    expect(isKnockedDown(standing({ centreY: 0.5 }), PLATFORM)).toBe(true);
  });

  it('counts a piece pushed off the side as down, even while still high up', () => {
    const beside = { x: PLATFORM.maxX + 2, centreY: PLATFORM.top + 1 };
    expect(isKnockedDown(standing(beside), PLATFORM)).toBe(true);
  });

  it('counts a piece knocked out of the playfield as down', () => {
    const far = { distanceFromOrigin: PLAYFIELD.OUT_OF_PLAY_RADIUS + 1 };
    expect(isKnockedDown(standing(far), PLATFORM)).toBe(true);
  });
});

/**
 * One test per wrong answer. Each is named for what the owner saw on screen, so a future
 * change that reintroduces one fails with a message that says which mistake it is.
 */
describe('the five wrong answers this rule has given', () => {
  it('1: does not wait for a piece to roll all the way to the sand', () => {
    // The first rule used an absolute height near the ground, so a piece resting on the
    // rubble a little below the platform was still "standing" and the level dragged on.
    const justBelowPlatform = standing({ centreY: PLATFORM.top - 0.6 });
    expect(isKnockedDown(justBelowPlatform, PLATFORM)).toBe(true);
  });

  it('2: a piece landing on rubble BESIDE the platform is down', () => {
    // "Everything is off but the level does not clear." The piece was above the platform
    // line because it was perched on debris next to it.
    const onRubbleBeside = standing({ x: PLATFORM.minX - 1.5, centreY: PLATFORM.top + 0.8 });
    expect(isKnockedDown(onRubbleBeside, PLATFORM)).toBe(true);
  });

  it('3: a piece that toppled ONTO the deck is down, because it is on its side', () => {
    // It is still on the platform, so height alone says standing. Its orientation says
    // otherwise, and orientation is what a player sees.
    const toppledOnDeck = standing({ tiltRadians: 1.4, centreY: PLATFORM.top + 0.5 });
    expect(isKnockedDown(toppledOnDeck, PLATFORM)).toBe(true);
  });

  it('4: a beam lying flat across the deck is down', () => {
    // "Everything is off but level not clears", with a beam flat on the platform.
    const flatBeam = standing({ tiltRadians: Math.PI / 2, centreY: PLATFORM.top + 0.5, x: 1 });
    expect(isKnockedDown(flatBeam, PLATFORM)).toBe(true);
  });

  it('5: a piece that DROPPED but landed upright on the platform is STILL STANDING', () => {
    // Level 3 is two tall blocks stacked. Smash the lower one and the upper falls three
    // units straight down, landing upright on the deck. A movement based rule called that
    // knocked down, and one ball cleared a level with a tower still standing on it.
    const droppedButUpright = {
      tiltRadians: 0.02,
      centreY: PLATFORM.top + 1.5,
      x: 0,
      distanceFromOrigin: 0,
    };
    expect(isKnockedDown(droppedButUpright, PLATFORM)).toBe(false);
  });

  it('5b: level 3 is not cleared while the upper block stands on the plinth', () => {
    // The exact situation in the screenshot: the lower block destroyed and gone from the
    // list, the upper one upright on the deck. Not cleared.
    const singlePlinth = { top: 2.1, minX: -0.7, maxX: 0.7 };
    const upperBlock = {
      tiltRadians: 0, centreY: 2.1 + 1.5, x: 0, distanceFromOrigin: 0,
    };
    expect(allKnockedDown([upperBlock], singlePlinth)).toBe(false);
    expect(countStanding([upperBlock], singlePlinth)).toBe(1);
  });
});

describe('clearing a level', () => {
  it('is cleared when every piece is down', () => {
    const pieces = [
      standing({ centreY: 0.5 }),
      standing({ tiltRadians: Math.PI / 2 }),
      standing({ x: PLATFORM.maxX + 3 }),
    ];
    expect(allKnockedDown(pieces, PLATFORM)).toBe(true);
    expect(countStanding(pieces, PLATFORM)).toBe(0);
  });

  it('is not cleared while one piece still stands', () => {
    const pieces = [standing({ centreY: 0.5 }), standing()];
    expect(allKnockedDown(pieces, PLATFORM)).toBe(false);
    expect(countStanding(pieces, PLATFORM)).toBe(1);
  });

  it('is cleared when every piece was destroyed and none are left', () => {
    expect(allKnockedDown([], PLATFORM)).toBe(true);
    expect(countStanding([], PLATFORM)).toBe(0);
  });

  it('does not care how far a standing piece travelled to get there', () => {
    // The whole of wrong answer 5, stated as a property: two pieces in the same final
    // place are judged the same, whatever their history.
    const a = standing();
    const b = standing();
    expect(isKnockedDown(a, PLATFORM)).toBe(isKnockedDown(b, PLATFORM));
    expect(isKnockedDown(a, PLATFORM)).toBe(false);
  });
});
