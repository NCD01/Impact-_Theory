/**
 * constants.js
 *
 * OWNS: every tuning value in the game that is not a physics material property or a
 * level's own data. This is the one file to open when something feels wrong.
 *
 * MUST NOT OWN: material families (src/blocks/families.js), level layouts
 * (levels/*.json), or the version string (src/core/version.js).
 *
 * Units. Distance is Structural Units, written SU. 1 SU = 1 metre, which is the block
 * kit's own convention from Assets/Art/Blocks/README.md, adopted unchanged so there is
 * exactly one scale in the project. Time is seconds. Mass is kilograms. Angles are
 * radians unless a name ends in _DEG. Energy is joules.
 *
 * Every value below carries what it is, why it is that number, and where the number
 * came from. A value marked "tuned" was arrived at by running the game and watching it.
 */

// ---------------------------------------------------------------------------
// Physics world
// ---------------------------------------------------------------------------

export const WORLD = {
  /** Earth gravity. SU is a metre, so this is the literal physical value. */
  GRAVITY_Y: -9.81,

  /**
   * Fixed physics timestep, 60 Hz. Fixed rather than frame derived so that a
   * deterministic test rig can replay a collapse and get the same answer, and so a
   * phone dropping to 40 fps does not change how a structure falls. The render loop
   * accumulates real time and steps this many times.
   */
  FIXED_TIMESTEP: 1 / 60,

  /**
   * Upper bound on physics steps per rendered frame. Without it a long stall (a tab
   * regaining focus, a garbage collection pause) produces a burst of steps that
   * lengthens the stall, which lengthens the next burst. Three steps means the
   * simulation is allowed to run at a third real speed rather than spiral.
   */
  MAX_STEPS_PER_FRAME: 3,

  /**
   * Rapier solver iterations, left at Rapier's own default of 4.
   *
   * Honest scope note: the phase 3 spike varied body count only. This value was not
   * varied, so there is no measurement here saying 4 is better than 8. What was
   * observed is that stacks of the size this game builds stand without visible sinking
   * or jitter at 4. Raising it would cost solver time per step and is the first thing
   * to try if a tall stack is ever seen to sag.
   */
  SOLVER_ITERATIONS: 4,

  /** Half width of the square ground collider, SU. Comfortably past the far backdrop. */
  GROUND_HALF_EXTENT: 60,

  /**
   * Damping applied to every piece and fragment, per second.
   *
   * Small on purpose. Damping is not friction: it bleeds energy out of a body regardless
   * of what it is touching, so a large value makes a collapse look like it is happening
   * underwater. These values exist only to stop the very small residual jitter that keeps
   * a settled stack awake and costing solver time forever.
   */
  PIECE_LINEAR_DAMPING: 0.06,
  PIECE_ANGULAR_DAMPING: 0.12,

  /**
   * Damping for a ball, lower still. A ball is meant to carry its energy to the target,
   * so almost nothing is taken out of it in flight.
   */
  BALL_LINEAR_DAMPING: 0.01,
  BALL_ANGULAR_DAMPING: 0.05,

  /** Ground surface. High friction so debris stops rather than skating across the sand. */
  GROUND_FRICTION: 0.9,
  GROUND_RESTITUTION: 0.05,

  /**
   * Contact force below which Rapier raises no event, newtons. A settled structure
   * presses on itself constantly, and without a floor the event queue fills with the
   * weight of the structure standing still.
   */
  CONTACT_FORCE_EVENT_THRESHOLD_N: 60,

  /**
   * A body slower than this in SU/s and rad/s for SLEEP_TIME_S is put to sleep by
   * Rapier and stops costing solver time. Rubble at rest is the majority of bodies
   * late in a level, so this matters more than it looks.
   */
  SLEEP_LINEAR_THRESHOLD: 0.12,
  SLEEP_ANGULAR_THRESHOLD: 0.12,
  SLEEP_TIME_S: 0.5,
};

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export const CAMERA = {
  /**
   * Fixed position behind and above the cannon, matching the reference clip where the
   * camera sits over the gunner's shoulder and never moves during play. SU.
   */
  POSITION: [0, 3.6, 8.6],
  /** The point the camera looks at. Puts the playfield in the upper two thirds. */
  LOOK_AT: [0, 2.3, -6.5],

  /**
   * Vertical field of view in degrees. A portrait phone is tall and narrow, so a wider
   * vertical angle is needed to keep the same amount of playfield on screen as a short
   * wide desktop window. Chosen by capturing both viewports and comparing.
   */
  FOV_PORTRAIT_DEG: 58,
  FOV_LANDSCAPE_DEG: 40,
  /** Aspect ratio below which the portrait field of view is used. */
  PORTRAIT_ASPECT_THRESHOLD: 0.85,

  NEAR: 0.1,
  FAR: 220,
};

