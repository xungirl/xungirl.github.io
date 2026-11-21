/*
 * page.js: product-page behavior only (local nav menu, scroll reveals, the "how the score is built"
 * sticky sequence). No scoring here; the demo lives in app.js / explain.js / flowbeat-core.js.
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasIO = 'IntersectionObserver' in window;

  // ------------------------------------------------------------------ local nav (phone: chevron menu)
  const toggle = $('#lnToggle'), menu = $('#lnMenu');
  if (toggle && menu) {
    const set = (open) => { menu.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => set(!menu.classList.contains('open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  // ------------------------------------------------------------------ scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  if (!hasIO || reduce.matches) reveals.forEach((el) => el.classList.add('in'));
  else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  // ------------------------------------------------------------------ gallery arrows
  const gallery = $('.gallery');
  const gnav = document.querySelectorAll('.gnav');
  if (gallery && gnav.length) {
    const update = () => {
      const max = gallery.scrollWidth - gallery.clientWidth - 2;
      gnav.forEach((b) => { b.disabled = +b.dataset.dir < 0 ? gallery.scrollLeft <= 2 : gallery.scrollLeft >= max; });
    };
    gnav.forEach((b) => b.addEventListener('click', () => {
      gallery.scrollBy({ left: +b.dataset.dir * Math.max(240, gallery.clientWidth * 0.7), behavior: reduce.matches ? 'auto' : 'smooth' });
    }));
    gallery.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // ------------------------------------------------------------------ sticky sequence
  // Example numbers use the real constants (FocusScorer.swift): baseline 70 bpm; 0.085 g -> motion penalty
  // (0.085 - 0.02) / 0.13 * 60 = 30; 81 bpm -> (81 - 70 - 5) / 15 * 40 = 16; raw = 54; smoothing from 82 with
  // alpha 0.2 -> 82 + 0.2 * (54 - 82) = 76.4.
  const STEPS = [
    { p: 0, a: '#8E8E93', b: '#8E8E93', big: 71, small: 'BPM', f: '71 bpm, 0.012 g · motion at 25 Hz → 10 s mean' },
    { p: 100, a: '#FFFFFF', b: '#8E8E93', big: 70, small: 'Baseline, bpm', f: 'baseline = median(HR, first 60 s)' },
    { p: 54, a: '#FFD60A', b: '#FF9F0A', big: 54, small: 'Raw score', f: '0.085 g, 81 bpm: 100 − 30 − 16 = 54' },
    { p: 76.4, a: '#00F5EA', b: '#5AC8FA', big: 76, small: 'In flow', f: 'shown = 82 + 0.2 × (54 − 82) = 76.4' },
    { p: 100, a: '#5AC8FA', b: '#0A84FF', big: 'Away', small: 'Resumes when you sit', f: 'walking → paused, then 60 s with no HR penalty' },
    { p: 35, a: '#FF9F0A', b: '#FF375F', big: 35, small: 'Off track', f: '3 min under 40 → one tap, at most every 10 min' },
  ];
  const viz = $('#viz'), big = $('#vizBig'), small = $('#vizSmall'), formula = $('#vizFormula');
  const steps = Array.from(document.querySelectorAll('.step'));
  let current = -1, shownBig = 71, raf = null;

  function countTo(target) {
    cancelAnimationFrame(raf);
    if (typeof target !== 'number' || typeof shownBig !== 'number' || reduce.matches) {
      big.textContent = String(target); shownBig = target; return;
    }
    const from = shownBig, t0 = performance.now(), dur = 700;
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      big.textContent = String(Math.round(from + (target - from) * e));
      if (k < 1) raf = requestAnimationFrame(frame); else shownBig = target;
    };
    raf = requestAnimationFrame(frame);
  }
  function activate(i) {
    if (!viz || i === current || !STEPS[i]) return;
    current = i;
    const st = STEPS[i];
    steps.forEach((el, j) => el.classList.toggle('active', j === i));
    viz.dataset.step = String(i);
    viz.style.setProperty('--a', st.a); viz.style.setProperty('--b', st.b); viz.style.setProperty('--p', String(st.p));
    if (st.p === 0) viz.setAttribute('data-empty', ''); else viz.removeAttribute('data-empty');
    countTo(st.big);
    small.textContent = st.small;
    formula.textContent = st.f;
  }
  if (viz && steps.length) {
    activate(0);
    if (hasIO) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) activate(+e.target.dataset.step); });
      }, { rootMargin: '-48% 0px -48% 0px' });
      steps.forEach((el) => io.observe(el));
    } else steps.forEach((el) => el.classList.add('active'));
  }
})();
