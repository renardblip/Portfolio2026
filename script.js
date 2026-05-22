/* ── Nav cursor border — follows hovered link ───────────────────── */
(function () {
  const navbar  = document.querySelector('.navbar');
  const border  = document.querySelector('.nav-cursor-border');
  const links   = document.querySelectorAll('.nav-links a');
  const PAD_X   = 18;
  const PAD_Y   = 10;
  let isVisible = false;

  function moveTo(el, instant) {
    const navRect = navbar.getBoundingClientRect();
    const elRect  = el.getBoundingClientRect();

    const left   = elRect.left   - navRect.left  - PAD_X;
    const top    = elRect.top    - navRect.top    - PAD_Y;
    const width  = elRect.width  + PAD_X * 2;
    const height = elRect.height + PAD_Y * 2;

    if (instant) {
      // teleport without animation on first appearance
      border.style.transition = 'none';
      border.style.left   = left   + 'px';
      border.style.top    = top    + 'px';
      border.style.width  = width  + 'px';
      border.style.height = height + 'px';
      // force reflow so the next frame picks up the new position
      border.getBoundingClientRect();
      border.style.transition = '';
    } else {
      border.style.left   = left   + 'px';
      border.style.top    = top    + 'px';
      border.style.width  = width  + 'px';
      border.style.height = height + 'px';
    }

    border.style.opacity = '1';
  }

  links.forEach(link => {
    link.addEventListener('mouseenter', () => {
      moveTo(link, !isVisible);
      isVisible = true;
    });
  });

  navbar.addEventListener('nav-magnetic-sync', (e) => {
    const link = e.target && e.target.closest ? e.target.closest('.nav-links a') : null;
    if (link && isVisible) moveTo(link);
  });

  navbar.addEventListener('mouseleave', () => {
    border.style.opacity = '0';
    isVisible = false;
  });
})();

