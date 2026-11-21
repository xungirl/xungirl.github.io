// living-paper: drives the animations of one page. No network, no libraries.
// The page holds <script type="application/json" id="paper-anim"> with the figure sequence.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const A = JSON.parse(document.getElementById('paper-anim').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Fig. 1 edges: straight lines between box sides, drawn after layout ----------
  const arch = $('.arch');
  function drawEdges() {
    if (!arch) return;
    const svg = $('svg.edges', arch);
    svg.innerHTML = '';
    const base = arch.getBoundingClientRect();
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7c8088"/></marker>';
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
        t.setAttribute('x', vertical ? p1.x + 6 : (p1.x + p2.x) / 2); t.setAttribute('y', (p1.y + p2.y) / 2 + (vertical ? 4 : -5));
        t.setAttribute('text-anchor', vertical ? 'start' : 'middle'); t.textContent = e.label;
        svg.appendChild(t);
      }
    }
  }
  addEventListener('resize', drawEdges);
  if (document.fonts) document.fonts.ready.then(drawEdges); else addEventListener('load', drawEdges);
  drawEdges();

  // ---------- Fig. 1 sequence ----------
  async function runArch() {
    if (!arch) return;
    const steps = A.sequence || [];
    for (;;) {
      $$('.node li', arch).forEach((li) => li.classList.remove('ok'));
      for (const s of steps) {
        $$('.node', arch).forEach((n) => n.classList.remove('on'));
        $$('.node li', arch).forEach((li) => li.classList.remove('on'));
        $$('.edges [data-edge]', arch).forEach((l) => l.classList.remove('pulse'));
        const n = $(`[data-node="${s.node}"]`, arch);
        if (n) {
          n.classList.add('on');
          const items = $$('li', n);
          if (s.item != null && items[s.item]) items[s.item].classList.add('on');
          if (s.check != null && items[s.check]) items[s.check].classList.add('ok');
          if (s.checkAll) items.forEach((li) => li.classList.add('ok'));
          let foot = $('.foot', n);
          if (!foot && s.note != null) { foot = document.createElement('div'); foot.className = 'foot'; foot.dataset.default = ''; n.appendChild(foot); }
          if (foot && s.note != null) foot.textContent = s.note;
          const m = $('.meter i', n);
          if (m && s.meter != null) m.style.width = s.meter + '%';
        }
        if (s.edge) { const l = $(`[data-edge="${s.edge}"]`, arch); if (l) l.classList.add('pulse'); }
        await sleep(s.ms || 1300);
      }
      await sleep(600);
      $$('.node .foot', arch).forEach((f) => (f.textContent = f.dataset.default || ''));
      $$('.node .meter i', arch).forEach((m) => (m.style.width = m.dataset.default || m.style.width));
    }
  }

  // ---------- Fig. 2 stat cards ----------
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
      for (let i = 0; i < total; i++) cells.push(svgEl('rect', { x: (i % cols) * 9, y: Math.floor(i / cols) * 9, width: 7, height: 7, rx: 1 }, s));
      const filled = Math.round((d.filled / (d.total || 100)) * total);
      return async () => { cells.forEach((c) => c.classList.remove('f')); for (let i = 0; i < filled; i++) { cells[i].classList.add('f'); await sleep(Math.max(8, 900 / filled)); } };
    },
    drop(box, d) { // d: {from, to, unit}
      const s = svgEl('svg', { viewBox: '0 0 120 40' }, box); s.classList.add('v-drop');
      svgEl('rect', { class: 'a', x: 0, y: 4, width: 120, height: 10, rx: 2 }, s);
      const b = svgEl('rect', { class: 'b', x: 0, y: 22, width: 120, height: 10, rx: 2 }, s);
      const fmt = (v) => (typeof v === 'number' && Math.abs(v) >= 10000 ? v.toLocaleString('en-US') : v);
      const t1 = svgEl('text', { x: 0, y: 3 }, s); t1.textContent = `${fmt(d.from)}${d.unit || ''}`;
      const t2 = svgEl('text', { x: 0, y: 40 }, s); t2.textContent = `${fmt(d.to)}${d.unit || ''}`;
      const w = Math.min(120, Math.max(2, 120 * (Number(d.to) / Number(d.from))));
      return async () => { b.setAttribute('width', 120); await sleep(300); b.style.transition = 'width 1.1s ease'; b.setAttribute('width', w); };
    },
    rise(box, d) { // d: {points: [n...]}
      const pts = d.points && d.points.length > 1 ? d.points : [1, 2, 3, 5, 8];
      const max = Math.max(...pts), min = Math.min(...pts, 0);
      const s = svgEl('svg', { viewBox: '0 0 120 44' }, box); s.classList.add('v-rise');
      svgEl('line', { class: 'base', x1: 0, y1: 42, x2: 120, y2: 42 }, s);
      const xy = pts.map((v, i) => [i * (120 / (pts.length - 1)), 42 - ((v - min) / (max - min || 1)) * 38]);
      const p = svgEl('path', { d: 'M' + xy.map((q) => q.join(',')).join(' L') }, s);
      const dot = svgEl('circle', { cx: xy[xy.length - 1][0], cy: xy[xy.length - 1][1], r: 3 }, s);
      const len = p.getTotalLength ? p.getTotalLength() : 200;
      p.style.strokeDasharray = len;
      return async () => { dot.style.opacity = 0; p.style.transition = 'none'; p.style.strokeDashoffset = len; await sleep(50); p.style.transition = 'stroke-dashoffset 1.3s ease'; p.style.strokeDashoffset = 0; await sleep(1300); dot.style.opacity = 1; };
    },
    bars(box, d) { // d: {labels: [], values: [], hi: index}
      const vals = d.values || [], n = vals.length || 1, max = Math.max(...vals, 1);
      const s = svgEl('svg', { viewBox: `0 0 120 48` }, box); s.classList.add('v-bars');
      const bw = 120 / n - 6;
      const rs = vals.map((v, i) => {
        const r = svgEl('rect', { x: i * (120 / n) + 3, y: 38, width: bw, height: 0, rx: 1.5 }, s);
        if (i === d.hi) r.classList.add('hi');
        const t = svgEl('text', { x: i * (120 / n) + 3 + bw / 2, y: 47, 'text-anchor': 'middle' }, s); t.textContent = (d.labels || [])[i] || '';
        return [r, (v / max) * 34];
      });
      return async () => { rs.forEach(([r]) => { r.setAttribute('height', 0); r.setAttribute('y', 38); }); await sleep(60); rs.forEach(([r, h]) => { r.setAttribute('height', h); r.setAttribute('y', 38 - h); }); };
    },
  };
  const cards = $$('.stat').map((card, i) => {
    const spec = (A.stats || [])[i] || {};
    const box = $('.viz', card);
    const fn = vizFns[spec.viz] && box ? vizFns[spec.viz](box, spec.data || {}) : null;
    return { card, run: fn || (async () => {}) };
  });
  async function runStats() {
    for (;;) {
      for (const c of cards) { $$('.stat').forEach((x) => x.classList.remove('on')); c.card.classList.add('on'); await c.run(); await sleep(1800); }
      $$('.stat').forEach((x) => x.classList.remove('on'));
      await sleep(1200);
    }
  }

  // ---------- highlighter pen over the text, and table rows ----------
  async function runMarks() {
    const marks = $$('mark');
    if (!marks.length) return;
    for (;;) {
      for (const m of marks) { m.classList.add('on'); await sleep(1100); }
      await sleep(4000);
      marks.forEach((m) => m.classList.remove('on'));
      await sleep(900);
    }
  }
  async function runTables() {
    const tables = $$('table[data-hl]');
    for (;;) {
      for (const t of tables) {
        const rows = $$('tbody tr', t);
        for (const i of JSON.parse(t.dataset.hl)) { rows.forEach((r) => r.classList.remove('on')); if (rows[i]) rows[i].classList.add('on'); await sleep(1600); }
        rows.forEach((r) => r.classList.remove('on'));
      }
      await sleep(1000);
    }
  }
  async function runMinis() {
    const minis = $$('.mini');
    for (;;) {
      for (const m of minis) {
        $$('.bar i', m).forEach((b) => (b.style.width = '0'));
        await sleep(200);
        for (const row of $$('.row', m)) { $('.bar i', row).style.width = row.dataset.w + '%'; await sleep(500); }
      }
      await sleep(5000);
    }
  }

  if (reduce) {
    $$('mark').forEach((m) => m.classList.add('on'));
    $$('.mini .row').forEach((r) => ($('.bar i', r).style.width = r.dataset.w + '%'));
    $$('.node li').forEach((li) => li.classList.add('ok'));
    cards.forEach((c) => c.run());
    return;
  }
  runArch(); runStats(); runMarks(); runTables(); runMinis();
})();
