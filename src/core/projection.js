/**
 * projection.js
 *
 * OWNS: every conversion between screen space and world space in this game. Touch and
 * mouse positions to normalised device coordinates, normalised coordinates to a world
 * ray, world positions to screen pixels for HUD anchoring and the debug overlay, and
 * the viewport size and aspect that all of those depend on.
 *
 * MUST NOT OWN: input interpretation (src/input/controls.js decides what a drag means),
 * or any game rule.
 *
 * Why this file exists at all. Standard 4 of the build brief requires a single
 * projection helper, recalculated on resize, with no handler doing its own screen
 * arithmetic. On this game the touch handler is the entire control scheme, so a second
 * copy of this maths in a pointer handler is the single most likely way the game breaks
 * on a phone while looking fine on a desktop. If you are about to write
 * `event.clientX / window.innerWidth` anywhere else, use this instead.
 *
 * The canvas is assumed to fill its container and to be positioned at the container's
 * top left. getBoundingClientRect is read on resize rather than per event, because
 * reading it inside a pointermove handler forces layout on every move.
 */

import { Raycaster, Vector2, Vector3 } from 'three';

/**
 * Creates the projection helper.
 *
 * Assumes `canvas` is in the document and `camera` is the camera actually used to
 * render. Call `resize()` once before first use and again whenever the canvas changes
 * size; nothing else recalculates the cached rectangle.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {import('three').PerspectiveCamera} camera
 */
export function createProjection(canvas, camera) {
  /** Cached canvas rectangle in CSS pixels. Refreshed only by resize(). */
  let rect = { left: 0, top: 0, width: 1, height: 1 };

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const scratch = new Vector3();

  /**
   * Recalculates the cached viewport rectangle. Must be called after any change to the
   * canvas size or position, including orientation change on a phone. Cheap to call.
   *
   * @returns {{width: number, height: number, aspect: number, portrait: boolean}}
   */
  function resize() {
    const r = canvas.getBoundingClientRect();
    rect = {
      left: r.left,
      top: r.top,
      // Guard against a zero size, which happens for one frame if the canvas is
      // measured while hidden. A zero would produce Infinity in every ratio below.
      width: Math.max(1, r.width),
      height: Math.max(1, r.height),
    };
    return metrics();
  }

  /** Current viewport metrics. Does not re-measure; call resize() for that. */
  function metrics() {
    const aspect = rect.width / rect.height;
    return {
      width: rect.width,
      height: rect.height,
      aspect,
      portrait: aspect < 1,
    };
  }

  /**
   * Converts a pointer event's client position to normalised device coordinates, the
   * -1 to +1 range three.js raycasting expects, with +Y up.
   *
   * Assumes the event carries clientX and clientY, which pointer, mouse and touch
   * events all do. Returns a Vector2 that is reused between calls, so copy it if you
   * need to keep it.
   *
   * @param {{clientX: number, clientY: number}} event
   * @returns {Vector2}
   */
  function eventToNdc(event) {
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    return ndc;
  }

  /**
   * Converts a pointer movement in CSS pixels to a fraction of the viewport.
   *
   * Used by the aim controls so that dragging halfway across the screen means the same
   * thing on a small phone and a large desktop window. Without this, aim sensitivity
   * would depend on the device's pixel count.
   *
   * @param {number} dxPixels
   * @param {number} dyPixels
   * @returns {{x: number, y: number}} Fractions of viewport width and height.
   */
  function pixelsToViewportFraction(dxPixels, dyPixels) {
    return { x: dxPixels / rect.width, y: dyPixels / rect.height };
  }

  /**
   * Builds a world space ray from a pointer event through the camera.
   *
   * Assumes resize() has been called since the last layout change. Returns the shared
   * Raycaster, whose `ray` is valid until the next call.
   *
   * @param {{clientX: number, clientY: number}} event
   * @returns {Raycaster}
   */
  function rayFromEvent(event) {
    raycaster.setFromCamera(eventToNdc(event), camera);
    return raycaster;
  }

  /**
   * Intersects a pointer event's ray with a horizontal plane at height `y`.
   *
   * Returns null when the ray is parallel to the plane or points away from it, which
   * happens when the player drags above the horizon. Callers must handle null rather
   * than assuming a hit, or the aim jumps to a wild value at the horizon.
   *
   * @param {{clientX: number, clientY: number}} event
   * @param {number} y World height of the plane, SU.
   * @returns {Vector3|null} A reused vector. Copy it if you need to keep it.
   */
  function eventToGroundPoint(event, y = 0) {
    const ray = rayFromEvent(event).ray;
    const denom = ray.direction.y;
    if (Math.abs(denom) < 1e-6) return null;
    const t = (y - ray.origin.y) / denom;
    if (t <= 0) return null;
    return scratch.copy(ray.direction).multiplyScalar(t).add(ray.origin);
  }

  /**
   * Intersects a pointer event's ray with a vertical plane at a given depth.
   *
   * This is how "point at the block you want to hit" works: the plane sits at the
   * structure's own Z, so the point returned is where the player's finger is pointing, in
   * the structure's plane, and the cannon can be aimed straight at it.
   *
   * Returns null when the ray is parallel to the plane or points away from it. Callers
   * must handle null rather than assuming a hit.
   *
   * @param {{clientX: number, clientY: number}} event
   * @param {number} z World depth of the plane, SU.
   * @returns {Vector3|null} A reused vector. Copy it if you need to keep it.
   */
  function eventToDepthPlanePoint(event, z) {
    const { ray } = rayFromEvent(event);
    const denom = ray.direction.z;
    if (Math.abs(denom) < 1e-6) return null;
    const t = (z - ray.origin.z) / denom;
    if (t <= 0) return null;
    return scratch.copy(ray.direction).multiplyScalar(t).add(ray.origin);
  }

  /**
   * Projects a world position to CSS pixel coordinates within the canvas.
   *
   * Used for HUD anchoring and the debug overlay. `behind` is true when the point is
   * behind the camera, in which case x and y are meaningless and the caller must hide
   * whatever it was going to draw rather than draw it in the wrong place.
   *
   * @param {Vector3} worldPosition
   * @returns {{x: number, y: number, behind: boolean}}
   */
  function worldToScreen(worldPosition) {
    scratch.copy(worldPosition).project(camera);
    return {
      x: (scratch.x * 0.5 + 0.5) * rect.width,
      y: (-scratch.y * 0.5 + 0.5) * rect.height,
      behind: scratch.z > 1,
    };
  }

  return {
    resize,
    metrics,
    eventToNdc,
    pixelsToViewportFraction,
    rayFromEvent,
    eventToGroundPoint,
    eventToDepthPlanePoint,
    worldToScreen,
  };
}

/** @typedef {ReturnType<typeof createProjection>} Projection */