/**
 * Camera shake. Amplitude is proportional to impact energy, clamped, and decays
 * exponentially. Shake is a feedback channel, not an effect: it is what makes a heavy
 * hit read as heavy, so it is scaled by the same energy number that drives damage.
 */
export const SHAKE = {
  /** SU of camera offset per joule of impact energy. Tuned against a stone hit. */
  AMPLITUDE_PER_JOULE: 0.00042,
  /** Hard ceiling in SU, so a pile-up cannot throw the camera off the playfield. */
  MAX_AMPLITUDE: 0.34,
  /** Per second decay factor. 0.001 means amplitude falls to a thousandth in a second. */
  DECAY_PER_SECOND: 0.0016,
  /** Shake oscillation rate, Hz. Fast enough to read as a jolt, not a wobble. */
  FREQUENCY_HZ: 22,
  /** Impacts below this energy do not shake at all, so light grazes stay quiet. */
  MIN_ENERGY_J: 12,
};

// ---------------------------------------------------------------------------
// Cannon and firing
// ---------------------------------------------------------------------------

export const CANNON = {
  /** Muzzle pivot position, SU. Sits at the near edge of the playfield. */
  POSITION: [0, 1.05, 4.4],
  /** Distance from pivot to muzzle mouth, SU. Balls spawn at the mouth. */
  BARREL_LENGTH: 1.9,
  BARREL_RADIUS: 0.42,

  /** Ball speed leaving the muzzle, SU/s. Tuned so a flat shot crosses 12 SU quickly. */
  MUZZLE_SPEED: 27,

  /**
   * Aim limits. Yaw is left and right from straight ahead; pitch is up from level.
   * Clamped so the barrel can neither point at the sky, which wastes a shot, nor back
   * at the player, which in the reference clip is impossible.
   */
  YAW_LIMIT_RAD: 0.62,
  PITCH_MIN_RAD: -0.02,
  PITCH_MAX_RAD: 0.58,

  /** Screen pixels of drag per radian of aim change. Lower is more sensitive. */
  DRAG_PIXELS_PER_RADIAN: 620,

  /**
   * Minimum seconds between shots when the player holds to stream. The reference clip
   * shows several balls in flight at once, so the cap is generous. Whether that game
   * fires per tap, in bursts, or as a held stream could not be read from the frames
   * and is recorded as UNVERIFIED in HANDOFF.md.
   */
  FIRE_INTERVAL_S: 0.17,

  /** Muzzle flash duration, seconds. Short; it is a punctuation mark, not a light show. */
  FLASH_DURATION_S: 0.09,
};

export const BALL = {
  /** Radius in SU for each difficulty. Easy uses a larger ball so a child connects. */
  RADIUS_NORMAL: 0.3,
  RADIUS_EASY: 0.42,

  /**
   * Density, kg per cubic SU. A cannonball is dense relative to the blocks it hits, so
   * a 0.3 SU ball at 900 weighs about 102 kg and carries roughly 37 kJ at muzzle speed.
   * That is enough to break wood in one hit and stone in several, which is the shape of
   * the reference clip.
   */
  DENSITY: 900,
  RESTITUTION: 0.32,
  FRICTION: 0.55,

  /** Seconds before a ball is removed. Long enough to roll to rest and be seen. */
  LIFETIME_S: 9,
  /** Hard cap on balls in the world, so hold-to-fire cannot exhaust the body budget. */
  MAX_ALIVE: 20,
  /** Below this height a ball has left the playfield and is removed at once, SU. */
  KILL_BELOW_Y: -8,
};