/* ── WORKS galéria — scrub Show Reel → portfolio; kézi mód, ha .portfolio-works-layout alja eléri a nézet alját ─ */
function initPortfolioWorksGallery() {
  const reel = document.getElementById('show-reel');
  const portfolio = document.getElementById('works-gallery');
  const worksLayout = portfolio ? portfolio.querySelector('.portfolio-works-layout') : null;
  const track = document.getElementById('works-track');
  const scroller = document.getElementById('works-scroller');
  if (!reel || !portfolio || !track || !scroller) return;
  if (!track.querySelector('.work-card')) return;

  let maxTx = 0;
  let scrubD = 1;
  let manualTx = 0;
  let galleryManualLock = false;
  const WORKS_FINISH_SCROLL_D = 420;
  const WORKS_END_THRESHOLD_PX = 4;
  let rafId = 0;
  let manualAnimToken = 0;
  let manualAnimating = false;

  function measureAll() {
    updateMeasures();
    updateScrubDistance();
    requestAnimationFrame(() => {
      applyTransform();
    });
  }

  if (track.dataset.galleryInit === '1') {
    measureAll();
    return;
  }
  track.dataset.galleryInit = '1';
  track.removeAttribute('aria-busy');

  const mqMobile = window.matchMedia('(max-width: 768px)');
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function cancelManualAnimation() {
    manualAnimToken++;
    manualAnimating = false;
  }

  function readTxFromCss() {
    const raw = getComputedStyle(track).getPropertyValue('--works-tx').trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : manualTx;
  }

  function cardStridePx() {
    const card = track.querySelector('.work-card');
    const gap = parseFloat(getComputedStyle(track).gap) || 20;
    return card ? card.offsetWidth + gap : 0;
  }

  /** Következő / előző kártya pozíciója (egyesével), cur = jelenlegi translate */
  function txOneCardNext(cur) {
    const stride = cardStridePx();
    if (!stride || !maxTx) return clamp(cur, 0, maxTx);
    const eps = 1;
    const i = Math.floor((cur + eps) / stride);
    return clamp((i + 1) * stride, 0, maxTx);
  }

  function txOneCardPrev(cur) {
    const stride = cardStridePx();
    if (!stride || !maxTx) return clamp(cur, 0, maxTx);
    const eps = 1;
    const i = Math.ceil((cur - eps) / stride);
    return clamp((i - 1) * stride, 0, maxTx);
  }

  function smoothToTx(targetTx, durationMs) {
    const dur = durationMs == null ? 480 : durationMs;
    if (mqReduce.matches) {
      cancelManualAnimation();
      manualTx = clamp(targetTx, 0, maxTx);
      track.style.setProperty('--works-tx', `${manualTx}px`);
      return;
    }
    const from = readTxFromCss();
    const to = clamp(targetTx, 0, maxTx);
    if (Math.abs(to - from) < 0.5) {
      cancelManualAnimation();
      manualTx = to;
      track.style.setProperty('--works-tx', `${manualTx}px`);
      return;
    }
    cancelManualAnimation();
    manualAnimating = true;
    manualAnimToken++;
    const token = manualAnimToken;
    const t0 = performance.now();
    function easeOutCubic(t) {
      return 1 - (1 - t) ** 3;
    }
    function step(now) {
      if (token !== manualAnimToken) return;
      const elapsed = now - t0;
      const u = Math.min(1, elapsed / dur);
      const v = from + (to - from) * easeOutCubic(u);
      track.style.setProperty('--works-tx', `${v}px`);
      if (u < 1) {
        requestAnimationFrame(step);
      } else {
        manualAnimating = false;
        manualTx = to;
        track.style.setProperty('--works-tx', `${manualTx}px`);
      }
    }
    requestAnimationFrame(step);
  }

  function worksScrollViewportWidth() {
    const s = getComputedStyle(scroller);
    const padL = parseFloat(s.paddingLeft) || 0;
    const padR = parseFloat(s.paddingRight) || 0;
    const rectW = scroller.getBoundingClientRect().width;
    const w = rectW > 0 ? rectW : scroller.clientWidth;
    return Math.max(0, w - padL - padR);
  }

  function updateMeasures() {
    const viewW = worksScrollViewportWidth();
    const cards = track.querySelectorAll('.work-card:not([hidden])');
    const last = cards[cards.length - 1];
    if (!last || viewW <= 0) {
      maxTx = 0;
      return;
    }
    const ts = getComputedStyle(track);
    const endPad =
      parseFloat(ts.paddingInlineEnd) || parseFloat(ts.paddingRight) || 0;
    const lastRight = last.offsetLeft + last.offsetWidth;
    const fromLast = Math.max(0, lastRight + endPad - viewW);
    const fromScroll = Math.max(0, track.scrollWidth - viewW);
    maxTx = Math.ceil(Math.max(fromScroll, fromLast));
  }

  /** Works layout alja elérte / átlépte a nézet alját */
  function worksFinishZoneActive() {
    if (!worksLayout) return scrubProgress() >= 1 - 0.002;
    return (
      worksLayout.getBoundingClientRect().bottom <=
      window.innerHeight + WORKS_END_THRESHOLD_PX
    );
  }

  /** 0 → works bottom at viewport; 1 → scrolled WORKS_FINISH_SCROLL_D px past that */
  function worksFinishZoneProgress() {
    if (!worksLayout) return clamp(scrubProgress(), 0, 1);
    const bottom = worksLayout.getBoundingClientRect().bottom;
    const overscroll =
      window.innerHeight + WORKS_END_THRESHOLD_PX - bottom;
    if (overscroll <= 0) return 0;
    return clamp(overscroll / WORKS_FINISH_SCROLL_D, 0, 1);
  }

  /** Scrub p*maxTx, then finish zone: scroll-lerp toward maxTx */
  function scrubTranslateX() {
    const reelTop = reel.getBoundingClientRect().top;
    const p = clamp(-reelTop / scrubD, 0, 1);
    const scrubTx = p * maxTx;
    if (!worksFinishZoneActive()) return scrubTx;
    const fp = worksFinishZoneProgress();
    return scrubTx + (maxTx - scrubTx) * fp;
  }

  function updateScrubDistance() {
    scrubD = Math.max(1, portfolio.offsetTop - reel.offsetTop);
  }

  function scrubProgress() {
    const reelTop = reel.getBoundingClientRect().top;
    if (reelTop > 0) return 0;
    return clamp(-reelTop / scrubD, 0, 1);
  }

  /** Manual gallery (arrows / card tap): after scrub completes or layout fits in view */
  function isInteractiveDesktop() {
    if (mqMobile.matches) return false;
    const reelTop = reel.getBoundingClientRect().top;
    if (reelTop > 0) return false;
    if (galleryManualLock) return true;
    if (scrubProgress() >= 1 - 0.002) return true;
    if (!worksLayout) return true;
    return worksLayout.getBoundingClientRect().bottom <= window.innerHeight + 4;
  }

  function applyTransform() {
    if (mqReduce.matches) {
      track.style.setProperty('--works-tx', '0px');
      return;
    }
    if (mqMobile.matches) {
      track.style.removeProperty('--works-tx');
      return;
    }

    const reelTop = reel.getBoundingClientRect().top;

    if (reelTop > 0) {
      galleryManualLock = false;
      cancelManualAnimation();
      manualTx = 0;
      track.style.setProperty('--works-tx', '0px');
      return;
    }

    if (galleryManualLock || manualAnimating) {
      if (!manualAnimating) {
        manualTx = clamp(manualTx, 0, maxTx);
        track.style.setProperty('--works-tx', `${manualTx}px`);
      }
      return;
    }

    cancelManualAnimation();
    manualTx = scrubTranslateX();
    track.style.setProperty('--works-tx', `${manualTx}px`);
  }

  function requestTick() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      applyTransform();
    });
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', measureAll, { passive: true });
  mqMobile.addEventListener('change', measureAll);
  mqReduce.addEventListener('change', measureAll);

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => measureAll());
    ro.observe(track);
    ro.observe(scroller);
    ro.observe(reel);
    ro.observe(portfolio);
    if (worksLayout) ro.observe(worksLayout);
  }

  measureAll();

  function centerCardTargetTx(card) {
    const cx = card.offsetLeft + card.offsetWidth / 2;
    const padL = parseFloat(getComputedStyle(scroller).paddingLeft) || 0;
    return clamp(cx - padL - worksScrollViewportWidth() / 2, 0, maxTx);
  }

  const prevBtns = document.querySelectorAll('[data-works-scroll="prev"]');
  const nextBtns = document.querySelectorAll('[data-works-scroll="next"]');
  function mobileStrideScroll() {
    const card = track.querySelector('.work-card');
    const gap = parseFloat(getComputedStyle(track).gap) || 20;
    const w = card ? card.getBoundingClientRect().width + gap : scroller.clientWidth * 0.75;
    const cap = maxTx > 0 ? maxTx : w;
    return Math.min(Math.max(w, 200), cap);
  }

  prevBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (mqMobile.matches) {
        scroller.scrollBy({ left: -mobileStrideScroll(), behavior: 'smooth' });
        return;
      }
      if (!isInteractiveDesktop()) return;
      galleryManualLock = true;
      const cur = readTxFromCss();
      smoothToTx(txOneCardPrev(cur));
    });
  });
  nextBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (mqMobile.matches) {
        scroller.scrollBy({ left: mobileStrideScroll(), behavior: 'smooth' });
        return;
      }
      if (!isInteractiveDesktop()) return;
      galleryManualLock = true;
      const cur = readTxFromCss();
      smoothToTx(txOneCardNext(cur));
    });
  });

  const filterBtns = document.querySelectorAll('[data-works-filter]');
  const allCards = track.querySelectorAll('.work-card[data-works-category]');

  function applyWorksFilter(category) {
    filterBtns.forEach((btn) => {
      const active = btn.getAttribute('data-works-filter') === category;
      btn.classList.toggle('works-filter-tag--active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    allCards.forEach((card) => {
      const show = card.getAttribute('data-works-category') === category;
      card.hidden = !show;
      card.tabIndex = show ? 0 : -1;
    });
    galleryManualLock = false;
    cancelManualAnimation();
    manualTx = 0;
    track.style.setProperty('--works-tx', '0px');
    measureAll();
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyWorksFilter(btn.getAttribute('data-works-filter'));
    });
  });

  scroller.addEventListener('click', (e) => {
    const link = e.target.closest('.work-card-link, .work-card-pill');
    if (link) return;
    const card = e.target.closest('.work-card');
    if (!card) return;
    if (mqMobile.matches) {
      card.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
      return;
    }
    if (!isInteractiveDesktop()) return;
    galleryManualLock = true;
    smoothToTx(centerCardTargetTx(card), 520);
  });

  scroller.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.work-card');
    if (!card || e.target.closest('.work-card-link, .work-card-pill')) return;
    const link = card.querySelector('.work-card-link, .work-card-pill');
    if (link && document.activeElement === card) {
      e.preventDefault();
      link.click();
      return;
    }
    const href = card.dataset.href;
    if (href && document.activeElement === card) {
      e.preventDefault();
      window.location.href = href;
    }
  });
}

