/**
 * Portfolio access entry — vanilla port of AccessEntry.
 */
(function () {
  'use strict';

  var GHOST_TEXTS = ['Anna', 'stranger', 'Alex', 'your name...', 'Réka'];
  var PX_W = 52;
  var PX_H = 56;
  var THRESHOLD = 85;

  var STORAGE_KEY = 'portfolio-terminal-seen';

  function isReloadNavigation() {
    var nav = performance.getEntriesByType('navigation')[0];
    return nav && nav.type === 'reload';
  }

  function releasePage() {
    document.documentElement.classList.remove('terminal-entry-active');
    document.dispatchEvent(new CustomEvent('portfolio-terminal-entry-done'));
  }

  var isReload = isReloadNavigation();

  try {
    if (localStorage.getItem(STORAGE_KEY) && !isReload) {
      releasePage();
      return;
    }
  } catch (e) { /* proceed with entry if storage unavailable */ }

  var PIXEL_ROWS = window.PORTFOLIO_TERMINAL_PIXEL_ROWS;
  if (!PIXEL_ROWS || !PIXEL_ROWS.length) {
    releasePage();
    return;
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CORNER_OPEN_DELAY = reducedMotion ? 80 : 300;
  var PIXEL_REVEAL_DELAY = reducedMotion ? 0 : 300;
  var PIXEL_ROW_INTERVAL = 25;
  var CANVAS_EXIT_MS = reducedMotion ? 200 : 1200;

  function scaleDelay(ms) {
    return reducedMotion ? Math.min(ms, 120) : ms;
  }

  var overlay = document.getElementById('terminal-entry-overlay');
  if (!overlay) {
    releasePage();
    return;
  }

  var sceneEl = overlay.querySelector('[data-terminal-scene]');
  var canvasEl = overlay.querySelector('[data-terminal-canvas]');
  var cornerEls = overlay.querySelectorAll('[data-terminal-corner]');
  var contentEl = overlay.querySelector('[data-terminal-content]');
  var titleAccessEl = overlay.querySelector('[data-title-access]');
  var titleRequiredEl = overlay.querySelector('[data-title-required]');
  var subtitleEl = overlay.querySelector('[data-subtitle]');
  var cardEl = overlay.querySelector('[data-terminal-card]');
  var typedEl = overlay.querySelector('[data-terminal-typed]');
  var ghostEl = overlay.querySelector('[data-terminal-ghost]');
  var cursorEl = overlay.querySelector('[data-terminal-cursor]');
  var enterKeyEl = overlay.querySelector('[data-terminal-enter-key]');
  var enterHintEl = overlay.querySelector('[data-terminal-enter-hint]');
  var inputEl = overlay.querySelector('[data-terminal-input]');
  var welcomeEl = overlay.querySelector('[data-terminal-welcome]');
  var welcomeNameEl = overlay.querySelector('[data-welcome-name]');

  var phase = 'boot';
  var typed = '';
  var savedName = '';
  var bootStep = 0;
  var revealedRows = 0;
  var glitch = false;
  var timers = [];
  var ghostIndex = 0;
  var ghostChar = 0;
  var ghostDir = 1;
  var ghostTimeout = null;
  var ghostRunning = false;
  var cursorTimer = null;
  var revealTimer = null;
  var ctx = null;

  overlay.classList.remove('is-hidden');
  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');

  function addTimer(fn, delay) {
    var id = window.setTimeout(fn, scaleDelay(delay));
    timers.push(id);
    return id;
  }

  function clearAllTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    if (cursorTimer) clearInterval(cursorTimer);
    if (revealTimer) clearInterval(revealTimer);
    if (ghostTimeout) clearTimeout(ghostTimeout);
  }

  /** Horizontal luminous gradient (matches terminal title / REQUIRED sample). */
  var GRAD_STOPS = [
    { p: 0, r: 143, g: 91, b: 255 },
    { p: 0.18, r: 167, g: 139, b: 250 },
    { p: 0.38, r: 208, g: 102, b: 255 },
    { p: 0.55, r: 236, g: 120, b: 200 },
    { p: 0.72, r: 251, g: 146, b: 120 },
    { p: 0.88, r: 245, g: 158, b: 11 },
    { p: 1, r: 251, g: 151, b: 24 },
  ];
  var WARM_PEACH = { r: 253, g: 164, b: 110 };
  var ALPHA_CAP = 0.62;

  function clampByte(n) {
    return n < 0 ? 0 : n > 255 ? 255 : Math.round(n);
  }

  function sampleGradX(xNorm) {
    var t = xNorm < 0 ? 0 : xNorm > 1 ? 1 : xNorm;
    var i = 0;
    while (i < GRAD_STOPS.length - 1 && GRAD_STOPS[i + 1].p < t) i += 1;
    var a = GRAD_STOPS[i];
    var b = GRAD_STOPS[Math.min(i + 1, GRAD_STOPS.length - 1)];
    var span = b.p - a.p || 1;
    var u = (t - a.p) / span;
    return {
      r: a.r + (b.r - a.r) * u,
      g: a.g + (b.g - a.g) * u,
      b: a.b + (b.b - a.b) * u,
    };
  }

  function boostSat(rgb, amount) {
    var lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    return {
      r: clampByte(lum + (rgb.r - lum) * amount),
      g: clampByte(lum + (rgb.g - lum) * amount),
      b: clampByte(lum + (rgb.b - lum) * amount),
    };
  }

  function blendRgb(a, b, w) {
    return {
      r: clampByte(a.r + (b.r - a.r) * w),
      g: clampByte(a.g + (b.g - a.g) * w),
      b: clampByte(a.b + (b.b - a.b) * w),
    };
  }

  function drawCanvas(rows) {
    if (!canvasEl || !ctx) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (canvasEl.width !== vw || canvasEl.height !== vh) {
      canvasEl.width = vw;
      canvasEl.height = vh;
    }
    ctx.clearRect(0, 0, vw, vh);
    var cell = vh / PX_H;
    var r = cell * 0.42;
    var offsetX = (vw - PX_W * cell) / 2;
    var offsetY = (vh - PX_H * cell) / 2;
    var count = Math.min(rows, PX_H);
    var startRow = PX_H - count;
    var xDenom = PX_W > 1 ? PX_W - 1 : 1;
    for (var y = startRow; y < PX_H; y++) {
      var row = PIXEL_ROWS[y];
      for (var x = 0; x < PX_W; x++) {
        var v = row[x];
        if (v <= THRESHOLD) continue;
        var glow = (v - THRESHOLD) / 140;
        var alpha = Math.min(ALPHA_CAP, glow * ALPHA_CAP);
        var xNorm = x / xDenom;
        var rgb = sampleGradX(xNorm);
        var isWarm = v > 100 && v < 170;
        if (isWarm) {
          var warmW = Math.min(1, (v - 100) / 70) * 0.55;
          rgb = blendRgb(rgb, WARM_PEACH, warmW);
        }
        rgb = boostSat(rgb, isWarm ? 1.18 : 1.14);
        ctx.fillStyle =
          'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
        ctx.beginPath();
        ctx.arc(
          offsetX + x * cell + cell / 2,
          offsetY + y * cell + cell / 2,
          r,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  function initCanvas() {
    if (!canvasEl) return;
    ctx = canvasEl.getContext('2d');
    drawCanvas(revealedRows);
    window.addEventListener('resize', onResize);
  }

  function onResize() {
    drawCanvas(phase === 'entered' ? PX_H : revealedRows);
  }

  function setBootStep(step) {
    bootStep = step;
    if (titleAccessEl) titleAccessEl.classList.toggle('is-visible', step >= 2);
    if (titleRequiredEl) titleRequiredEl.classList.toggle('is-visible', step >= 3);
    if (subtitleEl) subtitleEl.classList.toggle('is-visible', step >= 4);
    if (cardEl) cardEl.classList.toggle('is-visible', phase === 'input');
  }

  function startPixelReveal() {
    if (reducedMotion) {
      revealedRows = PX_H;
      drawCanvas(PX_H);
      return;
    }
    revealedRows = 0;
    drawCanvas(0);
    revealTimer = setInterval(function () {
      revealedRows += 1;
      drawCanvas(revealedRows);
      if (revealedRows >= PX_H) clearInterval(revealTimer);
    }, PIXEL_ROW_INTERVAL);
  }

  function startGlitch() {
    if (reducedMotion || !titleAccessEl) return;
    var f = 0;
    var fi = setInterval(function () {
      glitch = !glitch;
      titleAccessEl.classList.toggle('is-glitch', glitch && bootStep >= 2);
      if (glitch && bootStep >= 2) {
        titleAccessEl.style.transform =
          'translate(' + (Math.random() - 0.5) * 10 + 'px, 0)';
      } else if (bootStep >= 2) {
        titleAccessEl.style.transform = 'translateY(0)';
      }
      f += 1;
      if (f > 7) {
        clearInterval(fi);
        glitch = false;
        titleAccessEl.classList.remove('is-glitch');
        titleAccessEl.style.transform = bootStep >= 2 ? 'translateY(0)' : '';
      }
    }, 65);
  }

  function openCorners() {
    cornerEls.forEach(function (el) {
      el.classList.add('is-open');
    });
  }

  var BOOT_STEP_DELAYS = [200, 450, 650, 850, 1050];
  var BOOT_INPUT_DELAY = 1200;
  var BOOT_GLITCH_DELAY = 380;

  function startBoot() {
    addTimer(openCorners, CORNER_OPEN_DELAY);
    addTimer(startPixelReveal, PIXEL_REVEAL_DELAY);
    addTimer(startGlitch, BOOT_GLITCH_DELAY);
    BOOT_STEP_DELAYS.forEach(function (t, i) {
      addTimer(function () {
        setBootStep(i + 1);
      }, t);
    });
    addTimer(function () {
      phase = 'input';
      setBootStep(bootStep);
      if (cardEl) cardEl.classList.add('is-visible');
      if (inputEl) inputEl.focus();
      startGhostText();
    }, BOOT_INPUT_DELAY);
  }

  function startCursorBlink() {
    if (reducedMotion) {
      if (cursorEl) cursorEl.classList.remove('is-off');
      return;
    }
    var on = true;
    cursorTimer = setInterval(function () {
      if (phase !== 'input' || !cursorEl) return;
      on = !on;
      cursorEl.classList.toggle('is-off', !on);
    }, 530);
  }

  function startGhostText() {
    if (reducedMotion || phase !== 'input' || typed.length > 0 || ghostRunning) return;
    ghostRunning = true;

    function animate() {
      if (phase !== 'input' || typed.length > 0) {
        ghostRunning = false;
        return;
      }
      var cur = GHOST_TEXTS[ghostIndex];
      if (ghostDir === 1) {
        if (ghostChar < cur.length) {
          ghostChar += 1;
          if (ghostEl) {
            ghostEl.textContent = cur.slice(0, ghostChar);
            ghostEl.hidden = false;
          }
          ghostTimeout = setTimeout(animate, 90 + Math.random() * 40);
        } else {
          ghostTimeout = setTimeout(function () {
            ghostDir = -1;
            animate();
          }, 1800);
        }
      } else if (ghostChar > 0) {
        ghostChar -= 1;
        if (ghostEl) ghostEl.textContent = cur.slice(0, ghostChar);
        ghostTimeout = setTimeout(animate, 50);
      } else {
        ghostIndex = (ghostIndex + 1) % GHOST_TEXTS.length;
        ghostDir = 1;
        if (ghostEl) ghostEl.hidden = true;
        ghostTimeout = setTimeout(animate, 600);
      }
    }

    ghostTimeout = setTimeout(animate, 800);
  }

  function updateEnterHint() {
    var hasText = typed.trim().length > 0;
    if (enterKeyEl) enterKeyEl.classList.toggle('is-active', hasText);
    if (enterHintEl) enterHintEl.classList.toggle('is-dim', !hasText);
  }

  function hideGhost() {
    if (ghostTimeout) clearTimeout(ghostTimeout);
    ghostRunning = false;
    if (ghostEl) {
      ghostEl.textContent = '';
      ghostEl.hidden = true;
    }
  }

  function startCanvasExit() {
    if (canvasEl) canvasEl.classList.add('is-exiting');
  }

  function showEntered() {
    phase = 'entered';
    revealedRows = PX_H;
    drawCanvas(PX_H);

    if (contentEl) contentEl.hidden = true;
    if (welcomeEl) welcomeEl.hidden = false;
    if (welcomeNameEl) welcomeNameEl.textContent = savedName.toUpperCase();

    cornerEls.forEach(function (el) {
      el.style.opacity = '0';
    });

    startCanvasExit();

    if (inputEl) inputEl.blur();
  }

  function finishEntry() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (e) { /* ignore quota / private mode */ }
    releasePage();
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('hidden', '');

    addTimer(function () {
      clearAllTimers();
      window.removeEventListener('resize', onResize);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, reducedMotion ? 200 : 400);
  }

  function beginExit() {
    if (phase === 'exiting' || phase === 'entered') return;
    phase = 'exiting';
    hideGhost();
    if (inputEl) inputEl.blur();
    if (contentEl) contentEl.classList.add('is-fading');

    var enteredDelay = reducedMotion ? 150 : 900;
    var welcomeHold = reducedMotion ? 400 : 1800;
    var overlayFade = reducedMotion ? 250 : CANVAS_EXIT_MS;

    addTimer(showEntered, enteredDelay);
    addTimer(function () {
      if (welcomeEl) welcomeEl.classList.add('is-fading');
      overlay.classList.add('is-exiting');
    }, enteredDelay + welcomeHold);
    addTimer(finishEntry, enteredDelay + welcomeHold + overlayFade);
  }

  function onInput(e) {
    if (phase !== 'input') return;
    typed = e.target.value;
    if (typedEl) typedEl.textContent = typed;
    updateEnterHint();
    if (typed.length > 0) hideGhost();
    else if (phase === 'input' && !ghostRunning) startGhostText();
  }

  function onKeyDown(e) {
    if (phase !== 'input') return;
    if (e.key === 'Enter' && typed.trim().length > 0) {
      e.preventDefault();
      savedName = typed.trim();
      beginExit();
    }
  }

  overlay.addEventListener('click', function () {
    if (phase === 'input' && inputEl) inputEl.focus();
  });

  if (inputEl) {
    inputEl.addEventListener('input', onInput);
    inputEl.addEventListener('keydown', onKeyDown);
  }

  initCanvas();
  startCursorBlink();
  startBoot();
})();