// ---------------------------------------------------------------------------
// Playfield
// ---------------------------------------------------------------------------

export const PLAYFIELD = {
  /** Where structures are built, SU. Level files place pieces relative to this. */
  STRUCTURE_ORIGIN: [0, 0, -8.5],
  /** Ground plane height, SU. Everything rests on this. */
  GROUND_Y: 0,
  /**
   * A piece whose centre falls below this height counts as no longer standing, for
   * level clear purposes. Set just above the ground so a piece lying flat on the sand
   * qualifies while a piece still stacked does not.
   */
  REST_HEIGHT_THRESHOLD: 0.62,
  /** A piece further than this from the structure origin has been knocked clear, SU. */
  OUT_OF_PLAY_RADIUS: 34,
};

// ---------------------------------------------------------------------------
// Destruction
// ---------------------------------------------------------------------------

export const DESTRUCTION = {
  /**
   * Impacts below this energy do no damage at all. Without a floor, a settling stack
   * grinds itself to death from its own contact forces while nobody is shooting.
   * Joules.
   *
   * Set from measurement rather than taste. Logging every impact in a standing forty
   * piece wall over two and a half seconds gave 4613 contacts, all of them under 10 J
   * and the largest 5 J. 25 J is five times the worst settling contact observed and far
   * below the few hundred joules of even a glancing ball hit, so it separates the two
   * cleanly with room to spare for a larger structure.
   */
  MIN_DAMAGE_ENERGY_J: 25,

  /**
   * Fragments produced when a piece fractures. Kept low deliberately: fragments are
   * dynamic bodies and they come out of the same budget the structure does. Measured
   * in the phase 3 spike.
   */
  FRAGMENTS_MIN: 3,
  FRAGMENTS_MAX: 5,

  /** Fragment edge length as a fraction of the parent's smallest dimension. */
  FRAGMENT_SIZE_FACTOR: 0.42,
  /** Random outward speed given to a fragment on top of the parent's velocity, SU/s. */
  FRAGMENT_SCATTER_SPEED: 2.6,
  /** Seconds before a resting fragment despawns. Fragments never accumulate. */
  FRAGMENT_LIFETIME_S: 6,
  /**
   * Hard cap on fragments alive at once.
   *
   * Set from the phase 3 body budget spike (docs/DECISIONS.md D-006). The measured
   * ceiling is about 120 concurrent dynamic bodies before the frame rate falls under
   * 45. A level is capped at 45 pieces, and at most 20 balls can be in flight, so
   * capping fragments at 36 bounds the absolute worst instant at roughly 100 bodies
   * and keeps it inside the measured ceiling with the collapse still going.
   */
  MAX_FRAGMENTS: 36,

  /**
   * How far a piece must be through its hit points before it starts to darken, and how
   * much darker it gets at the point of breaking. Below the threshold nothing shows,
   * because tinting on the first graze makes every structure look damaged at a glance.
   */
  DAMAGE_TINT_THRESHOLD: 0.25,
  DAMAGE_TINT_DEPTH: 0.45,

  /**
   * How far across the parent piece a fragment may spawn, as a fraction of the parent's
   * own size. Below 1 so debris appears from inside the piece that broke rather than
   * from a shell around it.
   */
  FRAGMENT_SPAWN_SPREAD: 0.7,

  /** Dust particles per fracture, and how long they live. */
  DUST_PARTICLES: 14,
  DUST_LIFETIME_S: 0.85,
  DUST_RISE_SPEED: 1.1,
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const SCORING = {
  /** Base points for destroying one piece, before the material weight multiplies it. */
  BASE_PIECE_POINTS: 100,

  /**
   * Two destructions within this many seconds of each other belong to the same combo.
   * Set at roughly the time a collapse takes to propagate down a stack, so one good
   * shot that brings a tower down reads as one combo rather than five separate hits.
   */
  COMBO_WINDOW_S: 1.4,
  /** Each extra piece in a combo adds this to the multiplier. */
  COMBO_STEP: 0.5,
  /** Ceiling on the combo multiplier, so a full collapse cannot dwarf every other score. */
  COMBO_MAX_MULTIPLIER: 6,

  /** Points for each unused ball at level clear, before difficulty scaling. */
  BALL_SAVED_POINTS: 250,
};

/**
 * Star thresholds, expressed as balls used against the level's par.
 * Three stars means clearing at or under par, two means within the first slack band,
 * one means cleared at all. Easy widens both bands, which is the only thing difficulty
 * changes about stars.
 */
export const STARS = {
  NORMAL: { THREE_AT_OR_UNDER_PAR: 0, TWO_WITHIN: 2 },
  EASY: { THREE_AT_OR_UNDER_PAR: 2, TWO_WITHIN: 5 },
};

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

/**
 * Difficulty changes tuning values only. There is exactly one code path through the
 * game; every difference between Easy and Normal is a number read from here.
 *
 * Easy targets roughly four to seven years old: unlimited balls, no fail state ever,
 * a bigger ball, and weaker pieces so something visible happens on every shot.
 * Normal targets roughly eight to twelve: balls limited by par, and a level can fail.
 */
export const DIFFICULTY = {
  easy: {
    label: 'Easy',
    ballRadius: BALL.RADIUS_EASY,
    /** Unlimited balls. Null rather than a large number, so the HUD can show a dash. */
    ballLimitFromPar: null,
    canFail: false,
    /** Every family's hit points are multiplied by this, so pieces break sooner. */
    hitPointScale: 0.55,
    /** Impact energy is multiplied by this before damage, so hits land harder. */
    damageScale: 1.35,
    starBands: STARS.EASY,
  },
  normal: {
    label: 'Normal',
    ballRadius: BALL.RADIUS_NORMAL,
    /** Balls available equals par plus this. Zero means exactly par. */
    ballLimitFromPar: 0,
    canFail: true,
    hitPointScale: 1,
    damageScale: 1,
    starBands: STARS.NORMAL,
  },
};

/** The difficulty used when no save exists. Easy, because the first player is a child. */
export const DEFAULT_DIFFICULTY = 'easy';

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export const AUDIO = {
  /** Master gain applied over every sound, so one number turns the game down. */
  MASTER_GAIN: 0.75,
  /** Impact energy in joules that maps to full volume on an impact sound. */
  IMPACT_FULL_VOLUME_ENERGY_J: 900,
  /** Impacts below this energy make no sound, matching the damage floor. */
  IMPACT_MIN_ENERGY_J: 8,
  /** Most impact sounds allowed to start in one frame, so a collapse does not clip. */
  MAX_IMPACTS_PER_FRAME: 3,
  /** Seconds before the same family's impact sound may retrigger. */
  IMPACT_RETRIGGER_S: 0.045,
  MUSIC_GAIN: 0.3,
};

// ---------------------------------------------------------------------------
// Level flow
// ---------------------------------------------------------------------------

export const LEVEL = {
  /** Hand designed level count. The scope fence in the brief caps this at thirty. */
  COUNT: 30,

  /**
   * Most pieces a single level may place, supports included. Enforced by the level
   * validator, so an over budget level fails the test suite rather than shipping and
   * stuttering on the target phone.
   *
   * From the phase 3 spike: a 40 piece wall peaked at 55 concurrent bodies mid
   * collapse, and a 100 piece wall peaked at 132, which is past the measured 120 body
   * ceiling for 45 fps. 45 pieces sits comfortably inside the budget with the fragment
   * and ball caps applied. See docs/DECISIONS.md D-006.
   */
  MAX_PIECES: 45,
  /**
   * Seconds the world must be settled before a level is judged cleared or failed.
   * Without a settle delay, a structure that is mid collapse reads as cleared for one
   * frame and the results screen appears over a still moving pile.
   */
  SETTLE_TIME_S: 1.1,
  /** Total speed below which the world counts as settled, summed over live bodies. */
  SETTLE_SPEED_EPSILON: 0.55,
  /** Seconds after the last ball lands before a failed level is declared failed. */
  FAIL_GRACE_S: 2.2,
};