document.addEventListener('works-content-ready', initPortfolioWorksGallery);
document.addEventListener('DOMContentLoaded', initPortfolioWorksGallery);

/* ── Hero blokk — lefelé tolódás görgetésre (térbeli hatás) ─────── */
(function () {
  const block = document.querySelector('.hero-block');
  if (!block) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const maxShift = 72;
  const factor = 0.28;

  function onScroll() {
    const y = window.scrollY || document.documentElement.scrollTop;
    const shift = Math.min(maxShift, y * factor);
    block.style.setProperty('--hero-parallax-y', `${shift}px`);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ── Hero bio — typewriter effect ─────────────────────────────────── */
(function () {
  const bio = document.querySelector('.hero-bio');
  if (!bio) return;

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mqReduce.matches) return;

  const segments = [
    { text: 'I am Reka Mateo Tóth, Hybrid Designer', tag: 'strong' },
    { br: true },
    { text: 'at the intersection of graphic brutality, generative' },
    { br: true },
    { text: 'motion, and AI-assisted workflows.' },
  ];

  const CHAR_SPEED = 36;
  const LINE_PAUSE = 300;
  const START_DELAY = 350;

  bio.innerHTML = '';
  bio.classList.add('hero-bio--typing');

  const cursor = document.createElement('span');
  cursor.className = 'hero-bio-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.textContent = '|';

  const revealQueue = [];

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    if (seg.br) {
      bio.appendChild(document.createElement('br'));
      continue;
    }

    const parent = seg.tag ? document.createElement(seg.tag) : bio;
    if (seg.tag) bio.appendChild(parent);

    for (const ch of seg.text) {
      const span = document.createElement('span');
      span.className = 'hero-bio-char';
      span.textContent = ch;
      span.setAttribute('aria-hidden', 'true');
      parent.appendChild(span);
      revealQueue.push(span);
    }

    if (segments[si + 1]?.br) {
      revealQueue.push({ linePause: true });
    }
  }

  if (revealQueue.length) {
    revealQueue[0].insertAdjacentElement('beforebegin', cursor);
  } else {
    bio.appendChild(cursor);
  }

  let i = 0;

  function revealNext() {
    if (i >= revealQueue.length) {
      cursor.classList.add('hero-bio-cursor--done');
      setTimeout(() => {
        cursor.classList.add('hero-bio-cursor--fade-out');
        setTimeout(() => cursor.remove(), 550);
      }, 900);
      bio.classList.remove('hero-bio--typing');
      return;
    }

    const item = revealQueue[i++];

    if (item.linePause) {
      setTimeout(revealNext, LINE_PAUSE);
      return;
    }

    item.classList.add('hero-bio-char--visible');
    item.removeAttribute('aria-hidden');
    item.insertAdjacentElement('afterend', cursor);

    setTimeout(revealNext, CHAR_SPEED);
  }

  setTimeout(revealNext, START_DELAY);
})();

/* ── Foldkor forgás — lassú alap, enyhe közelség-felgyorsítás a panel közepén ─ */
(function () {
  const foldkor = document.querySelector('.gp-foldkor');
  const graphicPanel = document.querySelector('.graphic-panel');
  if (!foldkor || !graphicPanel) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const SPEED_BASE  = 0.06;  // ~3.6°/s — meditatív alap
  const SPEED_HOVER = 0.55;  // ~33°/s — enyhe közelség-felgyorsítás
  const PROX_RADIUS = 0.55;  // graphic-panel méretének hányada = max hatótáv

  let angle        = 0;
  let currentSpeed = SPEED_BASE;
  let targetSpeed  = SPEED_BASE;

  foldkor.style.transformOrigin = '78.5px 78.5px';
  foldkor.style.willChange      = 'transform';

  document.addEventListener('mousemove', (e) => {
    const rect = graphicPanel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    const maxDist = Math.max(rect.width, rect.height) * PROX_RADIUS;
    const t = maxDist > 0 ? Math.max(0, 1 - dist / maxDist) : 0;
    const ease = t * t;
    targetSpeed = SPEED_BASE + (SPEED_HOVER - SPEED_BASE) * ease;
  });

  document.addEventListener('mouseleave', () => {
    targetSpeed = SPEED_BASE;
  });

  function tick() {
    currentSpeed += (targetSpeed - currentSpeed) * 0.04;

    angle += currentSpeed;
    if (angle >= 360) angle -= 360;

    foldkor.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

/* ── Graphic panel negyedek — véletlen ±90° hover (forma + gradient együtt) ─ */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const HIT_TO_Q = [
    ['.gp-hit--tl', '.gp-q--tl'],
    ['.gp-hit--tr', '.gp-q--tr'],
    ['.gp-hit--bl-pink', '.gp-q--bl-pink'],
    ['.gp-hit--bl-black', '.gp-q--bl-black'],
    ['.gp-hit--br-black', '.gp-q--br-black'],
    ['.gp-hit--br-gradient', '.gp-q--br-gradient'],
  ];

  function randomQuarterTurn() {
    return Math.random() < 0.5 ? -90 : 90;
  }

  HIT_TO_Q.forEach(([hitSel, qSel]) => {
    const hit = document.querySelector(hitSel);
    const q = document.querySelector(qSel);
    if (!hit || !q) return;

    hit.addEventListener('mouseenter', () => {
      q.style.transform = `rotate(${randomQuarterTurn()}deg)`;
    });

    hit.addEventListener('mouseleave', () => {
      q.style.transform = 'rotate(0deg)';
    });
  });
})();

/* ── SERVICE flip cards — tap to flip on touch devices ───────────── */
(function () {
  const cards = document.querySelectorAll('.service-card');
  if (!cards.length) return;

  function closeAll(except) {
    cards.forEach((c) => {
      if (c !== except) c.classList.remove('is-flipped');
    });
  }

  cards.forEach((card) => {
    const btn = card.querySelector('.service-card-flip');
    if (!btn) return;

    function toggleFlip() {
      const willOpen = !card.classList.contains('is-flipped');
      if (willOpen) closeAll(card);
      card.classList.toggle('is-flipped');
      btn.setAttribute('aria-expanded', card.classList.contains('is-flipped'));
    }

    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', toggleFlip);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFlip();
      }
    });
  });

  document.addEventListener('click', (e) => {
    const inside = e.target && e.target.closest
      ? e.target.closest('.service-card')
      : null;
    if (!inside) closeAll();
  });
})();

