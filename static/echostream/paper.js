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
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
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

  // ---------- hero demo video (only on pages that set hero.video): reduced motion shows the poster and controls ----------
  $$('video.hero-video').forEach((v) => {
    if (reduce) { v.removeAttribute('autoplay'); v.pause(); v.controls = true; return; }
    v.addEventListener('click', () => (v.paused ? v.play() : v.pause()));
  });

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
      + `<marker id="ahh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${getComputedStyle(document.documentElement).getPropertyValue('--blue').trim() || '#2c6bd3'}"/></marker>`;
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

  // ---------- replay figures: a time series that plays back, with a synced stat grid and status line ----------
  // Data comes from make_replay.py (raw repo results). Numbers shown in the stat grid and status line are always
  // values of real data points (the last one at or before the play head), never interpolated values.
  const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();
  const HUES = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'purple', 'gray'];
  const hue = (el, c) => (HUES.includes(c) ? cssVar(el, '--' + c) : c || cssVar(el, '--blue'));
  function niceTicks(lo, hi, n) {
    const span = hi - lo || 1, raw = span / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  const fmtNum = (v, sep) => (v == null || v === '' ? '—' : typeof v === 'number' && sep ? v.toLocaleString('en-US', { maximumFractionDigits: 6 }) : String(v));
  function atOrBefore(pts, t) { // last [t, v] with t <= play head
    let hit = null;
    for (const p of pts) { if (p[0] <= t + 1e-9) hit = p; else break; }
    return hit;
  }
  function replayFig(fig, spec) {
    const svgR = $('.rp-svg', fig), statusEl = $('.rp-status', fig), scrub = $('.rp-scrub', fig), timeEl = $('.rp-time', fig), btn = $('.rp-play', fig);
    const dds = $$('.rp-stats dd', fig);
    const series = spec.series || [], P = spec.points || {}, fields = spec.fields || {};
    const allT = [].concat(...series.map((s) => (P[s.id] || []).map((p) => p[0])));
    const x0 = spec.x && spec.x.min != null ? spec.x.min : Math.min(...allT), x1 = spec.x && spec.x.max != null ? spec.x.max : Math.max(...allT);
    const shown = series.filter((s) => !s.hidden);
    const allV = [].concat(...shown.map((s) => (P[s.id] || []).map((p) => p[1])), ...(spec.thresholds || []).map((t) => t.value));
    const y0 = spec.y && spec.y.min != null ? spec.y.min : Math.min(0, ...allV);
    const y1 = spec.y && spec.y.max != null ? spec.y.max : Math.max(...allV) * 1.08;
    const stopColor = (s, v) => {
      const stops = s.stops === true || (!s.color && !s.stops) ? spec.stops : s.stops;
      if (!stops || !stops.length) return hue(fig, s.color);
      for (const st of stops) if (st.to == null || v < st.to) return hue(fig, st.color);
      return hue(fig, stops[stops.length - 1].color);
    };
    let started = false, geo = null, tp = x1, playing = false, raf = 0, last = 0, holdUntil = 0;
    const dur = spec.duration || 9000;
    function build() {
      const W = svgR.clientWidth || 600, H = svgR.clientHeight || 250;
      const L = 8, R = 52, T = 22, B = 24, pw = W - L - R, ph = H - T - B;
      const X = (t) => L + ((t - x0) / (x1 - x0 || 1)) * pw, Y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * ph;
      svgR.innerHTML = '';
      svgR.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const g = (cls) => svgEl('g', cls ? { class: cls } : {}, svgR);
      const gb = g(), gg = g(), gt = g(), ge = g(), gs = g(), gh = g();
      // bands (phases), revealed as the play head passes them
      const bands = (spec.bands || []).map((b, i) => {
        const c = hue(fig, b.color || 'gray');
        const r = svgEl('rect', { class: 'band', x: X(b.start), y: T, width: 0, height: ph, fill: c, 'fill-opacity': b.opacity || 0.13 }, gb);
        const lab = b.label ? svgEl('text', { class: 'band-l', x: X(b.start) + 4, y: T + 11 + (i % 2) * 12, fill: c }, gb) : null;
        if (lab) { lab.textContent = b.label; lab.style.fill = c; }
        return { b, r, lab };
      });
      // grid and ticks
      const yt = (spec.y && spec.y.ticks) || niceTicks(y0, y1, H < 230 ? 4 : 5);
      yt.forEach((v) => {
        svgEl('line', { class: 'grid', x1: L, x2: L + pw, y1: Math.round(Y(v)) + 0.5, y2: Math.round(Y(v)) + 0.5 }, gg);
        const t = svgEl('text', { x: L + pw + 6, y: Y(v) + 3.5 }, gg); t.textContent = fmtNum(v, true) + ((spec.y && spec.y.unit) || '');
      });
      svgEl('line', { class: 'axis', x1: L, x2: L + pw, y1: T + ph + 0.5, y2: T + ph + 0.5 }, gg);
      let xt = (spec.x && spec.x.ticks) || niceTicks(x0, x1, W < 480 ? 4 : 8);
      xt.forEach((v) => {
        const t = svgEl('text', { x: Math.min(Math.max(X(v), L + 10), L + pw - 10), y: T + ph + 16, 'text-anchor': 'middle' }, gg);
        t.textContent = ((spec.x && spec.x.fmt) || '{v}').replace('{v}', fmtNum(v, true));
      });
      if (spec.y && spec.y.label) { const t = svgEl('text', { x: L + pw + 6, y: T - 9 }, gg); t.textContent = spec.y.label; }
      // thresholds: dashed, labelled at the right end, always visible
      (spec.thresholds || []).forEach((th) => {
        const c = hue(fig, th.color || 'gray'), y = Math.round(Y(th.value)) + 0.5;
        const l = svgEl('line', { class: 'thr', x1: L, x2: L + pw, y1: y, y2: y, stroke: c }, gt);
        if (th.dashed === false) l.style.strokeDasharray = 'none';
        if (th.label) { // "pos": "above" (default) | "below", "align": "right" (default) | "left"
          const left = th.align === 'left', below = th.pos === 'below';
          const t = svgEl('text', { class: 'thr-l', x: left ? L + 4 : L + pw - 4, y: below ? y + 13 : y - 5, 'text-anchor': left ? 'start' : 'end' }, gt);
          t.textContent = th.label; t.style.fill = c;
        }
      });
      // events: vertical markers that appear when the play head reaches them
      const events = (spec.events || []).map((ev, i) => {
        const c = hue(fig, ev.color || 'red'), x = Math.round(X(ev.t)) + 0.5;
        const l = svgEl('line', { class: 'ev', x1: x, x2: x, y1: T, y2: T + ph, stroke: c }, ge);
        let t = null;
        if (ev.label) {
          t = svgEl('text', { class: 'ev-l', x: x + (x > L + pw * 0.8 ? -4 : 4), y: T - 6 - (ev.row != null ? ev.row : 0) * 11, 'text-anchor': x > L + pw * 0.8 ? 'end' : 'start' }, ge);
          t.textContent = ev.label; t.style.fill = c;
        }
        return { ev, l, t };
      });
      // series: one line per segment, colored by its value (or the series color)
      const lines = shown.map((s) => {
        const pts = P[s.id] || [];
        const segs = [];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          if (a[1] == null || b[1] == null) { segs.push(null); continue; }
          const ln = svgEl('line', { class: 'seg', x1: X(a[0]), y1: Y(a[1]), x2: X(a[0]), y2: Y(a[1]), stroke: stopColor(s, (a[1] + b[1]) / 2), 'stroke-width': s.width || 2.6 }, gs);
          if (s.dash) ln.setAttribute('stroke-dasharray', '4 4');
          segs.push(ln);
        }
        const dots = s.dots ? pts.map((p) => (p[1] == null ? null : svgEl('circle', { class: 'dot', cx: X(p[0]), cy: Y(p[1]), r: s.dotR || 3, fill: stopColor(s, p[1]) }, gs))) : [];
        return { s, pts, segs, dots };
      });
      const glow = svgEl('circle', { class: 'head head-glow', r: 9 }, gh), head = svgEl('circle', { class: 'head', r: 4 }, gh);
      geo = { X, Y, bands, events, lines, glow, head, L, pw };
    }
    function frame(t) {
      tp = Math.max(x0, Math.min(x1, t));
      if (!geo) build();
      const { X, Y } = geo;
      geo.bands.forEach(({ b, r, lab }) => {
        const vis = tp >= b.start;
        r.setAttribute('width', vis ? Math.max(0, X(Math.min(b.end, tp)) - X(b.start)) : 0);
        if (lab) lab.style.opacity = vis ? 1 : 0;
      });
      geo.events.forEach(({ ev, l, t }) => { const on = tp >= ev.t - 1e-9; l.style.opacity = on ? 0.85 : 0; if (t) t.style.opacity = on ? 1 : 0; });
      let headAt = null;
      geo.lines.forEach(({ s, pts, segs, dots }, li) => {
        for (let i = 1; i < pts.length; i++) {
          const ln = segs[i - 1]; if (!ln) continue;
          const a = pts[i - 1], b = pts[i];
          if (tp <= a[0]) { ln.setAttribute('x2', X(a[0])); ln.setAttribute('y2', Y(a[1])); ln.style.opacity = 0; continue; }
          const k = Math.min(1, (tp - a[0]) / (b[0] - a[0] || 1));
          const xe = X(a[0] + (b[0] - a[0]) * k), ye = Y(a[1] + (b[1] - a[1]) * k);
          ln.setAttribute('x2', xe); ln.setAttribute('y2', ye); ln.style.opacity = 1;
          if (k < 1 && li === 0) headAt = [xe, ye, ln.getAttribute('stroke')];
        }
        dots.forEach((d, i) => { if (d) d.style.opacity = pts[i][0] <= tp + 1e-9 ? 1 : 0; });
      });
      if (headAt && tp < x1) {
        [geo.glow, geo.head].forEach((c) => { c.setAttribute('cx', headAt[0]); c.setAttribute('cy', headAt[1]); c.setAttribute('fill', headAt[2]); c.style.opacity = ''; });
      } else [geo.glow, geo.head].forEach((c) => (c.style.opacity = 0));
      // the stat grid and status line show the data point at or before the play head
      const cur = {};
      series.forEach((s) => { const h = atOrBefore(P[s.id] || [], tp); cur[s.id] = h ? h : null; });
      Object.keys(fields).forEach((f) => { const h = atOrBefore(fields[f], tp); cur['field:' + f] = h; });
      const val = (key, sep) => {
        if (key === 't') { const h = atOrBefore(P[series[0].id] || [], tp); return h ? fmtNum(h[0], sep) : '—'; }
        const h = key in cur ? cur[key] : cur['field:' + key];
        return h ? (h[2] != null ? String(h[2]) : fmtNum(h[1], sep)) : '—';  // [t, value, "exact text from the file"]
      };
      (spec.stats || []).forEach((st, i) => {
        const dd = dds[i]; if (!dd) return;
        let txt;
        if (st.series || st.field || st.t) {
          const v = val(st.t ? 't' : st.series || st.field, st.sep);
          txt = v === '—' ? '—' : (st.fmt || '{v}').replace('{v}', v);
        } else txt = st.value != null ? String(st.value) : '—';
        if (dd.textContent !== txt) { dd.textContent = txt; dd.classList.remove('tick'); void dd.offsetWidth; dd.classList.add('tick'); }
      });
      if (statusEl) {
        let txt = '';
        for (const st of spec.status || []) if (tp >= (st.from != null ? st.from : -Infinity) - 1e-9 && tp <= (st.to != null ? st.to : Infinity) + 1e-9) txt = st.text;
        const html = esc(txt).replace(/\{([\w-]+)(:sep)?\}/g, (m, k, sep) => val(k, !!sep)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        if (statusEl.innerHTML !== html) statusEl.innerHTML = html;
      }
      if (scrub) scrub.value = Math.round(((tp - x0) / (x1 - x0 || 1)) * 1000);
      if (timeEl) {
        const ro = spec.readout || '{t} / {end}';
        timeEl.textContent = ro.replace('{t}', val('t', true)).replace('{end}', fmtNum(x1, true));
      }
    }
    function setPlaying(on) {
      playing = on;
      btn.setAttribute('aria-pressed', String(!on));
      btn.setAttribute('aria-label', on ? 'Pause the replay' : 'Play the replay');
      cancelAnimationFrame(raf);
      if (on) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function tick(now) {
      if (!playing) return;
      const dt = now - last; last = now;
      if (holdUntil) {
        if (now < holdUntil) { raf = requestAnimationFrame(tick); return; }
        holdUntil = 0;
        if (spec.loop === false) { setPlaying(false); return; }
        frame(x0);
      } else {
        const nt = tp + ((x1 - x0) * dt) / dur;
        frame(nt);
        if (nt >= x1) holdUntil = now + 2800;  // hold the final frame, then loop
      }
      raf = requestAnimationFrame(tick);
    }
    btn.addEventListener('click', () => {
      if (playing) return setPlaying(false);
      if (tp >= x1) frame(x0);
      holdUntil = 0; setPlaying(true);
    });
    scrub.addEventListener('input', () => { setPlaying(false); holdUntil = 0; frame(x0 + ((x1 - x0) * scrub.value) / 1000); });
    let rzT;
    addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { geo = null; frame(tp); }, 120); });
    frame(x1);  // the final frame until it plays (and for reduced motion)
    return {
      enter() { if (reduce) return; if (tp >= x1 || !started) { frame(x0); started = true; } holdUntil = 0; setPlaying(true); },
      leave() { setPlaying(false); },
    };
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  const replayFigs = $$('figure[data-replay]').map((fig) => replayFig(fig, (A.replays || [])[+fig.dataset.replay] || {}));

  // ---------- flow figures: an animated architecture flowchart ----------
  // Boxes sit on an explicit grid (placed by build.py); edges are orthogonal dashed paths routed here through
  // the paper's waypoints, with dots travelling along them; a step highlight walks the main path.
  function flowFig(fig, spec) {
    const panel = $('.fl-panel', fig), scroller = $('.fl-scroll', fig), sizer = $('.fl-sizer', fig), stage = $('.fl-stage', fig), svgF = $('.fl-edges', fig);
    const W = parseFloat(stage.style.width), H = parseFloat(stage.style.height);
    const nodes = {};
    $$('.fl-node', stage).forEach((n, i) => { nodes[n.dataset.id] = n; n.style.setProperty('--d', i * 60 + 150 + 'ms'); });
    $$('.fl-zone', stage).forEach((z, i) => z.style.setProperty('--d', i * 80 + 'ms'));
    const KIND = { main: 'blue', return: 'green', retry: 'orange', reject: 'red', alt: 'purple' };
    function box(id) {
      const n = nodes[id], cx = parseFloat(n.dataset.cx), cy = parseFloat(n.dataset.cy);
      const dia = n.classList.contains('fl-dia');
      const w = dia ? 70 : n.offsetWidth, h = dia ? 70 : n.offsetHeight;   // a diamond's tips sit on a 70 px box around its center
      return { cx, cy, w, h, l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 };
    }
    function port(bx, side, gap, off) { // off: shift along the side, so a request and its reply can run side by side
      off = off || 0;
      return side === 'l' ? [bx.l - gap, bx.cy + off] : side === 'r' ? [bx.r + gap, bx.cy + off] : side === 't' ? [bx.cx + off, bx.t - gap] : [bx.cx + off, bx.b + gap];
    }
    function autoSides(a, b) {
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      if (Math.abs(dx) > (a.w + b.w) / 2 && Math.abs(dx) >= Math.abs(dy) * 0.6) return dx > 0 ? ['r', 'l'] : ['l', 'r'];
      return dy > 0 ? ['b', 't'] : ['t', 'b'];
    }
    function route(e, cw, ch, oy) {
      const a = box(e.from), b = box(e.to);
      const [as, bs] = e.from_side && e.to_side ? [e.from_side, e.to_side] : (() => { const s = autoSides(a, b); return [e.from_side || s[0], e.to_side || s[1]]; })();
      const p0 = port(a, as, 2, e.from_off), p1 = port(b, bs, 6, e.to_off);
      const via = (e.via || []).map(([c, r]) => [(c - 0.5) * cw, (r - 0.5) * ch + oy]);
      const pts = [p0, ...via, p1];
      const horiz = (s) => s === 'l' || s === 'r';
      let dir = horiz(as) ? 'h' : 'v';
      const lastDir = horiz(bs) ? 'h' : 'v';
      const out = [p0];
      for (let i = 1; i < pts.length; i++) {
        const p = out[out.length - 1], q = pts[i];
        const isLast = i === pts.length - 1;
        if (Math.abs(p[0] - q[0]) < 0.5 || Math.abs(p[1] - q[1]) < 0.5) { out.push(q); dir = Math.abs(p[0] - q[0]) < 0.5 ? 'v' : 'h'; continue; }
        if (isLast && dir === lastDir) { // same orientation in and out: a Z with the jog in the middle
          if (dir === 'h') { const mx = (p[0] + q[0]) / 2; out.push([mx, p[1]], [mx, q[1]], q); }
          else { const my = (p[1] + q[1]) / 2; out.push([p[0], my], [q[0], my], q); }
        } else if (isLast) {
          out.push(lastDir === 'h' ? [p[0], q[1]] : [q[0], p[1]], q);
        } else {
          out.push(dir === 'h' ? [q[0], p[1]] : [p[0], q[1]], q);
          dir = dir === 'h' ? 'v' : 'h';
        }
      }
      // rounded corners
      const rad = 9;
      let d = `M${out[0][0]},${out[0][1]}`;
      for (let i = 1; i < out.length; i++) {
        const p = out[i];
        if (i < out.length - 1) {
          const o = out[i - 1], n = out[i + 1];
          const l1 = Math.hypot(p[0] - o[0], p[1] - o[1]), l2 = Math.hypot(n[0] - p[0], n[1] - p[1]);
          const r = Math.min(rad, l1 / 2, l2 / 2);
          if (r < 1) { d += ` L${p[0]},${p[1]}`; continue; }
          const a1 = [p[0] - ((p[0] - o[0]) / l1) * r, p[1] - ((p[1] - o[1]) / l1) * r];
          const a2 = [p[0] + ((n[0] - p[0]) / l2) * r, p[1] + ((n[1] - p[1]) / l2) * r];
          d += ` L${a1[0]},${a1[1]} Q${p[0]},${p[1]} ${a2[0]},${a2[1]}`;
        } else d += ` L${p[0]},${p[1]}`;
      }
      return d;
    }
    const edgeEls = {};
    function draw() {
      svgF.innerHTML = '';
      $$('.fl-lbl', stage).forEach((l) => l.remove());
      const any = spec.edges[0] && nodes[spec.edges[0].from];
      const cw = parseFloat(fig.dataset.cw || 240), ch = parseFloat(fig.dataset.ch || 128), oy = parseFloat(fig.dataset.oy || 0);
      const defs = svgEl('defs', {}, svgF);
      Object.values(KIND).forEach((c) => {
        const m = svgEl('marker', { id: `fa-${c}-${fig.dataset.flow}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
        svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: cssVar(fig, '--' + c) }, m);
      });
      (spec.edges || []).forEach((e, i) => {
        if (!any) return;
        const c = KIND[e.kind || 'main'];
        const id = `fe-${fig.dataset.flow}-${i}`;
        const path = svgEl('path', { id, class: `e c-${c}`, d: route(e, cw, ch, oy), 'marker-end': `url(#fa-${c}-${fig.dataset.flow})` }, svgF);
        if (e.dashed === false) path.style.strokeDasharray = 'none';
        edgeEls[`${e.from}>${e.to}`] = path;
        const len = path.getTotalLength();
        if (!reduce) { // dots travel along the edge in the flow direction
          const n = len > 260 ? 2 : 1, durS = Math.max(1.6, len / 85);
          for (let k = 0; k < n; k++) {
            const dot = svgEl('circle', { r: 3, class: `pk c-${c}` }, svgF);
            const am = svgEl('animateMotion', { dur: durS + 's', repeatCount: 'indefinite', begin: (-durS * (k / n + (i % 3) * 0.17)) + 's', rotate: 'auto' }, dot);
            const mp = document.createElementNS(NS, 'mpath'); mp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + id); mp.setAttribute('href', '#' + id); am.appendChild(mp);
          }
        }
        if (e.label) {
          const pt = path.getPointAtLength(len * (e.label_at != null ? e.label_at : 0.5));
          const lb = document.createElement('span');
          lb.className = `fl-lbl c-${c}`; lb.textContent = e.label;
          const off = e.label_offset || [0, 0];
          lb.style.left = pt.x + off[0] + 'px'; lb.style.top = pt.y + off[1] + 'px';
          stage.appendChild(lb);
        }
      });
    }
    function fit() {
      const avail = scroller.clientWidth || W;
      let s = avail / W;
      const pan = s < 0.7;
      if (pan) s = Math.min(0.78, Math.max(0.62, s * 1.9));
      s = Math.min(1, s);
      stage.style.transform = `scale(${s})`;
      sizer.style.width = W * s + 'px'; sizer.style.height = H * s + 'px';
      scroller.classList.toggle('pan', pan);
      panel.classList.toggle('can-pan', pan);
    }
    // tooltip
    const tip = $('.fl-tip', fig);
    let tipFor = null, shownAt = 0;
    function showTip(n) {
      const src = $('.fl-tipsrc', n);
      if (!src) return;
      tipFor = n; shownAt = performance.now();
      tip.innerHTML = src.innerHTML;
      const c = cssVar(n, '--c'), ct = cssVar(n, '--ct');
      tip.style.setProperty('--c', c); tip.style.setProperty('--ct', ct);
      tip.hidden = false;
      const pr = panel.getBoundingClientRect(), nr = n.getBoundingClientRect();
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = nr.left - pr.left + nr.width / 2 - tw / 2;
      x = Math.max(8, Math.min(pr.width - tw - 8, x));
      let y = nr.bottom - pr.top + 8;
      if (y + th > pr.height - 4 && nr.top - pr.top - th - 8 > 0) y = nr.top - pr.top - th - 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    function hideTip() { tip.hidden = true; tipFor = null; }
    Object.values(nodes).forEach((n) => {
      n.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(n); });
      n.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideTip(); });
      n.addEventListener('focus', () => showTip(n));
      n.addEventListener('blur', hideTip);
      // a tap focuses the box (which opens the tip) and then clicks it: only a second tap closes it
      n.addEventListener('click', (e) => { e.stopPropagation(); if (tipFor === n && performance.now() - shownAt > 400) hideTip(); else showTip(n); });
    });
    document.addEventListener('click', (e) => { if (tipFor && !fig.contains(e.target)) hideTip(); });
    scroller.addEventListener('scroll', () => { if (performance.now() - userAt < 1500) hideTip(); }, { passive: true });
    // the walk: highlight the main path one node at a time
    const walk = (spec.walk || []).map((w) => (typeof w === 'string' ? { node: w } : w)).filter((w) => nodes[w.node]);
    const dotsW = $$('.fl-ticker .tk-dots i', fig), tkt = $('.fl-tk-text', fig), pbtn = $('.fl-play', fig);
    let fpaused = false;
    function clearWalk() { Object.values(nodes).forEach((n) => n.classList.remove('on')); Object.values(edgeEls).forEach((p) => p.classList.remove('hot')); }
    let userAt = 0;  // when the reader last touched the pan area: don't scroll under their finger
    ['pointerdown', 'wheel', 'touchstart'].forEach((ev) => scroller.addEventListener(ev, () => (userAt = performance.now()), { passive: true }));
    function follow(n) { // on a narrow screen, pan so the highlighted box stays in view
      if (!scroller.classList.contains('pan') || performance.now() - userAt < 5000) return;
      const sc = stage.getBoundingClientRect().width / W;
      const x = parseFloat(n.dataset.cx) * sc - scroller.clientWidth / 2;
      const max = scroller.scrollWidth - scroller.clientWidth;
      const left = Math.max(0, Math.min(max, x));
      if (Math.abs(left - scroller.scrollLeft) > 24) scroller.scrollTo({ left, behavior: 'smooth' });
    }
    function step(k) {
      clearWalk();
      const w = walk[k], n = nodes[w.node];
      n.classList.add('on');
      follow(n);
      if (k > 0) { const p = edgeEls[`${walk[k - 1].node}>${w.node}`] || edgeEls[`${w.node}>${walk[k - 1].node}`]; if (p) p.classList.add('hot'); }
      if (tkt) {
        const t = $('.fl-t, .fl-dt', n), c = $('.fl-c', n);
        tkt.innerHTML = '';
        const b = document.createElement('b'); b.textContent = t ? t.textContent : w.node; tkt.appendChild(b);
        if (w.note || c) { tkt.appendChild(document.createTextNode('  ')); const cd = document.createElement('code'); cd.textContent = w.note || c.textContent; tkt.appendChild(cd); }
        tkt.style.setProperty('--tkc', cssVar(n, '--c'));
      }
      dotsW.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    }
    const walkRun = runner(async (alive) => {
      await sleep(900);
      for (let k = 0; alive() && walk.length; k = (k + 1) % walk.length) {
        step(k);
        await sleep(walk[k].ms || 1600);
        while (fpaused && alive()) await sleep(150);
        if (k === walk.length - 1 && alive()) { clearWalk(); dotsW.forEach((d) => d.classList.remove('on', 'done')); await sleep(900); }
      }
    });
    if (pbtn) pbtn.addEventListener('click', () => {
      fpaused = !fpaused;
      pbtn.setAttribute('aria-pressed', String(fpaused));
      pbtn.setAttribute('aria-label', fpaused ? 'Play the animation' : 'Pause the animation');
    });
    const redraw = () => { fit(); draw(); };
    redraw();
    if (document.fonts) document.fonts.ready.then(redraw);
    let rzF; addEventListener('resize', () => { clearTimeout(rzF); rzF = setTimeout(redraw, 120); });
    if (reduce && tkt && walk.length) { tkt.textContent = ''; }
    return { enter() { if (!reduce && walk.length) walkRun.start(); }, leave() { walkRun.stop(); clearWalk(); } };
  }
  const flowFigs = $$('figure[data-flow]').map((fig) => flowFig(fig, (A.flows || [])[+fig.dataset.flow] || {}));
  if (hasIO) {
    $$('figure[data-replay]').forEach((fig, i) => watch(fig, () => replayFigs[i].enter(), () => replayFigs[i].leave(), { min: 0.3, threshold: [0, 0.3, 0.6] }));
    $$('figure[data-flow]').forEach((fig, i) => watch(fig, () => flowFigs[i].enter(), () => flowFigs[i].leave(), { min: 0.2 }));
  } else if (!reduce) { replayFigs.forEach((r) => r.enter()); flowFigs.forEach((f) => f.enter()); }

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
