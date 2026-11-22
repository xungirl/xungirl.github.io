// living-paper: drives the animations of one page. No network, no libraries.
// The page holds <script type="application/json" id="paper-anim"> with the Fig. 1 sequence and the Fig. 2 vizzes.
// Numbers in <span class="n" data-to="..."> (stats, table cells, bar labels) count up and always end on their exact text.
// Everything runs only while it is on screen and replays when it scrolls back in.
// prefers-reduced-motion: final states, nothing moves.
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const A = JSON.parse(document.getElementById('paper-anim').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const easeOut = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
  const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

  // A loop that can be (re)started and stopped: start() bumps a generation, the old loop sees alive() turn false.
  function runner(loop) {
    let gen = 0;
    return { start() { const g = ++gen; loop(() => g === gen); }, stop() { gen++; } };
  }
  // Call onIn / onOut as an element enters / leaves the viewport.
  function watch(el, onIn, onOut, opts) {
    if (!hasIO) { onIn(); return; }
    let inside = false;
    new IntersectionObserver((es) => es.forEach((e) => {
      if (!inside && e.isIntersecting && e.intersectionRatio >= ((opts && opts.min) || 0)) { inside = true; onIn(); }
      else if (inside && !e.isIntersecting) { inside = false; if (onOut) onOut(); }
    }), { threshold: (opts && opts.threshold) || [0, 0.25], rootMargin: (opts && opts.margin) || '0px' }).observe(el);
  }

  // ---------- nav: phone menu, current section, reading progress ----------
  const toggle = $('#lnToggle'), menu = $('#lnMenu');
  if (toggle && menu) {
    const set = (open) => { menu.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => set(!menu.classList.contains('open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }
  const bar = $('.progress i');
  const navLinks = $$('.ln-menu a');
  const targets = navLinks.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const h = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
      let cur = -1;
      targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top < innerHeight * 0.4) cur = i; });
      navLinks.forEach((a, i) => a.classList.toggle('cur', i === cur));
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  // ---------- scroll reveal ----------
  const reveals = $$('.reveal');
  if (!hasIO || reduce) reveals.forEach((el) => el.classList.add('in'));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  // ---------- Fig. 1 edges: straight lines between box sides, drawn after layout ----------
  const arch = $('.arch');
  const svg = arch && $('svg.edges', arch);
  function drawEdges() {
    if (!arch) return;
    svg.innerHTML = '';
    if (getComputedStyle(svg).display === 'none') return;  // phones: boxes stack, no edges
    const base = arch.getBoundingClientRect();
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7c8088"/></marker>'
      + '<marker id="ahh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c2512f"/></marker>';
    svg.appendChild(defs);
    for (const e of A.edges || []) {
      const a = $(`[data-node="${e.from}"]`, arch), b = $(`[data-node="${e.to}"]`, arch);
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ca = { x: ra.left + ra.width / 2 - base.left, y: ra.top + ra.height / 2 - base.top };
      const cb = { x: rb.left + rb.width / 2 - base.left, y: rb.top + rb.height / 2 - base.top };
      // leave from the side facing the other box
      const horiz = Math.abs(ca.y - cb.y) < Math.min(ra.height, rb.height) / 2;
      let p1, p2;
      if (horiz) {
        const dir = cb.x > ca.x ? 1 : -1;
        p1 = { x: ca.x + dir * ra.width / 2, y: ca.y }; p2 = { x: cb.x - dir * rb.width / 2, y: cb.y };
      } else {
        const dir = cb.y > ca.y ? 1 : -1;
        p1 = { x: ca.x, y: ca.y + dir * ra.height / 2 }; p2 = { x: cb.x, y: cb.y - dir * rb.height / 2 };
        if (Math.abs(ca.x - cb.x) > 4 && Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 10) { p1.x = p2.x = (Math.max(ra.left, rb.left) + Math.min(ra.right, rb.right)) / 2 - base.left; }
      }
      const overlapX = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 10;
      let line;
      if (!horiz && !overlapX) { // diagonal neighbours: an elbow from the bottom (or top) of one box to the other
        const dir = cb.y > ca.y ? 1 : -1;
        p1 = { x: ca.x, y: ca.y + dir * ra.height / 2 }; p2 = { x: cb.x, y: cb.y - dir * rb.height / 2 };
        const my = (p1.y + p2.y) / 2;
        line = document.createElementNS(NS, 'path');
        line.classList.add('e');
        line.setAttribute('d', `M${p1.x},${p1.y} L${p1.x},${my} L${p2.x},${my} L${p2.x},${p2.y}`);
      } else {
        line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y); line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
      }
      if (e.dashed) line.classList.add('dash');
      line.setAttribute('marker-end', 'url(#ah)');
      if (e.both) line.setAttribute('marker-start', 'url(#ah)');
      line.dataset.edge = `${e.from}>${e.to}`;
      svg.appendChild(line);
      if (e.label) {
        const t = document.createElementNS(NS, 'text');
        const vertical = Math.abs(p1.x - p2.x) < 2;
        // beside a vertical line, above a horizontal one, so the line never runs through the text
        t.setAttribute('x', vertical ? p1.x + 8 : (p1.x + p2.x) / 2); t.setAttribute('y', (p1.y + p2.y) / 2 + (vertical ? 4 : -7));
        t.setAttribute('text-anchor', vertical ? 'start' : 'middle'); t.textContent = e.label;
        svg.appendChild(t);
      }
    }
    if (activeEdge) lightEdge(activeEdge);
  }
  let activeEdge = null;
  function findEdge(key) {  // "a>b", or the reverse of a drawn edge (then packets travel backwards)
    if (!svg) return null;
    const l = $(`[data-edge="${key}"]`, svg);
    if (l) return { line: l, back: false };
    const [f, t] = key.split('>');
    const r = $(`[data-edge="${t}>${f}"]`, svg);
    return r ? { line: r, back: true } : null;
  }
  function lightEdge(key) {
    const hit = findEdge(key);
    if (!hit) return null;
    hit.line.classList.add('pulse');
    hit.line.setAttribute('marker-end', 'url(#ahh)');
    if (hit.line.getAttribute('marker-start')) hit.line.setAttribute('marker-start', 'url(#ahh)');
    return hit;
  }
  function packets(hit) {  // three glowing dots run along the edge
    if (!hit || !hit.line.getTotalLength) return;
    const len = hit.line.getTotalLength();
    const dur = Math.max(650, Math.min(1100, len * 4));
    [0, 140, 280].forEach((delay, j) => {
      const glow = document.createElementNS(NS, 'circle'), dot = document.createElementNS(NS, 'circle');
      glow.setAttribute('r', 9 - j * 2); glow.setAttribute('class', 'pkt-glow');
      dot.setAttribute('r', 3.6 - j * 0.8); dot.setAttribute('class', 'pkt');
      const t0 = performance.now() + delay;
      const frame = (now) => {
        if (!hit.line.isConnected) { glow.remove(); dot.remove(); return; }
        const k = Math.max(0, Math.min(1, (now - t0) / dur));
        if (now >= t0 && !dot.isConnected) { svg.appendChild(glow); svg.appendChild(dot); }
        const e = easeInOut(k);
        const pt = hit.line.getPointAtLength((hit.back ? 1 - e : e) * len);
        glow.setAttribute('cx', pt.x); glow.setAttribute('cy', pt.y); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
        const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
        glow.style.opacity = 0.45 * fade; dot.style.opacity = fade;
        if (k < 1) requestAnimationFrame(frame); else { glow.remove(); dot.remove(); }
      };
      requestAnimationFrame(frame);
    });
  }
  addEventListener('resize', drawEdges);
  if (document.fonts) document.fonts.ready.then(drawEdges); else addEventListener('load', drawEdges);
  drawEdges();

  // ---------- Fig. 1 sequence ----------
  const steps = A.sequence || [];
  const dots = arch ? $$('.tk-dots i') : [];
  const tkText = $('.tk-text');
  const playBtn = $('.tk-play');
  let paused = false;
  function clearStep() {
    $$('.node', arch).forEach((n) => n.classList.remove('on'));
    $$('.node li', arch).forEach((li) => li.classList.remove('on'));
    $$('[data-edge]', svg).forEach((l) => {
      l.classList.remove('pulse');
      l.setAttribute('marker-end', 'url(#ah)');
      if (l.getAttribute('marker-start')) l.setAttribute('marker-start', 'url(#ah)');
    });
    activeEdge = null;
  }
  function resetArch() {
    clearStep();
    $$('.node li', arch).forEach((li) => li.classList.remove('ok'));
    $$('.node .foot', arch).forEach((f) => (f.textContent = f.dataset.default || ''));
    $$('.node .meter i', arch).forEach((m) => (m.style.width = m.dataset.default || m.style.width));
    dots.forEach((d) => d.classList.remove('on', 'done'));
  }
  function applyStep(k) {
    const s = steps[k];
    clearStep();
    const n = $(`[data-node="${s.node}"]`, arch);
    let what = '';
    if (n) {
      n.classList.add('on');
      const items = $$('li', n);
      if (s.item != null && items[s.item]) { items[s.item].classList.add('on'); what = items[s.item].textContent; }
      if (s.check != null && items[s.check]) { items[s.check].classList.add('ok'); what = items[s.check].textContent; }
      if (s.checkAll) items.forEach((li) => li.classList.add('ok'));
      let foot = $('.foot', n);
      if (!foot && s.note != null) { foot = document.createElement('div'); foot.className = 'foot'; foot.dataset.default = ''; n.appendChild(foot); }
      if (foot && s.note != null) { foot.textContent = s.note; foot.classList.remove('flash'); void foot.offsetWidth; foot.classList.add('flash'); }
      const m = $('.meter i', n);
      if (m && s.meter != null) m.style.width = s.meter + '%';
      if (tkText) {
        const title = $('h4', n).textContent;
        tkText.innerHTML = '';
        const b = document.createElement('b'); b.textContent = title; tkText.appendChild(b);
        if (what) tkText.appendChild(document.createTextNode(' · ' + what));
        if (s.note) { tkText.appendChild(document.createTextNode('  ')); const sp = document.createElement('span'); sp.className = 'tk-note'; sp.textContent = s.note; tkText.appendChild(sp); }
      }
    }
    if (s.edge) { activeEdge = s.edge; packets(lightEdge(s.edge)); }
    dots.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
  }
  const archRun = runner(async (alive) => {
    resetArch();
    await sleep(700);  // let the boxes arrive first
    for (let k = 0; alive(); k = (k + 1) % steps.length) {
      if (k === 0) resetArch();
      applyStep(k);
      await sleep(steps[k].ms || 1500);
      while (paused && alive()) await sleep(150);
      if (k === steps.length - 1 && alive()) { clearStep(); await sleep(1000); }
    }
  });
  if (playBtn) playBtn.addEventListener('click', () => {
    paused = !paused;
    playBtn.setAttribute('aria-pressed', String(paused));
    playBtn.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
  });

  // ---------- Fig. 2: count-up numbers and small vizzes ----------
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const vizFns = {
    grid(box, d) { // d: {filled, total}
      const total = Math.min(d.total || 100, 400), cols = total > 40 ? Math.ceil(total / 5) : Math.ceil(Math.sqrt(total * 2)), rows = Math.ceil(total / cols);
      const s = svgEl('svg', { viewBox: `0 0 ${cols * 9} ${rows * 9}` }, box); s.classList.add('v-grid');
      const cells = [];
      for (let i = 0; i < total; i++) cells.push(svgEl('rect', { x: (i % cols) * 9, y: Math.floor(i / cols) * 9, width: 7, height: 7, rx: 1.5 }, s));
      const filled = Math.round((d.filled / (d.total || 100)) * total);
      return {
        reset() { cells.forEach((c) => c.classList.remove('f')); },
        async run(alive) { for (let i = 0; i < filled && alive(); i++) { cells[i].classList.add('f'); await sleep(Math.max(10, 1100 / filled)); } },
        final() { cells.forEach((c, i) => c.classList.toggle('f', i < filled)); },
      };
    },
    drop(box, d) { // d: {from, to, unit}
      const s = svgEl('svg', { viewBox: '0 0 120 40' }, box); s.classList.add('v-drop');
      svgEl('rect', { class: 'a', x: 0, y: 6, width: 120, height: 10, rx: 2 }, s);
      const b = svgEl('rect', { class: 'b', x: 0, y: 24, width: 120, height: 10, rx: 2 }, s);
      const fmt = (v) => (typeof v === 'number' && Math.abs(v) >= 10000 ? v.toLocaleString('en-US') : v);
      const t1 = svgEl('text', { x: 0, y: 3 }, s); t1.textContent = `${fmt(d.from)}${d.unit || ''}`;
      const t2 = svgEl('text', { x: 0, y: 43 }, s); t2.textContent = `${fmt(d.to)}${d.unit || ''}`;
      const w = Math.min(120, Math.max(2, 120 * (Number(d.to) / Number(d.from))));
      return {
        reset() { b.style.transition = 'none'; b.setAttribute('width', 120); },
        async run(alive) { await sleep(350); if (!alive()) return; b.style.transition = 'width 1.3s cubic-bezier(.2,.7,.2,1)'; b.setAttribute('width', w); },
        final() { b.setAttribute('width', w); },
      };
    },
    rise(box, d) { // d: {points: [n...]}
      const pts = d.points && d.points.length > 1 ? d.points : [1, 2, 3, 5, 8];
      const max = Math.max(...pts), min = Math.min(...pts, 0);
      const s = svgEl('svg', { viewBox: '0 0 120 44' }, box); s.classList.add('v-rise');
      svgEl('line', { class: 'base', x1: 0, y1: 42, x2: 120, y2: 42 }, s);
      const xy = pts.map((v, i) => [i * (120 / (pts.length - 1)), 42 - ((v - min) / (max - min || 1)) * 38]);
      const p = svgEl('path', { d: 'M' + xy.map((q) => q.join(',')).join(' L') }, s);
      const dot = svgEl('circle', { cx: xy[xy.length - 1][0], cy: xy[xy.length - 1][1], r: 3.2 }, s);
      const len = p.getTotalLength ? p.getTotalLength() : 200;
      p.style.strokeDasharray = len;
      return {
        reset() { dot.style.opacity = 0; p.style.transition = 'none'; p.style.strokeDashoffset = len; },
        async run(alive) { await sleep(60); p.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)'; p.style.strokeDashoffset = 0; await sleep(1300); if (alive()) dot.style.opacity = 1; },
        final() { p.style.strokeDashoffset = 0; dot.style.opacity = 1; },
      };
    },
    bars(box, d) { // d: {labels: [], values: [], hi: index}
      const vals = d.values || [], n = vals.length || 1, max = Math.max(...vals, 1);
      const s = svgEl('svg', { viewBox: '0 0 120 50' }, box); s.classList.add('v-bars');
      const bw = 120 / n - 6;
      const rs = vals.map((v, i) => {
        const r = svgEl('rect', { x: i * (120 / n) + 3, y: 38, width: bw, height: 0, rx: 1.5 }, s);
        if (i === d.hi) r.classList.add('hi');
        const t = svgEl('text', { x: i * (120 / n) + 3 + bw / 2, y: 48.5, 'text-anchor': 'middle' }, s); t.textContent = (d.labels || [])[i] || '';
        return [r, (v / max) * 34];
      });
      return {
        reset() { rs.forEach(([r]) => { r.setAttribute('height', 0); r.setAttribute('y', 38); }); },
        async run(alive) { await sleep(80); for (const [r, h] of rs) { if (!alive()) return; r.setAttribute('height', h); r.setAttribute('y', 38 - h); await sleep(160); } },
        final() { rs.forEach(([r, h]) => { r.setAttribute('height', h); r.setAttribute('y', 38 - h); }); },
      };
    },
  };

  // count-up: <span class="n" data-to="2,554"> runs from 0 to its value and always ends on the exact string
  function fmtLike(to, v) {
    const dec = (to.split('.')[1] || '').length;
    let s = v.toFixed(dec);
    if (to.includes(',')) { const [i, f] = s.split('.'); s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f != null ? '.' + f : ''); }
    return s;
  }
  function countUp(span, alive, dur) {
    const to = span.dataset.to, target = parseFloat(to.replace(/,/g, ''));
    if (!target) { span.textContent = to; return; }
    const t0 = performance.now();
    const frame = (now) => {
      if (!alive()) return;
      const k = Math.min(1, (now - t0) / dur);
      span.textContent = k >= 1 ? to : fmtLike(to, target * easeOut(k));
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  const finalAll = () => $$('.n').forEach((n) => (n.textContent = n.dataset.to));
  const zeroIn = (el) => $$('.n', el).forEach((n) => (n.textContent = fmtLike(n.dataset.to, 0)));
  function lockWidths() {  // table cells and bar labels keep their final width while they count
    $$('.sheet td .n, .mini .n').forEach((n) => { n.style.minWidth = ''; const fs = parseFloat(getComputedStyle(n).fontSize); n.style.minWidth = (n.getBoundingClientRect().width / fs) + 'em'; });
  }
  // the numbers share one size, shrunk only as much as the widest one needs to fit its column
  function fitNums() {
    const vals = $$('.bn-val');
    vals.forEach((v) => { v.style.fontSize = ''; $$('.n', v).forEach((n) => (n.style.minWidth = '')); });
    const ratios = vals.map((v) => {  // width of the text itself, against 92% of the column
      const range = document.createRange(); range.selectNodeContents(v);
      return Math.min(1, (v.clientWidth * 0.92) / Math.max(1, range.getBoundingClientRect().width));
    });
    const r = Math.min(...ratios, 1);
    vals.forEach((v, i) => {
      const k = r >= 0.6 ? r : ratios[i];
      if (k < 1) v.style.fontSize = parseFloat(getComputedStyle(v).fontSize) * k + 'px';
      const fs = parseFloat(getComputedStyle(v).fontSize);
      $$('.n', v).forEach((n) => (n.style.minWidth = (n.getBoundingClientRect().width / fs) + 'em'));  // no jitter while counting
    });
  }
  const cards = $$('.bn').map((card, i) => {
    const spec = (A.stats || [])[i] || {};
    const box = $('.viz', card);
    const viz = vizFns[spec.viz] && box ? vizFns[spec.viz](box, spec.data || {}) : null;
    const zero = () => $$('.n', card).forEach((n) => (n.textContent = fmtLike(n.dataset.to, 0)));
    const run = runner(async (alive) => {
      $$('.n', card).forEach((n) => countUp(n, alive, 1600));
      if (viz) { viz.reset(); await viz.run(alive); }
    });
    return { card, viz, zero, run };
  });
  let fitted = false;
  function refit() { cards.forEach((c) => { c.run.stop(); if (c.viz) c.viz.final(); }); finalAll(); fitNums(); lockWidths(); fitted = true; }
  if (document.fonts) document.fonts.ready.then(refit); else addEventListener('load', refit);
  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(refit, 150); });

  // ---------- the report: highlighter, table rows, bar figures ----------
  let penAt = 0;
  function pen(m) { // marks that come into view are swept one after another, like a pen
    const at = Math.max(performance.now(), penAt) + 120;
    penAt = at + 520;
    setTimeout(() => m.classList.add('on'), at - performance.now());
  }
  const tableRuns = $$('table[data-hl]').map((t) => runner(async (alive) => {
    const rows = $$('tbody tr', t);
    $$('.n', t).forEach((n) => countUp(n, alive, 1100));  // the rows slide in while their numbers count up
    await sleep(1400);
    while (alive()) {
      for (const i of JSON.parse(t.dataset.hl)) {
        if (!alive()) break;
        rows.forEach((r) => r.classList.remove('on'));
        if (rows[i]) rows[i].classList.add('on');
        await sleep(1500);
      }
      rows.forEach((r) => r.classList.remove('on'));
      await sleep(1400);
    }
    rows.forEach((r) => r.classList.remove('on'));
  }));
  const miniRuns = $$('.mini').map((m) => runner(async (alive) => {
    $$('.bar i', m).forEach((b) => (b.style.width = '0'));
    await sleep(250);
    for (const row of $$('.row', m)) {
      if (!alive()) return;
      $('.bar i', row).style.width = row.dataset.w + '%';
      $$('.n', row).forEach((n) => countUp(n, alive, 1100));
      await sleep(420);
    }
  }));

  if (reduce || !hasIO) {
    $$('.sheet mark').forEach((m) => m.classList.add('on'));
    $$('.mini .row').forEach((r) => ($('.bar i', r).style.width = r.dataset.w + '%'));
    $$('.node li', arch).forEach((li) => li.classList.add('ok'));
    cards.forEach((c) => c.viz && c.viz.final());
    finalAll();
    if (!reduce) { // no IntersectionObserver: still play, just not tied to scrolling
      if (arch && steps.length) archRun.start();
      tableRuns.forEach((r) => r.start());
    }
    return;
  }

  // start everything from its first frame, then play each part while it is on screen
  cards.forEach((c) => { c.zero(); if (c.viz) c.viz.reset(); });
  if (arch && steps.length) watch(arch, () => archRun.start(), () => { archRun.stop(); resetArch(); }, { min: 0.25 });
  cards.forEach((c) => watch(c.card, () => { if (!fitted) refit(); c.zero(); c.run.start(); }, () => { c.run.stop(); c.zero(); if (c.viz) c.viz.reset(); }, { min: 0.25, threshold: [0, 0.25, 0.5] }));
  $$('.sheet mark').forEach((m) => watch(m, () => pen(m), () => m.classList.remove('on'), { margin: '0px 0px -12% 0px', threshold: [0, 0.6], min: 0.55 }));
  $$('table[data-hl]').forEach((t, i) => watch(t, () => tableRuns[i].start(), () => { tableRuns[i].stop(); zeroIn(t); $$('tr.on', t).forEach((r) => r.classList.remove('on')); }, { min: 0.25 }));
  $$('.mini').forEach((m, i) => watch(m, () => miniRuns[i].start(), () => { miniRuns[i].stop(); zeroIn(m); $$('.bar i', m).forEach((b) => (b.style.width = '0')); }, { min: 0.25 }));
})();