/* ── SERVICE cards — scroll reveal (vertical slide-in) ───────────── */
(function () {
  const cards = Array.from(document.querySelectorAll('.service-card'));
  if (!cards.length) return;

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mqReduce.matches) {
    cards.forEach((card) => card.classList.add('is-revealed'));
    return;
  }

  const STAGGER_MS = 90;
  cards.forEach((card, i) => {
    card.style.setProperty('--service-reveal-delay', `${i * STAGGER_MS}ms`);
  });

  if (typeof IntersectionObserver === 'undefined') {
    cards.forEach((card) => card.classList.add('is-revealed'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-revealed', entry.isIntersecting);
      });
    },
    {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -6% 0px',
    }
  );

  cards.forEach((card) => io.observe(card));
})();

/* ── Footer — text + left deco reveal (synchronized, slow fade) ── */
(function () {
  const textCol = document.querySelector('.site-footer__col--text');
  const img = document.querySelector('.site-footer__img--left');
  if (!textCol || !img) return;

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TEXT_OFFSET_Y = 50;
  const REVEAL_THRESHOLD = 0.35;
  const ROOT_MARGIN = '0px 0px -6% 0px';

  function getMaxShift() {
    const vh = window.innerHeight;
    return Math.round(Math.min(180, Math.max(120, vh * 0.13)));
  }

  function clearRevealVars() {
    textCol.style.removeProperty('--footer-reveal-opacity');
    textCol.style.removeProperty('--footer-text-y');
    img.style.removeProperty('--footer-reveal-opacity');
    img.style.removeProperty('--footer-left-x');
    textCol.classList.remove('footer-content-revealing', 'footer-content-revealed');
  }

  function setRevealProgress(p) {
    const clamped = Math.min(1, Math.max(0, p));
    const opacity = String(clamped);
    const textY = `${-TEXT_OFFSET_Y * (1 - clamped)}px`;
    const leftX = `${-getMaxShift() * (1 - clamped)}px`;

    textCol.style.setProperty('--footer-reveal-opacity', opacity);
    textCol.style.setProperty('--footer-text-y', textY);
    img.style.setProperty('--footer-reveal-opacity', opacity);
    img.style.setProperty('--footer-left-x', leftX);

    textCol.classList.toggle('footer-content-revealing', clamped > 0 && clamped < 1);
    textCol.classList.toggle('footer-content-revealed', clamped >= 1);
  }

  if (mqReduce.matches) {
    clearRevealVars();
    return;
  }

  function applyFromEntry(entry) {
    const ratio = entry.intersectionRatio;
    const intersecting = entry.isIntersecting;
    const p = intersecting ? Math.min(1, ratio / REVEAL_THRESHOLD) : 0;
    setRevealProgress(p);
  }

  if (typeof IntersectionObserver === 'undefined') {
    setRevealProgress(1);
    return;
  }

  const thresholds = [0];
  for (let i = 1; i <= 28; i++) {
    thresholds.push((i / 28) * REVEAL_THRESHOLD);
  }
  thresholds.push(REVEAL_THRESHOLD, 0.5, 0.75, 1);

  const io = new IntersectionObserver(
    (entries) => entries.forEach(applyFromEntry),
    { root: null, threshold: thresholds, rootMargin: ROOT_MARGIN }
  );

  setRevealProgress(0);
  io.observe(textCol);

  mqReduce.addEventListener('change', () => {
    if (mqReduce.matches) {
      io.disconnect();
      clearRevealVars();
    } else {
      setRevealProgress(0);
      io.observe(textCol);
    }
  });
})();

