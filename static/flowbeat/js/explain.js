/*
 * explain.js: the panels around the watch. Live breakdown of the current tick, a strip chart of the
 * session, and the replay of the repo's sample session through the JS port (compared with the scores
 * the Swift app recorded). Reads numbers only; all scoring happens in js/flowbeat-core.js.
 */
(function () {
  'use strict';
  const { FocusEngine } = window.FlowbeatCore;
  const $ = (s) => document.querySelector(s);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const f = (x, d = 1) => (x == null ? '—' : x.toFixed(d));

  // ------------------------------------------------------------------ live breakdown
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function renderBreakdown(s) {
    const tr = s && s.trace;
    const seg = $('#segment');
    if (!tr) {
      ['bdHr', 'bdBase', 'bdMotion', 'bdMp', 'bdHp', 'bdRaw', 'bdScore'].forEach(id => setText(id, '—'));
      setText('bdPhase', s ? 'starting' : 'not running');
      setText('bdNote', 'Waiting for the first one-second tick.');
      if (seg) seg.dataset.seg = '';
      return;
    }
    setText('bdPhase', tr.away ? 'away (walking)' : tr.phase === 'calibrating' ? `calibrating ${s.elapsed}/${s.calibrationSeconds} s` : 'running');
    setText('bdHr', tr.hr == null ? '—' : f(tr.hr) + ' bpm');
    setText('bdBase', tr.baseline == null ? 'not set yet' : f(tr.baseline) + ' bpm');
    setText('bdMotion', f(tr.motion, 3) + ' g');
    const pen = (x) => (x === 0 ? '0' : '−' + f(x));
    setText('bdMp', tr.motionPenalty == null ? '—' : pen(tr.motionPenalty));
    setText('bdHp', tr.hrPenalty == null ? '—' : (tr.recovering ? '0 (HR ignored)' : pen(tr.hrPenalty)));
    setText('bdRaw', tr.raw == null ? '—' : f(tr.raw));
    setText('bdScore', tr.score == null ? '—' : f(tr.score) + (tr.sampleScore == null && tr.score != null ? ' (held)' : ''));
    let note;
    if (tr.away) note = 'Walking: scoring is paused, the ring keeps its last value, and this second counts as time away.';
    else if (tr.finished) note = 'Calibration just ended: baseline = median heart rate of the seated calibration seconds. This second is not scored.';
    else if (tr.phase === 'calibrating') note = 'Calibrating: collecting heart rate for the resting baseline. No score yet.';
    else if (tr.recovering) note = 'Back from walking: for 60 s the heart-rate penalty is skipped while HR settles.';
    else note = `raw = 100 − ${f(tr.motionPenalty)} − ${f(tr.hrPenalty)} = ${f(tr.raw)};  shown = previous + 0.2 × (raw − previous) = ${f(tr.score)}`;
    setText('bdNote', note);
    if (seg) {
      seg.dataset.seg = s.segment || '';
      const pos = $('#segPos');
      if (pos) pos.style.left = (s.phase === 'calibrating' ? 0 : (s.cycleSecond / 60) * 100) + '%';
    }
  }

  // ------------------------------------------------------------------ charts
  function bandColor(v) { return v >= 70 ? css('--c-flow') : v >= 40 ? css('--c-mid') : css('--c-low'); }
  function setupCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  /**
   * series: [{ values: (number|null)[], style: 'band'|'thin', color? }], spans: per-index flags
   * opts: { n (x domain), away[], calib[], labels[], diamonds: [{x, y, state}] }
   */
  function drawChart(cv, opts) {
    if (!cv || !cv.clientWidth) return;
    const { ctx, w, h } = setupCanvas(cv);
    const L = 6, R = 30, T = 10, B = 20;
    const pw = w - L - R, ph = h - T - B;
    const n = Math.max(2, opts.n);
    const X = (i) => L + (i / (n - 1)) * pw, Y = (v) => T + (1 - v / 100) * ph;
    // spans
    const span = (flags, color) => {
      if (!flags) return; ctx.fillStyle = color;
      let s = -1;
      for (let i = 0; i <= flags.length; i++) {
        if (flags[i] && s < 0) s = i;
        if ((!flags[i] || i === flags.length) && s >= 0) { ctx.fillRect(X(s) - 0.5, T, Math.max(1, X(i - 1) - X(s) + 1), ph); s = -1; }
      }
    };
    span(opts.calib, css('--chart-calib'));
    span(opts.away, css('--chart-away'));
    // grid
    ctx.font = '11px ' + css('--font-mono'); ctx.fillStyle = css('--muted'); ctx.textBaseline = 'middle';
    for (const g of [0, 40, 70, 100]) {
      ctx.strokeStyle = g === 70 ? css('--c-flow') : css('--chart-grid');
      ctx.setLineDash(g === 70 ? [4, 4] : []); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, Math.round(Y(g)) + 0.5); ctx.lineTo(L + pw, Math.round(Y(g)) + 0.5); ctx.stroke();
      ctx.fillText(String(g), L + pw + 6, Y(g));
    }
    ctx.setLineDash([]);
    // x labels
    if (opts.xlabels) {
      ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      for (const [i, txt] of opts.xlabels) ctx.fillText(txt, Math.min(Math.max(X(i), L + 12), L + pw - 12), T + ph + 5);
      ctx.textAlign = 'left';
    }
    // labels (user marks)
    if (opts.labels) opts.labels.forEach((lab, i) => {
      if (!lab) return;
      ctx.strokeStyle = lab === 'focused' ? css('--c-flow') : css('--c-low'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(i), T); ctx.lineTo(X(i), T + ph); ctx.stroke();
    });
    // series
    for (const sr of opts.series) {
      const v = sr.values;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (sr.style === 'band') {
        ctx.lineWidth = sr.width || 2.5;
        for (let i = 1; i < v.length; i++) {
          if (v[i] == null || v[i - 1] == null) continue;
          ctx.strokeStyle = bandColor((v[i] + v[i - 1]) / 2);
          ctx.beginPath(); ctx.moveTo(X(i - 1), Y(v[i - 1])); ctx.lineTo(X(i), Y(v[i])); ctx.stroke();
        }
      } else {
        ctx.lineWidth = sr.width || 1.25; ctx.strokeStyle = sr.color; ctx.setLineDash(sr.dash || []);
        ctx.beginPath(); let pen = false;
        for (let i = 0; i < v.length; i++) {
          if (v[i] == null) { pen = false; continue; }
          if (!pen) { ctx.moveTo(X(i), Y(v[i])); pen = true; } else ctx.lineTo(X(i), Y(v[i]));
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // diamonds (LLM judgments)
    if (opts.diamonds) for (const d of opts.diamonds) {
      const x = X(d.x), y = Y(d.y), r = 5;
      ctx.fillStyle = d.state === 'focused' ? css('--c-flow') : d.state === 'distracted' ? css('--c-low') : css('--muted');
      ctx.strokeStyle = css('--card'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // live strip chart: last 180 s of the running session
  const WINDOW = 180;
  function renderLive(s) {
    const cv = $('#live'); if (!cv) return;
    const all = s ? s.samples : [];
    const sm = all.slice(-WINDOW);
    const pad = WINDOW - sm.length;
    const fill = (fn) => Array(pad).fill(null).concat(sm.map(fn));
    const t0 = sm.length ? sm[0].t : 0;
    const xl = [];
    if (sm.length) {
      for (let i = 0; i < WINDOW; i++) {
        const t = t0 + i - pad;
        if (t >= 0 && t % 30 === 0) xl.push([i, Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')]);
      }
    }
    drawChart(cv, {
      n: WINDOW,
      series: [{ values: fill(x => x.score), style: 'band', width: 2.5 }],
      away: fill(x => x.away), calib: fill(x => x.calibrating), labels: fill(x => x.label), xlabels: xl,
    });
  }

  document.addEventListener('flowbeat:tick', (e) => { renderBreakdown(e.detail); renderLive(e.detail); });
  document.addEventListener('flowbeat:reset', () => { renderBreakdown(null); renderLive(null); });
  window.addEventListener('resize', () => { const d = window.FlowbeatDemo; renderLive(d && d.session); drawReplay(); });
  renderBreakdown(null); renderLive(null);

  // ------------------------------------------------------------------ replay of the repo's sample session
  // English renderings of the judge's Chinese reasons (translated for this page; the model answered in Chinese).
  const EN = {
    '手腕静止，心率平稳接近基线': 'Wrist still, heart rate steady near baseline',
    '心率大幅上升，动作频繁不规律': 'Heart rate up sharply, frequent irregular movement',
    '心率回落，动作平稳，符合专注特征': 'Heart rate back down, steady movement, consistent with focus',
    '心率飙升，动作频繁，静止率仅47%': 'Heart rate spiking, frequent movement, only 47% still',
    '心率回落，静止率较高，符合专注特征': 'Heart rate back down, mostly still, consistent with focus',
    '心率飙升，动作频繁，静止率低': 'Heart rate spiking, frequent movement, rarely still',
    '心率回落，静止率提升，动作平稳': 'Heart rate back down, more stillness, steady movement',
    '心率大幅飙升，动作频繁且静止率低': 'Heart rate surging, frequent movement, rarely still',
  };
  const S = window.FLOWBEAT_SAMPLE;
  let replay = null;
  if (S) {
    // Same procedure as test/port.test.js: FocusEngine(calibrationSeconds: 10) (simulator build), elapsed = i + 1,
    // setAway before tick (simulateSensors runs before engine.tick in FocusSession.tick).
    const e = new FocusEngine(10);
    const js = [], swift = [];
    let compared = 0, maxDiff = 0, mismatch = 0;
    S.samples.forEach((smp, i) => {
      e.setAway(!!smp.away, i + 1);
      const r = e.tick(i + 1, smp.heartRate == null ? null : smp.heartRate, smp.motion);
      const sw = smp.score == null ? null : smp.score;
      js.push(r.sampleScore); swift.push(sw);
      if ((sw == null) !== (r.sampleScore == null)) mismatch++;
      else if (sw != null) { compared++; maxDiff = Math.max(maxDiff, Math.abs(sw - r.sampleScore)); }
    });
    replay = { js, swift, compared, maxDiff, mismatch, baseline: e.baselineHR };
    const el = $('#replayStats');
    if (el) el.innerHTML =
      `<div><b>${compared}</b><span>scored seconds compared</span></div>` +
      `<div><b>${maxDiff === 0 ? '0' : maxDiff.toExponential(2)}</b><span>largest difference, Swift vs JS</span></div>` +
      `<div><b>${mismatch}</b><span>seconds scored by one side only</span></div>` +
      `<div><b>${replay.baseline.toFixed(1)}</b><span>baseline bpm (both)</span></div>`;
    renderJudgments();
  }
  function drawReplay() {
    if (!replay) return;
    const n = S.samples.length;
    const xl = []; for (let t = 0; t < n; t += 60) xl.push([t, (t / 60) + ' min']);
    drawChart($('#replay'), {
      n,
      series: [
        { values: replay.swift, style: 'band', width: 5 },
        { values: replay.js, style: 'thin', color: css('--ink'), width: 1.25, dash: [3, 3] },
      ],
      away: S.samples.map(x => !!x.away), calib: S.samples.map((x, i) => i < replay.swift.findIndex(v => v != null)),
      labels: S.samples.map(x => x.label || null), xlabels: xl,
      diamonds: (S.timeline || []).map(tl => ({ x: Math.min(n - 1, (tl.endSeconds || 0) - 1), y: tl.judgment.score, state: tl.judgment.state })),
    });
  }
  function renderJudgments() {
    const ul = $('#judgments'); if (!ul || !S.timeline) return;
    ul.innerHTML = S.timeline.map(tl => {
      const j = tl.judgment, t = Math.round(tl.endSeconds || tl.minute * 60);
      const st = j.state === 'focused' ? 'Focused' : j.state === 'distracted' ? 'Distracted' : j.state;
      return `<li><span class="t num">${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</span>` +
        `<span class="chip ${j.state}">${st} · ${j.score}</span>` +
        `<span class="reason"><span lang="en">${EN[j.reason] || ''}</span><span lang="zh-Hans">${j.reason}</span></span></li>`;
    }).join('');
  }
  drawReplay();
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', () => { drawReplay(); const d = window.FlowbeatDemo; renderLive(d && d.session); });
})();
