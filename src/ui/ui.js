/**
 * ui.js
 *
 * OWNS: every piece of DOM the player sees over the canvas. The heads up display, the
 * title screen, level select, pause, settings and the results screen, and the score
 * popups that rise from a destroyed piece.
 *
 * MUST NOT OWN: any game rule. It renders what it is given and reports what was pressed.
 * A number shown here is computed elsewhere; nothing in this file decides a score, a star
 * or an unlock.
 *
 * Portrait first, and it must survive a desktop landscape window. Both are handled by
 * the stylesheet in index.html plus the small amount of layout here, with no separate
 * desktop path.
 *
 * On screen positioning of score popups. A popup is anchored to a world position, and
 * the conversion from that world position to pixels goes through the single projection
 * helper, never through arithmetic in this file. Standard 4.
 *
 * All user facing text in this file is spell checked British English and written to be
 * read by a child.
 */

/**
 * Creates the interface.
 *
 * Assumes `root` is an element layered over the canvas and that `projection` is the
 * shared helper. `handlers` are called on presses; every one is optional.
 *
 * @param {HTMLElement} root
 * @param {import('../core/projection.js').Projection} projection
 * @param {object} handlers
 */
export function createUI(root, projection, handlers = {}) {
  root.innerHTML = TEMPLATE;

  const el = (id) => root.querySelector(`#${id}`);

  const nodes = {
    hud: el('hud'),
    hudLevel: el('hud-level'),
    hudScore: el('hud-score'),
    hudBalls: el('hud-balls'),
    hudBallsLabel: el('hud-balls-label'),
    hudStanding: el('hud-standing'),
    hudCombo: el('hud-combo'),
    pauseButton: el('pause-button'),

    popups: el('popups'),

    title: el('screen-title'),
    select: el('screen-select'),
    levelGrid: el('level-grid'),
    selectStars: el('select-stars'),
    results: el('screen-results'),
    resultsTitle: el('results-title'),
    resultsStars: el('results-stars'),
    resultsScore: el('results-score'),
    resultsDetail: el('results-detail'),
    resultsNext: el('results-next'),
    pause: el('screen-pause'),
    settings: el('screen-settings'),
    difficultyButtons: root.querySelectorAll('[data-difficulty]'),
    muteButton: el('mute-button'),
    debug: el('debug'),
    hint: el('hint'),
    version: el('version-label'),
  };

  /** Live score popups, aged out in update(). */
  const popups = [];

  // ---- Wiring -------------------------------------------------------------
  const on = (id, fn) => el(id)?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers.onAnyPress?.();
    fn(e);
  });

  on('title-play', () => handlers.onPlay?.());
  on('title-levels', () => handlers.onChooseLevel?.());
  on('title-endless', () => handlers.onEndless?.());
  on('title-settings', () => show('settings'));
  on('select-back', () => show('title'));
  on('pause-button', () => handlers.onPause?.());
  on('pause-resume', () => handlers.onResume?.());
  on('pause-retry', () => handlers.onRetry?.());
  on('pause-quit', () => handlers.onQuit?.());
  on('results-next', () => handlers.onNext?.());
  on('results-retry', () => handlers.onRetry?.());
  on('results-select', () => handlers.onQuit?.());
  on('settings-back', () => show('title'));
  on('settings-reset', () => handlers.onResetProgress?.());
  on('mute-button', () => handlers.onToggleMute?.());

  for (const button of nodes.difficultyButtons) {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onAnyPress?.();
      handlers.onDifficulty?.(button.dataset.difficulty);
    });
  }

  /**
   * Shows one screen and hides the rest.
   *
   * `none` shows the game with only the heads up display, which is the playing state.
   * Uses the hidden property rather than a style, so a screen cannot be left visible by
   * a stylesheet change.
   *
   * @param {'title'|'select'|'results'|'pause'|'settings'|'none'} which
   */
  function show(which) {
    for (const name of ['title', 'select', 'results', 'pause', 'settings']) {
      nodes[name].hidden = name !== which;
    }
    nodes.hud.hidden = which !== 'none';
    root.dataset.screen = which;
  }

  /**
   * Updates the heads up display from a session snapshot.
   *
   * Assumes `data` is the object session.hud() returns. Writes only when a value has
   * changed, because touching textContent every frame on a phone forces layout sixty
   * times a second for no reason.
   *
   * @param {object} data
   */
  const lastHud = {};
  function updateHud(data) {
    setText(nodes.hudLevel, `${data.levelId}. ${data.levelName}`, 'level');
    setText(nodes.hudScore, String(data.score), 'score');
    setText(nodes.hudStanding, String(data.standing), 'standing');
    // A dash rather than a big number when balls are unlimited, so Easy reads as having
    // no limit rather than a limit a long way off.
    setText(nodes.hudBalls, data.ballsLeft === null ? '—' : String(data.ballsLeft), 'balls');
    setText(nodes.hudBallsLabel, data.ballsLeft === null ? 'Balls' : 'Balls left', 'ballsLabel');

    const showCombo = data.combo >= 2;
    if (lastHud.combo !== data.combo) {
      nodes.hudCombo.textContent = showCombo ? `${data.combo} in a row` : '';
      nodes.hudCombo.hidden = !showCombo;
      lastHud.combo = data.combo;
    }
  }

  function setText(node, value, key) {
    if (lastHud[key] === value) return;
    lastHud[key] = value;
    node.textContent = value;
  }

  /**
   * Adds a floating score popup anchored to a world position.
   *
   * The world to screen conversion goes through the projection helper. A point behind
   * the camera is dropped rather than drawn at a wrong position.
   *
   * @param {{x: number, y: number, z: number}} worldPosition
   * @param {number} points
   * @param {number} multiplier
   */
  function addScorePopup(worldPosition, points, multiplier) {
    const node = document.createElement('div');
    node.className = 'popup';
    node.textContent = multiplier > 1 ? `+${points} x${multiplier}` : `+${points}`;
    nodes.popups.append(node);
    popups.push({ node, world: { ...worldPosition }, age: 0 });
    // A hard cap, because a full collapse can destroy twenty pieces in a second and
    // twenty animated elements on a phone is a visible stall.
    if (popups.length > 12) {
      popups.shift().node.remove();
    }
  }

  /**
   * Ages popups and repositions them. Call once per rendered frame.
   * @param {number} dt Seconds.
   */
  function update(dt) {
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      const p = popups[i];
      p.age += dt;
      if (p.age > 1.1) {
        p.node.remove();
        popups.splice(i, 1);
        continue;
      }
      const screen = projection.worldToScreen(p.world);
      if (screen.behind) {
        p.node.style.opacity = '0';
        continue;
      }
      const rise = p.age * 42;
      p.node.style.transform = `translate(${screen.x}px, ${screen.y - rise}px) translate(-50%, -50%)`;
      p.node.style.opacity = String(Math.max(0, 1 - p.age / 1.1));
    }
  }

  /**
   * Builds the level select grid.
   *
   * @param {Array<{id: number, name: string, par: number}>} levels
   * @param {(id: number) => {unlocked: boolean, stars: number, score: number}} lookup
   * @param {number} totalStars
   */
  function renderLevelSelect(levels, lookup, totalStars) {
    nodes.levelGrid.innerHTML = '';
    for (const level of levels) {
      const info = lookup(level.id);
      const button = document.createElement('button');
      button.className = 'level-cell';
      button.type = 'button';
      button.disabled = !info.unlocked;
      button.dataset.levelId = String(level.id);
      button.setAttribute(
        'aria-label',
        info.unlocked
          ? `Level ${level.id}, ${level.name}, ${info.stars} of 3 stars`
          : `Level ${level.id}, locked`,
      );
      button.innerHTML = info.unlocked
        ? `<span class="level-number">${level.id}</span>
           <span class="level-name">${escapeHtml(level.name)}</span>
           <span class="level-stars">${starGlyphs(info.stars)}</span>`
        : `<span class="level-number">${level.id}</span>
           <span class="level-name">Locked</span>
           <span class="level-stars">&#8226;&#8226;&#8226;</span>`;
      if (info.unlocked) {
        button.addEventListener('click', () => {
          handlers.onAnyPress?.();
          handlers.onSelectLevel?.(level.id);
        });
      }
      nodes.levelGrid.append(button);
    }
    nodes.selectStars.textContent = `${totalStars} of ${levels.length * 3} stars`;
  }

  /**
   * Shows the results screen.
   *
   * @param {object} result From scoring.finish(), plus `cleared`.
   * @param {boolean} hasNext Whether a next level exists.
   */
  function showResults(result, hasNext) {
    nodes.resultsTitle.textContent = result.cleared ? 'Level clear' : 'Out of balls';
    nodes.resultsStars.innerHTML = result.cleared ? starGlyphs(result.stars) : starGlyphs(0);
    nodes.resultsScore.textContent = result.cleared ? String(result.score) : '';
    nodes.resultsDetail.textContent = result.cleared
      ? `${result.destroyed} pieces down, ${result.ballsUsed} of ${result.par} balls used`
      : 'Nothing left to fire. Give it another go.';
    nodes.resultsNext.hidden = !(result.cleared && hasNext);
    show('results');
  }

  /** Reflects the stored difficulty and mute state in settings. */
  function syncSettings({ difficulty, muted }) {
    for (const button of nodes.difficultyButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.difficulty === difficulty));
      button.classList.toggle('selected', button.dataset.difficulty === difficulty);
    }
    nodes.muteButton.textContent = muted ? 'Sound: off' : 'Sound: on';
    nodes.muteButton.setAttribute('aria-pressed', String(muted));
  }

  /**
   * Shows the how to play hint over the game, for a few seconds.
   *
   * Shown on the first level a player ever opens and not again, because a hint that
   * reappears every level is an obstacle rather than help. It is pointer transparent, so
   * it never eats the first touch it is telling the player to make.
   *
   * @param {number} seconds
   */
  function showHint(seconds = 4) {
    nodes.hint.hidden = false;
    nodes.hint.classList.remove('fading');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      nodes.hint.classList.add('fading');
      hintTimer = setTimeout(() => { nodes.hint.hidden = true; }, 600);
    }, seconds * 1000);
  }

  let hintTimer = 0;

  function hideHint() {
    clearTimeout(hintTimer);
    nodes.hint.hidden = true;
  }

  /** Writes the debug overlay, or hides it. */
  function setDebug(text) {
    if (!text) { nodes.debug.hidden = true; return; }
    nodes.debug.hidden = false;
    nodes.debug.textContent = text;
  }

  function setVersion(text) {
    nodes.version.textContent = text;
  }

  return {
    show,
    updateHud,
    update,
    addScorePopup,
    renderLevelSelect,
    showResults,
    syncSettings,
    showHint,
    hideHint,
    setDebug,
    setVersion,
    get screen() { return root.dataset.screen; },
  };
}

