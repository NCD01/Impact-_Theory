/**
 * controls.js
 *
 * OWNS: turning pointer events into two game intentions, aim and fire. Nothing else.
 *
 * MUST NOT OWN: any screen to world arithmetic. Every pixel measurement here goes
 * through the projection helper, because standard 4 requires exactly one place that
 * knows about viewport size and this is the handler most likely to break that rule.
 * If you find yourself reaching for window.innerWidth in this file, the answer is in
 * src/core/projection.js.
 *
 * One code path serves touch and mouse. Pointer events unify them, so there is no
 * separate desktop path to keep in step.
 *
 * The control scheme, which matches the reference clip's single thumb interaction:
 *   Drag anywhere    aims the cannon. Horizontal drag is yaw, vertical drag is pitch.
 *   Release          fires, if the drag was short enough to count as a tap.
 *   Hold             streams shots at a capped rate.
 *
 * Dragging to aim and tapping to fire share the same gesture on purpose. A drag that
 * moved a long way is treated as aiming only, so a player lining up a shot does not
 * fire by accident when they lift their thumb.
 */

import { CANNON } from '../core/constants.js';

/**
 * Movement in viewport fractions beyond which a gesture is aiming rather than tapping.
 * 0.02 is about 8 px on a 400 px wide phone, which is under the width of a fingertip,
 * so a deliberate tap still fires while a real aim drag does not.
 */
const TAP_MOVEMENT_THRESHOLD = 0.02;

/** Seconds a pointer must be held before hold-to-stream starts. */
const HOLD_TO_STREAM_DELAY_S = 0.22;

/**
 * Attaches pointer handling to the canvas.
 *
 * Assumes `projection.resize()` has been called at least once, and that the caller
 * calls `update(dt)` every frame so hold-to-stream can fire. Returns a controller with
 * a `dispose()` that removes every listener; a level teardown that forgets to call it
 * leaks a listener per level.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {import('../core/projection.js').Projection} projection
 * @param {object} handlers
 * @param {(dYaw: number, dPitch: number) => void} handlers.onAim
 * @param {() => void} handlers.onFire  Called once per shot the player asks for.
 */
export function createControls(canvas, projection, { onAim, onFire }) {
  let pointerId = null;
  let lastX = 0;
  let lastY = 0;
  let travelled = 0;
  let heldFor = 0;
  let streamCooldown = 0;
  let streaming = false;
  let enabled = true;

  /**
   * Converts a pixel movement to an aim change in radians.
   *
   * The conversion runs through the projection helper's viewport fraction, then through
   * a pixels-per-radian constant, so sensitivity is the same fraction of a screen on
   * every device rather than the same number of physical pixels.
   */
  function applyDrag(dxPixels, dyPixels) {
    const frac = projection.pixelsToViewportFraction(dxPixels, dyPixels);
    const { width, height } = projection.metrics();
    // Convert back to a device independent pixel count using the reference dimension,
    // so that DRAG_PIXELS_PER_RADIAN means the same thing in portrait and landscape.
    const reference = Math.min(width, height);
    const dYaw = (frac.x * reference) / CANNON.DRAG_PIXELS_PER_RADIAN;
    // Dragging down aims up, which is how a touch camera behaves everywhere else.
    const dPitch = -(frac.y * reference) / CANNON.DRAG_PIXELS_PER_RADIAN;
    onAim(dYaw, dPitch);
  }

  function onPointerDown(event) {
    if (!enabled || pointerId !== null) return;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    travelled = 0;
    heldFor = 0;
    streaming = false;
    streamCooldown = 0;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!enabled || event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    const frac = projection.pixelsToViewportFraction(dx, dy);
    travelled += Math.hypot(frac.x, frac.y);
    applyDrag(dx, dy);
  }

  function onPointerUp(event) {
    if (event.pointerId !== pointerId) return;
    canvas.releasePointerCapture?.(event.pointerId);
    pointerId = null;
    // A tap fires. A drag does not, so lining up a shot cannot fire by accident. A
    // gesture that already streamed does not fire again on release either.
    if (enabled && !streaming && travelled < TAP_MOVEMENT_THRESHOLD) onFire();
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
   * Streaming is rate limited by CANNON.FIRE_INTERVAL_S rather than by frame rate, so a
   * phone running at 40 fps and a desktop at 144 fps fire at the same rate.
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
      // The first streamed shot goes immediately, so holding feels responsive rather
      // than delayed by a full interval on top of the hold delay.
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
