/**
 * controls.js
 *
 * OWNS: turning pointer events into two game intentions, aim and fire. Nothing else.
 *
 * MUST NOT OWN: any screen to world arithmetic. Every pixel measurement here goes through
 * the projection helper, because standard 4 requires exactly one place that knows about
 * viewport size and this is the handler most likely to break that rule. If you find
 * yourself reaching for window.innerWidth in this file, the answer is in
 * src/core/projection.js.
 *
 * One code path serves touch and mouse. Pointer events unify them, so there is no
 * separate desktop path to keep in step.
 *
 * THE CONTROL SCHEME, AND WHY IT CHANGED.
 *
 * It is now **point to aim**: touch or move over a spot and the cannon aims at that spot
 * directly. Lift to fire. Hold to keep firing.
 *
 * The first version was a relative drag, where the aim moved by however far the finger
 * travelled. The owner's verdict after playing it was that he had to "hold my finger in
 * the screen and drag it to move the cannon", when he should "just point and it should
 * move", and that dragging right moved the cannon left. Both complaints were right. The
 * inversion was a genuine sign error in the yaw, and relative drag is the wrong scheme
 * for a game where the whole screen is the target: it makes the player do arithmetic to
 * work out where the barrel will end up.
 *
 * Point to aim means the barrel goes where the finger is, every time, with no memory of
 * where it was before. A child can play it without being told how.
 *
 * On a desktop the same handler also tracks the mouse with no button held, so the cannon
 * follows the cursor and a click fires where it is pointing.
 */

import { CANNON } from '../core/constants.js';

/** Seconds a pointer must be held before hold-to-stream starts. */
const HOLD_TO_STREAM_DELAY_S = 0.28;

/**
 * Attaches pointer handling to the canvas.
 *
 * Assumes `projection.resize()` has been called at least once, and that the caller calls
 * `update(dt)` every frame so hold-to-stream can fire. `onAimAt` receives a world space
 * point the player is pointing at, already resolved through the projection helper, or is
 * not called at all when the pointer is somewhere that does not resolve to a point, such
 * as above the horizon.
 *
 * Returns a controller with a `dispose()` that removes every listener; a teardown that
 * forgets to call it leaks a listener per level.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {import('../core/projection.js').Projection} projection
 * @param {object} handlers
 * @param {(target: {x: number, y: number, z: number}) => void} handlers.onAimAt
 * @param {() => void} handlers.onFire
 * @param {() => number} handlers.getAimDepth  World Z of the plane to aim within, SU.
 */
export function createControls(canvas, projection, { onAimAt, onFire, getAimDepth }) {
  let pointerId = null;
  let heldFor = 0;
  let streamCooldown = 0;
  let streaming = false;
  let enabled = true;

  /**
   * Resolves a pointer position to a world point and reports it.
   *
   * The point is taken on a vertical plane at the structure's own depth, so pointing at a
   * block on screen produces that block's position in the world and the cannon can be
   * aimed straight at it. Height is clamped at the ground, because pointing at the sand in
   * front of the structure should aim at the sand, not below it.
   */
  function aimFromEvent(event) {
    const point = projection.eventToDepthPlanePoint(event, getAimDepth());
    if (!point) return;
    onAimAt({ x: point.x, y: Math.max(0, point.y), z: point.z });
  }

  function onPointerDown(event) {
    if (!enabled) return;
    pointerId = event.pointerId;
    heldFor = 0;
    streaming = false;
    streamCooldown = 0;
    // Aim immediately on touch down, so the first thing a finger does is move the cannon
    // rather than nothing.
    aimFromEvent(event);
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!enabled) return;
    // With a pointer down this is a drag, and the aim follows the finger. With no pointer
    // down it is a mouse moving over the canvas, and the aim follows the cursor, which is
    // what a desktop player expects. A touch screen sends no move events without contact,
    // so this costs nothing there.
    if (pointerId !== null && event.pointerId !== pointerId) return;
    aimFromEvent(event);
  }

  function onPointerUp(event) {
    if (event.pointerId !== pointerId) return;
    canvas.releasePointerCapture?.(event.pointerId);
    pointerId = null;
    // Every release fires, unless the hold already started streaming, in which case the
    // shots have been going out all along and one more on release would be a surprise.
    // There is no drag threshold any more: with point to aim, a drag is aiming and the
    // release is still the shot the player asked for.
    if (enabled && !streaming) onFire();
    streaming = false;
  }

  function onPointerCancel(event) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    streaming = false;
  }

  /**
   * Drives hold-to-stream. Must be called once per frame.
   *
   * Rate limited by CANNON.FIRE_INTERVAL_S rather than by frame rate, so a phone at 40 fps
   * and a desktop at 144 fps fire at the same rate.
   *
   * @param {number} dt Seconds since the last frame.
   */
  function update(dt) {
    if (streamCooldown > 0) streamCooldown -= dt;
    if (!enabled || pointerId === null) return;

    heldFor += dt;
    if (heldFor < HOLD_TO_STREAM_DELAY_S) return;

    if (!streaming) {
      streaming = true;
      // The first streamed shot goes immediately, so holding feels responsive rather than
      // delayed by a full interval on top of the hold delay.
      streamCooldown = 0;
    }
    if (streamCooldown <= 0) {
      onFire();
      streamCooldown = CANNON.FIRE_INTERVAL_S;
    }
  }

  /** Stops responding to input, for menus and the results screen. */
  function setEnabled(value) {
    enabled = value;
    if (!value) {
      pointerId = null;
      streaming = false;
    }
  }

  const options = { passive: true };
  canvas.addEventListener('pointerdown', onPointerDown, options);
  canvas.addEventListener('pointermove', onPointerMove, options);
  canvas.addEventListener('pointerup', onPointerUp, options);
  canvas.addEventListener('pointercancel', onPointerCancel, options);
  // Without this a long press on a phone opens the browser's own context menu over the
  // game, and the pointerup that would have fired the shot never arrives.
  const blockContextMenu = (e) => e.preventDefault();
  canvas.addEventListener('contextmenu', blockContextMenu);

  function dispose() {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('contextmenu', blockContextMenu);
  }

  return { update, setEnabled, dispose, get isStreaming() { return streaming; } };
}