/**
 * Filled stars up to `n`, hollow after, as markup.
 *
 * Text glyphs rather than an image, so the game ships no art for this. The two states
 * are given different classes rather than only different glyphs, because at level select
 * size a hollow star in the same gold colour is almost indistinguishable from a filled
 * one, which made an uncleared level look like a three star clear.
 *
 * @param {number} n
 * @returns {string} HTML.
 */
function starGlyphs(n) {
  const filled = '<span class="star on">★</span>'.repeat(n);
  const empty = '<span class="star off">☆</span>'.repeat(Math.max(0, 3 - n));
  return filled + empty;
}

/** Escapes level names before they go into innerHTML. Level names are authored by us,
 *  but a level file is data and data does not get to write markup. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * The interface markup.
 *
 * Written as one template rather than built node by node, because it is static
 * structure. Every dynamic value is set through the functions above.
 */
const TEMPLATE = `
<div id="popups" class="popups"></div>

<div id="hud" class="hud" hidden>
  <div class="hud-row">
    <div class="hud-stat"><span class="hud-value" id="hud-score">0</span><span class="hud-label">Score</span></div>
    <div class="hud-stat"><span class="hud-value" id="hud-balls">0</span><span class="hud-label" id="hud-balls-label">Balls</span></div>
    <div class="hud-stat"><span class="hud-value" id="hud-standing">0</span><span class="hud-label">Standing</span></div>
    <button id="pause-button" class="icon-button" type="button" aria-label="Pause">&#10073;&#10073;</button>
  </div>
  <div class="hud-level" id="hud-level"></div>
  <div class="hud-combo" id="hud-combo" hidden></div>
</div>

<section id="screen-title" class="screen" hidden>
  <div class="panel">
    <h1>Impact Theory</h1>
    <p class="tagline">Point the cannon. Bring it down.</p>
    <button id="title-play" class="primary" type="button">Play</button>
    <button id="title-levels" type="button">Choose a level</button>
    <button id="title-endless" type="button">Endless</button>
    <button id="title-settings" type="button">Settings</button>
    <ul class="howto">
      <li><b>Touch where you want to hit.</b> The cannon aims there.</li>
      <li><b>Lift your finger to fire.</b></li>
      <li><b>Hold to keep firing.</b></li>
      <li>Knock everything down to finish the level.</li>
    </ul>
    <p class="version" id="version-label"></p>
  </div>
</section>

<section id="screen-select" class="screen" hidden>
  <div class="panel wide">
    <h2>Choose a level</h2>
    <p class="subtle" id="select-stars"></p>
    <div id="level-grid" class="level-grid"></div>
    <button id="select-back" type="button">Back</button>
  </div>
</section>

<section id="screen-results" class="screen" hidden>
  <div class="panel">
    <h2 id="results-title">Level clear</h2>
    <p class="stars" id="results-stars"></p>
    <p class="big-score" id="results-score"></p>
    <p class="subtle" id="results-detail"></p>
    <button id="results-next" class="primary" type="button">Next level</button>
    <button id="results-retry" type="button">Try again</button>
    <button id="results-select" type="button">Level select</button>
  </div>
</section>

<section id="screen-pause" class="screen" hidden>
  <div class="panel">
    <h2>Paused</h2>
    <button id="pause-resume" class="primary" type="button">Carry on</button>
    <button id="pause-retry" type="button">Start again</button>
    <button id="pause-quit" type="button">Level select</button>
  </div>
</section>

<section id="screen-settings" class="screen" hidden>
  <div class="panel">
    <h2>Settings</h2>
    <p class="subtle">Difficulty</p>
    <button data-difficulty="easy" type="button" aria-pressed="false">Easy</button>
    <button data-difficulty="normal" type="button" aria-pressed="false">Normal</button>
    <p class="subtle small">Easy gives unlimited balls and no way to lose. Normal limits
      your balls to the level's par.</p>
    <button id="mute-button" type="button" aria-pressed="false">Sound: on</button>
    <button id="settings-reset" type="button">Erase progress</button>
    <button id="settings-back" class="primary" type="button">Back</button>
  </div>
</section>

<div id="hint" class="hint" hidden>
  <p>Touch where you want to hit, then lift your finger to fire.</p>
</div>

<pre id="debug" class="debug" hidden></pre>
`;