/* ── Section titles — scramble reveal on enter viewport (replayable) ─ */
(function () {
  const selector =
    '#work-heading, #works-heading, #service-heading, #skills-heading, #skills .work-title, .site-footer__eyebrow, .site-footer__meta-value a[href^="mailto:"]';
  const seen = new Set();
  const titles = Array.from(document.querySelectorAll(selector)).filter((el) => {
    if (seen.has(el)) return false;
    seen.add(el);
    return true;
  });
  if (!titles.length) return;

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mqReduce.matches) return;

  const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const SCRAMBLE_MS = 40;
  const SCRAMBLE_STEP = 0.5;
  const timers = new Map();

  function getTarget(el) {
    if (!el.dataset.scrambleText) {
      el.dataset.scrambleText = el.textContent;
    }
    return el.dataset.scrambleText;
  }

  function stopScramble(el) {
    const id = timers.get(el);
    if (id == null) return;
    clearInterval(id);
    timers.delete(el);
  }

  function resetTitle(el) {
    stopScramble(el);
    el.textContent = getTarget(el);
  }

  function scrambleReveal(el) {
    stopScramble(el);
    const target = getTarget(el);
    let iter = 0;
    const interval = setInterval(() => {
      el.textContent = target
        .split('')
        .map((ch, i) => {
          if (ch === ' ') return ch;
          if (i < iter) return ch;
          return SCRAMBLE_CHARS[
            Math.floor(Math.random() * SCRAMBLE_CHARS.length)
          ];
        })
        .join('');
      if (iter >= target.length) {
        stopScramble(el);
        el.textContent = target;
      }
      iter += SCRAMBLE_STEP;
    }, SCRAMBLE_MS);
    timers.set(el, interval);
  }

  titles.forEach((el) => getTarget(el));

  if (typeof IntersectionObserver === 'undefined') return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (entry.isIntersecting) {
          scrambleReveal(el);
        } else {
          resetTitle(el);
        }
      });
    },
    {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -6% 0px',
    }
  );

  titles.forEach((el) => io.observe(el));
})();

