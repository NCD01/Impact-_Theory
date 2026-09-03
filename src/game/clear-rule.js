/**
 * clear-rule.js
 *
 * OWNS: the single question "is this piece still standing", and therefore when a level is
 * cleared.
 *
 * MUST NOT OWN: anything that touches Rapier, three.js or the DOM. This module is pure
 * arithmetic on plain numbers, and that is the entire point of it existing separately.
 *
 * WHY THIS IS ITS OWN FILE.
 *
 * This rule has been wrong five times, and every one of them reached the owner rather than
 * a test, because it lived inside a module that needs a physics world and a renderer to
 * run. It could only be checked by playing the game. Pulled out here it is a function of
 * four numbers, so every one of those five failures is now a unit test that runs in
 * milliseconds.
 *
 * THE FIVE WRONG ANSWERS, EACH REASONABLE, EACH WRONG DIFFERENTLY:
 *
 *   1. An absolute height near the sand.
 *      A level only cleared once every piece had rolled all the way to the ground, which
 *      took a long wait on a wide wall.
 *
 *   2. Relative to the platform, height only.
 *      A piece knocked off but landing on rubble beside the platform still sat above the
 *      line, so a structure lying flat on the sand refused to end.
 *
 *   3. Fallen a distance from its own starting height.
 *      A piece that toppled from the top of the stack onto the deck counted as down while
 *      sitting in plain view on the platform.
 *
 *   4. On the platform or not, ignoring orientation.
 *      A beam lying flat across the deck counted as standing, so a fully demolished
 *      structure left the game still playing.
 *
 *   5. Adding "has it moved more than 0.7 SU".
 *      Level 3 is two tall blocks stacked. Smash the lower one and the upper drops three
 *      units straight down, landing upright and still on the platform. It had moved, so it
 *      counted as down, and one ball cleared a level with a tower still standing on it.
 *
 * THE ANSWER. A piece is standing if it is **upright** and **on the platform**. Nothing
 * else is part of it. How far it travelled to get there does not matter: a piece that fell
 * three units and landed upright on the deck is standing, because that is what a player
 * looking at the screen sees.
 */

import { PLAYFIELD } from '../core/constants.js';

/**
 * @typedef {object} PieceState
 * @property {number} tiltRadians       Angle between the piece's own up axis and world up.
 * @property {number} centreY           World height of its centre of volume.
 * @property {number} x                 World x of its body origin.
 * @property {number} distanceFromOrigin Horizontal distance from the structure origin.
 */

/**
 * @typedef {object} Platform
 * @property {number} top   World height of the deck surface.
 * @property {number} minX  World x of the deck's left edge.
 * @property {number} maxX  World x of the deck's right edge.
 */

/**
 * Whether a piece has been knocked down.
 *
 * Assumes `tiltRadians` is measured from upright, so 0 is standing and pi/2 is lying flat,
 * and that `centreY` already accounts for the piece's pivot **rotated by its body**. A
 * toppled piece whose centre was computed without that rotation reads as taller than it is
 * and can defeat this check, which is decision D-012's other half.
 *
 * Returns true when the piece is no longer standing on the platform, by any of four routes.
 * Deliberately does not consider how far the piece has travelled; see the file header.
 *
 * @param {PieceState} piece
 * @param {Platform} platform
 * @returns {boolean}
 */
export function isKnockedDown(piece, platform) {
  // Knocked over. A beam lying flat across the deck is not standing, whatever else is true
  // of it.
  if (piece.tiltRadians > PLAYFIELD.TILT_TO_COUNT_DOWN) return true;

  // Fallen off the top, so it is on the sand or in the rubble rather than on the platform.
  if (piece.centreY < platform.top - PLAYFIELD.BELOW_PLATFORM_TO_COUNT_DOWN) return true;

  // Pushed off the side. It may still be high up, balanced on rubble beside the platform,
  // but it is not on the platform any more.
  const margin = PLAYFIELD.BESIDE_PLATFORM_TO_COUNT_DOWN;
  if (piece.x < platform.minX - margin || piece.x > platform.maxX + margin) return true;

  // Knocked clean out of the playfield.
  return piece.distanceFromOrigin > PLAYFIELD.OUT_OF_PLAY_RADIUS;
}

/**
 * Whether every piece in a list has been knocked down.
 *
 * A level with no pieces left at all is cleared, which is the case where every piece was
 * destroyed outright rather than toppled.
 *
 * @param {PieceState[]} pieces
 * @param {Platform} platform
 * @returns {boolean}
 */
export function allKnockedDown(pieces, platform) {
  return pieces.every((p) => isKnockedDown(p, platform));
}

/**
 * How many pieces in a list are still standing.
 *
 * @param {PieceState[]} pieces
 * @param {Platform} platform
 * @returns {number}
 */
export function countStanding(pieces, platform) {
  return pieces.reduce((n, p) => n + (isKnockedDown(p, platform) ? 0 : 1), 0);
}