/* ── Magnetic micro-interaction — service flip buttons + nav links ─ */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  const MAG_FACTOR = 0.25;
  const PROXIMITY = 0.72;

  const targets = [
    ...document.querySelectorAll('#service .service-card-flip'),
    ...document.querySelectorAll('.nav-links a'),
  ];
  if (!targets.length) return;

  function setMag(el, x, y) {
    el.style.setProperty('--mag-x', `${x}px`);
    el.style.setProperty('--mag-y', `${y}px`);
  }

  function resetMag(el) {
    setMag(el, 0, 0);
  }

  function onMove(e) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const relX = e.clientX - cx;
    const relY = e.clientY - cy;
    const maxR = Math.hypot(rect.width, rect.height) * PROXIMITY;

    if (Math.hypot(relX, relY) > maxR) {
      resetMag(el);
      if (el.matches('.nav-links a')) {
        el.dispatchEvent(new CustomEvent('nav-magnetic-sync', { bubbles: true }));
      }
      return;
    }

    setMag(el, relX * MAG_FACTOR, relY * MAG_FACTOR);

    if (el.matches('.nav-links a')) {
      el.dispatchEvent(new CustomEvent('nav-magnetic-sync', { bubbles: true }));
    }
  }

  targets.forEach((el) => {
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', () => resetMag(el));
  });
})();
