/*
 * app.js: the web watch. A re-creation of Flowbeat's watch UI (Flowbeat/ContentView.swift: StartView,
 * RunningView -> MetricsPage + ControlsPage, SummaryView) driven by a port of FocusSession.tick()
 * (Flowbeat/FocusSession.swift). All scoring goes through js/flowbeat-core.js; nothing here computes a score.
 */
(function () {
  'use strict';
  const { FocusScorer, RollingMean, FocusEngine, SessionStats, DistractionNudge, simulateSensors } = window.FlowbeatCore;

  // ------------------------------------------------------------------ palette (sampled from the simulator screenshots)
  const C = {
    mint: '#00F5EA', cyan: '#5AC8FA', yellow: '#FFD60A', orange: '#FF9F0A', pink: '#FF375F',
    blue: '#0A84FF', gray: '#8E8E93', red: '#FF453A', indigo: '#5E5CE6', white: '#FFFFFF',
  };
  // ContentView.swift :: enum Theme
  const Theme = {
    flow: [C.mint, C.cyan],
    colors(score) {
      if (score == null) return [C.gray, C.gray];
      if (score >= 70) return Theme.flow;
      if (score >= 40) return [C.yellow, C.orange];
      return [C.orange, C.pink];
    },
    color(score) { return Theme.colors(score)[0]; },
  };
  function timeString(t) {   // ContentView.swift :: timeString(_:)
    const s = Math.trunc(t);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  const swiftInt = (x) => Math.trunc(x);   // Swift Int(Double) truncates toward zero

  // ------------------------------------------------------------------ SF Symbol stand-ins (simple SVG)
  const I = {
    ecg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 12.5 6 12.5 8.6 5 12.6 19.5 15.6 8.5 17.6 12.5 22.5 12.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    walk: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.2-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>',
    brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><path d="M13 2.8a7 7 0 0 0-7.2 7c0 2 .8 3.7 2.2 5V21h7.2v-3h2.3a1.8 1.8 0 0 0 1.8-1.8V13h1.6l-1.7-3.2A7 7 0 0 0 13 2.8z"/><path d="M10.5 8.2a1.9 1.9 0 0 1 3.3-1 1.8 1.8 0 0 1 2.4 2.2 1.8 1.8 0 0 1-1 3.1h-3.4a1.7 1.7 0 0 1-1.3-2.9 1.9 1.9 0 0 1 0-1.4z"/></svg>',
    fog: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 13.4a4 4 0 0 1-.3-7.95A5.6 5.6 0 0 1 16.9 5.9a3.8 3.8 0 0 1 .6 7.5z"/><rect x="3" y="15.4" width="18" height="2.2" rx="1.1"/><rect x="5.5" y="19.2" width="13" height="2.2" rx="1.1"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 6.5V12l3.5 2.2" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 3l1.9 5.9L18 11l-6.1 2.1L10 19l-1.9-5.9L2 11l6.1-2.1z"/><path d="M18.5 2l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8zM18 15.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>',
    shoe: '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="8" cy="9" rx="3.2" ry="5.2" transform="rotate(-12 8 9)"/><ellipse cx="7.2" cy="18.6" rx="2.6" ry="1.9"/><ellipse cx="16.5" cy="7" rx="3.2" ry="5.2" transform="rotate(12 16.5 7)"/><ellipse cx="17.4" cy="16.5" rx="2.6" ry="1.9"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13.5" r="8"/><path d="M12 13.5V9M9.5 2.5h5"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="12" width="4.5" height="9" rx="1"/><rect x="9.75" y="4" width="4.5" height="17" rx="1"/><rect x="16.5" y="8" width="4.5" height="13" rx="1"/></svg>',
  };

  // ------------------------------------------------------------------ the session (port of FocusSession.tick)
  const SIM_CALIBRATION = 10;   // FocusSession.beginSession: simulator build uses FocusEngine(calibrationSeconds: 10)
  const settings = { source: 'demo', speed: 1, calibration: SIM_CALIBRATION };
  const manual = { hr: 70, motion: 0.01, walking: false };

  class WebSession {
    constructor(calibrationSeconds) {
      this.engine = new FocusEngine(calibrationSeconds);
      this.motionWindow = new RollingMean(25 * 10);   // motionHz 25, "last 10 s" (FocusSession.motionWindow)
      this.nudge = new DistractionNudge();
      this.phase = 'calibrating';
      this.samples = [];
      this.heartRate = null; this.motion = 0; this.score = null; this.elapsed = 0;
      this.isAway = false; this.awayCount = 0; this.awaySeconds = 0; this.steps = 0;
      this.nudgeCount = 0; this.lastNudgeAt = null; this.focusedSeconds = 0;
      this.pendingLabel = null; this.segment = null; this.cycleSecond = 0; this.trace = null;
      this.usedPedometer = false;
    }
    get calibrationSeconds() { return this.engine.calibrationSeconds; }
    syncAway() {
      this.isAway = this.engine.away.isAway; this.awayCount = this.engine.away.awayCount;
      this.awaySeconds = this.engine.away.awaySeconds;
    }
    setAway(away) { if (this.engine.setAway(away, this.elapsed)) this.syncAway(); }
    mark(label) { this.pendingLabel = label; }

    /** One second. Same order as FocusSession.tick(). */
    tick() {
      this.elapsed += 1;
      if (settings.source === 'manual') {
        // Visitor = the sensors. Slider = instantaneous |userAcceleration| at 25 Hz -> RollingMean -> 10 s mean;
        // the "walking" switch stands in for CMMotionActivityManager's walking/stationary events.
        for (let i = 0; i < 25; i++) this.motionWindow.append(manual.motion);
        this.setAway(manual.walking);
        this.motion = this.motionWindow.mean;
        this.heartRate = manual.hr;
        this.segment = null;
      } else {
        this.motion = this.motionWindow.mean;
        const ctx = { elapsed: this.elapsed, calibrationSeconds: this.calibrationSeconds, setAway: (a) => this.setAway(a),
                      heartRate: this.heartRate, motion: this.motion, steps: this.steps };
        const r = simulateSensors(ctx);   // the repo's simulator demo cycle
        this.heartRate = ctx.heartRate; this.motion = ctx.motion; this.steps = ctx.steps;
        this.segment = r.segment; this.cycleSecond = r.cycleSecond; this.usedPedometer = true;
      }

      // For the "what the algorithm sees" panel only: the same inputs FocusEngine.tick is about to use.
      const e = this.engine;
      const willScore = e.phase === 'running' && !e.away.isAway;
      const recovering = e.away.isRecovering(this.elapsed);
      const hrUsed = recovering ? null : this.heartRate;

      const result = e.tick(this.elapsed, this.heartRate, this.motion);
      if (result.didFinishCalibration) this.phase = 'running';
      this.score = e.score;
      const sampleScore = result.sampleScore;
      this.syncAway();

      const nudgeInput = { elapsed: this.elapsed, score: sampleScore, calibrating: this.phase === 'calibrating',
                           away: this.isAway, onBreak: false };
      if (this.nudge.update(nudgeInput)) {
        this.nudgeCount = this.nudge.nudgeCount; this.lastNudgeAt = this.elapsed; haptic();
      }
      if (sampleScore != null && sampleScore >= SessionStats.focusThreshold) this.focusedSeconds += 1;

      this.samples.push({ t: this.elapsed, heartRate: this.heartRate, motion: this.motion, score: sampleScore,
                          label: this.pendingLabel, away: this.isAway, calibrating: this.phase === 'calibrating' });
      this.pendingLabel = null;

      this.trace = {
        phase: this.phase, finished: result.didFinishCalibration, scored: willScore && sampleScore != null,
        away: this.isAway, recovering: willScore && recovering, hr: this.heartRate, hrUsed: willScore ? hrUsed : null,
        motion: this.motion, baseline: e.baselineHR,
        motionPenalty: willScore ? FocusScorer.motionPenalty(this.motion) : null,
        hrPenalty: willScore ? FocusScorer.hrPenalty(hrUsed, e.baselineHR) : null,
        raw: willScore ? FocusScorer.rawScore(hrUsed, this.motion, e.baselineHR) : null,
        score: this.score, sampleScore,
      };
    }
    // FocusSession computed properties used by SummaryView
    get averageScore() { return SessionStats.averageScore(this.samples); }
    get focusedRatio() { return SessionStats.focusedRatio(this.samples); }
    get focusedMinutes() { return Math.floor(this.focusedSeconds / 60); }
    get longestStreakSeconds() { return SessionStats.longestFocusStreak(this.samples); }
  }

  // ------------------------------------------------------------------ ring (ContentView.swift :: struct Ring)
  class RingView {
    constructor(canvas, size, lineWidth) {
      this.canvas = canvas; this.size = size; this.lw = lineWidth; this.pad = 14;
      this.from = 0; this.to = 0; this.t0 = 0; this.dur = 800; this.colors = [C.gray, C.gray];
      this.shown = 0; this.raf = null;
      const total = size + this.pad * 2;
      canvas.style.width = total + 'px'; canvas.style.height = total + 'px';
      canvas.style.left = (-this.pad) + 'px'; canvas.style.top = (-this.pad) + 'px';
    }
    resize(scale) {
      const dpr = window.devicePixelRatio || 1;
      const total = this.size + this.pad * 2;
      this.px = total * scale * dpr;
      this.canvas.width = Math.round(this.px); this.canvas.height = Math.round(this.px);
      this.scale = scale * dpr; this.draw(this.shown);
    }
    set(progress, colors, animate = true) {
      const p = Math.max(0.001, Math.min(progress, 1));
      this.colors = colors;
      if (!animate) { this.to = p; this.shown = p; this.draw(p); return; }
      if (Math.abs(p - this.to) < 1e-6) { this.draw(this.shown); return; }
      this.from = this.shown; this.to = p; this.t0 = performance.now();
      this.dur = 800 / Math.max(1, settings.speed / 1.5);
      if (!this.raf) this.raf = requestAnimationFrame(() => this.frame());
    }
    frame() {
      const k = Math.min(1, (performance.now() - this.t0) / this.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // easeInOut
      this.shown = this.from + (this.to - this.from) * e;
      this.draw(this.shown);
      this.raf = k < 1 ? requestAnimationFrame(() => this.frame()) : null;
    }
    draw(progress) {
      const ctx = this.canvas.getContext('2d'); if (!ctx || !this.scale) return;
      const s = this.scale, c = (this.size / 2 + this.pad) * s, r = (this.size / 2) * s, lw = this.lw * s;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
      const start = -Math.PI / 2, end = start + Math.PI * 2 * progress;
      let style;
      if (ctx.createConicGradient) {
        style = ctx.createConicGradient(start, c, c);
        const stops = this.colors.concat([this.colors[0]]);
        stops.forEach((col, i) => style.addColorStop(i / (stops.length - 1), col));
      } else style = this.colors[0];
      ctx.save();
      ctx.shadowColor = hexA(this.colors[0], 0.5); ctx.shadowBlur = 12 * s;
      ctx.strokeStyle = style;
      ctx.beginPath(); ctx.arc(c, c, r, start, end); ctx.stroke();
      ctx.restore();
    }
  }
  function hexA(hex, a) {
    if (hex.startsWith('rgba')) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ------------------------------------------------------------------ DOM
  const $ = (s, el = document) => el.querySelector(s);
  const screen = $('#screen');
  const watchEl = $('#watch');
  let session = null;
  let view = 'start';      // start | running | summary
  let page = 0;            // RunningView vertical page
  let timer = null;
  let marked = null, markedTimer = null;

  screen.innerHTML = `
    <div class="clock" id="clock">--:--</div>
    <section class="v v-start" data-view="start">
      <div class="scroll">
        <div class="breathe"><div class="breathe-ring"></div><span class="ic ecg">${I.ecg}</span></div>
        <div class="brand"><div class="t2">Flowbeat</div><div class="caps">FLOWBEAT</div></div>
        <button class="wbtn prominent" id="startBtn"><span class="ic">${I.play}</span>Start Focus</button>
        <a class="wbtn row indigo" href="#screens" title="Pomodoro is not part of the web demo: see the simulator screenshot below">
          <span class="ic">${I.timer}</span><span class="two"><span>Pomodoro</span><small>25 / 5 min</small></span></a>
        <a class="wbtn row" href="#screens" title="History is not part of the web demo: see the simulator screenshot below">
          <span class="ic mint">${I.chart}</span><span class="two"><span>History</span><small>Screenshots below</small></span></a>
      </div>
    </section>
    <section class="v v-running" data-view="running">
      <div class="toolbar-time" id="elapsed">00:00</div>
      <div class="dots" id="dots"><button aria-label="Metrics page" data-p="0"></button><button aria-label="Controls page" data-p="1"></button></div>
      <div class="pager" id="pager">
        <div class="page metrics">
          <div class="ring-wrap" id="ringWrap">
            <canvas id="ring"></canvas>
            <div class="ring-center" id="ringCenter"></div>
          </div>
          <div class="hrrow">
            <span class="hr"><span class="ic heart pulse">${I.heart}</span><span id="hrv" class="num">--</span><small>BPM</small></span>
            <span class="motion" id="motion"></span>
          </div>
          <div class="capsule-slot" id="capsule"></div>
        </div>
        <div class="page controls">
          <div class="ask" id="ask">How are you right now?</div>
          <div class="labels">
            <button class="wbtn tint mint" data-label="focused"><span class="ic">${I.brain}</span><small>Focused</small></button>
            <button class="wbtn tint orange" data-label="distracted"><span class="ic">${I.fog}</span><small>Distracted</small></button>
          </div>
          <button class="wbtn tint red end" id="endBtn"><span class="ic">${I.stop}</span>End</button>
        </div>
      </div>
    </section>
    <section class="v v-summary" data-view="summary">
      <div class="scroll" id="summaryScroll">
        <h3 class="navtitle">Summary</h3>
        <div class="ring-wrap small"><canvas id="ring2"></canvas><div class="ring-center" id="ring2Center"></div></div>
        <div class="card" id="stats"></div>
        <button class="wbtn prominent done" id="doneBtn">Done</button>
      </div>
    </section>`;

  const ring = new RingView($('#ring'), 104, 11);
  const ring2 = new RingView($('#ring2'), 96, 9);

  function currentScale() {
    return parseFloat(getComputedStyle(watchEl).getPropertyValue('--k')) || 1;
  }
  function onResize() { const k = currentScale(); ring.resize(k); ring2.resize(k); }
  window.addEventListener('resize', onResize);

  function setView(v) {
    view = v;
    screen.querySelectorAll('.v').forEach(el => { el.hidden = el.dataset.view !== v; });
    screen.dataset.view = v;
    if (v === 'running') setPage(0);
    paintBackground();
  }
  function setPage(p) {
    page = Math.max(0, Math.min(1, p));
    $('#pager').style.transform = `translateY(${-page * 248}px)`;
    $('#dots').querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === page));
    paintBackground();
  }

  // containerBackground(color.gradient.opacity(0.28)): sampled ~0.14 alpha at the top, ~0.04 at the bottom
  function paintBackground() {
    let col;
    if (view === 'start') col = C.mint;
    else if (view === 'summary') col = Theme.color(session ? session.averageScore : null);
    else if (page === 1) col = C.gray;
    else if (!session) col = C.gray;
    else if (session.isAway) col = C.cyan;
    else if (session.phase === 'calibrating') col = C.gray;
    else col = Theme.color(session.score);
    const a1 = view === 'start' || view === 'summary' ? 0.12 : 0.14;
    screen.style.background = `linear-gradient(180deg, ${hexA(col, a1)} 0%, ${hexA(col, 0.035)} 100%), #000`;
  }

  function start() {
    stop();
    session = new WebSession(settings.calibration);
    setView('running');
    ring.set(0.001, [C.white, C.white], false);
    renderRunning();
    schedule();
    document.dispatchEvent(new CustomEvent('flowbeat:tick', { detail: session }));
  }
  function schedule() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!session || view !== 'running') return;
      session.tick();
      renderRunning();
      document.dispatchEvent(new CustomEvent('flowbeat:tick', { detail: session }));
    }, 1000 / settings.speed);
  }
  function stop() { clearInterval(timer); timer = null; }
  function end() { stop(); setView('summary'); renderSummary(); document.dispatchEvent(new CustomEvent('flowbeat:end', { detail: session })); }

  // ------------------------------------------------------------------ MetricsPage
  function renderRunning() {
    const s = session;
    // toolbar: elapsed time, colored by state (RunningView.stateColor)
    const el = $('#elapsed');
    el.textContent = timeString(s.elapsed);
    el.style.color = s.isAway ? C.cyan : (s.phase === 'calibrating' ? C.white : Theme.color(s.score));

    const center = $('#ringCenter');
    let key;
    if (s.isAway) {
      key = 'away';
      ring.set(1, [C.cyan, C.blue]);
      if (center.dataset.key !== key) center.innerHTML =
        `<span class="ic walk pulse" style="color:${C.cyan}">${I.walk}</span><div class="fn semi">Away</div><div class="cap9">Resumes when you sit</div>`;
    } else if (s.phase === 'calibrating') {
      key = 'cal';
      const left = Math.max(0, swiftInt(s.calibrationSeconds - s.elapsed));
      ring.set(s.elapsed / s.calibrationSeconds, ['rgba(255,255,255,0.5)', C.white]);
      if (center.dataset.key !== key) center.innerHTML = `<div class="big40 num" id="calLeft"></div><div class="cap10">Calibrating · sit still</div>`;
      $('#calLeft').textContent = String(left);
    } else {
      key = 'score';
      ring.set((s.score == null ? 0 : s.score) / 100, Theme.colors(s.score));
      if (center.dataset.key !== key) center.innerHTML = `<div class="big44 num" id="scoreNum"></div><div class="cap10 med" id="stateText"></div>`;
      const n = $('#scoreNum');
      n.textContent = s.score == null ? '--' : String(swiftInt(s.score));
      n.style.color = Theme.color(s.score);
      $('#stateText').textContent = s.score == null ? 'Focus score' : (s.score >= 70 ? 'In flow' : (s.score >= 40 ? 'A bit distracted' : 'Off track'));
    }
    center.dataset.key = key;

    $('#hrv').textContent = s.heartRate == null ? '--' : String(swiftInt(s.heartRate));
    // MotionIndicator
    const level = s.motion < 0.03 ? 1 : (s.motion < 0.10 ? 2 : 3);
    const mcol = [C.mint, C.yellow, C.orange][level - 1];
    const bars = [1, 2, 3].map(i => `<i style="height:${4 + i * 3}px;background:${i <= level ? mcol : 'rgba(255,255,255,.2)'}"></i>`).join('');
    $('#motion').innerHTML = `<span class="bars">${bars}</span><span style="color:${mcol}">${['Still', 'Slight', 'Active'][level - 1]}</span>`;

    // NudgeBanner for 8 s after a nudge (MetricsPage.showNudgeBanner)
    const showNudge = s.lastNudgeAt != null && s.elapsed - s.lastNudgeAt < 8;
    $('#capsule').innerHTML = showNudge ? `<span class="nudge"><span class="ic">${I.hand}</span>Drifting? Back to it</span>` : '';
    paintBackground();
  }

  // ------------------------------------------------------------------ SummaryView
  function renderSummary() {
    const s = session;
    const avg = s.averageScore;
    ring2.set((avg == null ? 0 : avg) / 100, Theme.colors(avg), false);
    $('#ring2Center').innerHTML = `<div class="big34 num" style="color:${Theme.color(avg)}">${avg == null ? '--' : swiftInt(avg)}</div><div class="cap10">Average focus</div>`;
    const ratio = s.focusedRatio;
    const rows = [
      [I.clock, C.white, 'Duration', timeString(s.elapsed)],
      [I.sparkles, C.mint, 'Time in flow', ratio == null ? '--' : swiftInt(ratio * 100) + '%'],
      [I.brain, C.mint, 'Focused', s.focusedMinutes + ' min'],
      [I.flame, C.orange, 'Longest streak', timeString(s.longestStreakSeconds)],
      [I.walk, C.cyan, 'Away', `${s.awayCount}× · ${timeString(s.awaySeconds)}`],
      [I.shoe, C.orange, 'Steps', s.usedPedometer ? String(s.steps) : '--'],
    ];
    if (s.nudgeCount > 0) rows.push([I.hand, C.yellow, 'Nudges', String(s.nudgeCount)]);
    $('#stats').innerHTML = rows.map(([ic, col, k, v]) =>
      `<div class="stat"><span class="ic" style="color:${col}">${ic}</span><span class="k">${k}</span><span class="val num">${v}</span></div>`).join('');
    $('#summaryScroll').scrollTop = 0;
    paintBackground();
  }

  // ------------------------------------------------------------------ ControlsPage
  screen.addEventListener('click', (ev) => {
    const lb = ev.target.closest('[data-label]');
    if (lb && session) {
      const tag = lb.dataset.label;
      session.mark(tag); marked = tag; haptic(true);
      $('#ask').textContent = tag === 'focused' ? 'Marked: Focused' : 'Marked: Distracted';
      $('#ask').classList.add('on');
      clearTimeout(markedTimer);
      markedTimer = setTimeout(() => { if (marked === tag) { marked = null; $('#ask').textContent = 'How are you right now?'; $('#ask').classList.remove('on'); } }, 1500);
    }
    const dot = ev.target.closest('[data-p]');
    if (dot) setPage(+dot.dataset.p);
  });
  $('#startBtn').addEventListener('click', start);
  $('#endBtn').addEventListener('click', end);
  $('#doneBtn').addEventListener('click', () => { session = null; setView('start'); document.dispatchEvent(new CustomEvent('flowbeat:reset')); });

  // vertical paging: wheel, swipe, arrow keys
  let wheelLock = 0;
  screen.addEventListener('wheel', (ev) => {
    if (view !== 'running') return;
    ev.preventDefault();
    const now = performance.now(); if (now - wheelLock < 450 || Math.abs(ev.deltaY) < 8) return;
    wheelLock = now; setPage(page + (ev.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  let touchY = null;
  screen.addEventListener('touchstart', (ev) => { touchY = ev.touches[0].clientY; }, { passive: true });
  screen.addEventListener('touchmove', (ev) => { if (view === 'running') ev.preventDefault(); }, { passive: false });
  screen.addEventListener('touchend', (ev) => {
    if (touchY == null || view !== 'running') return;
    const dy = ev.changedTouches[0].clientY - touchY; touchY = null;
    if (Math.abs(dy) > 24) setPage(page + (dy < 0 ? 1 : -1));
  });
  watchEl.addEventListener('keydown', (ev) => {
    if (view !== 'running') return;
    if (ev.key === 'ArrowDown') { setPage(1); ev.preventDefault(); }
    if (ev.key === 'ArrowUp') { setPage(0); ev.preventDefault(); }
  });
  $('#crown').addEventListener('click', () => { if (view === 'running') setPage(page ? 0 : 1); });

  function haptic(light) {
    watchEl.classList.remove('tap', 'tap-light'); void watchEl.offsetWidth;
    watchEl.classList.add(light ? 'tap-light' : 'tap');
  }

  function tickClock() {
    const d = new Date();
    $('#clock').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  tickClock(); setInterval(tickClock, 5000);

  // ------------------------------------------------------------------ panel controls (outside the watch)
  document.querySelectorAll('[data-source]').forEach(b => b.addEventListener('click', () => {
    settings.source = b.dataset.source;
    document.querySelectorAll('[data-source]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    document.body.dataset.source = settings.source;
    if (!session || view !== 'running') start();
  }));
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
    settings.speed = +b.dataset.speed;
    document.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (timer) schedule();
  }));
  document.querySelectorAll('[data-cal]').forEach(b => b.addEventListener('click', () => {
    settings.calibration = +b.dataset.cal;
    document.querySelectorAll('[data-cal]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    start();
  }));
  $('#restart').addEventListener('click', start);
  const hrIn = $('#inHr'), mIn = $('#inMotion'), wIn = $('#inWalk');
  function readManual() {
    manual.hr = +hrIn.value; manual.motion = +mIn.value; manual.walking = wIn.checked;
    $('#inHrVal').textContent = manual.hr + ' bpm';
    $('#inMotionVal').textContent = manual.motion.toFixed(3) + ' g';
  }
  [hrIn, mIn, wIn].forEach(x => x.addEventListener('input', readManual));
  readManual();
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const p = { calm: [70, 0.01, false], typing: [72, 0.045, false], fidget: [86, 0.13, false], walk: [96, 0.24, true] }[b.dataset.preset];
    hrIn.value = p[0]; mIn.value = p[1]; wIn.checked = p[2]; readManual();
  }));

  // expose for the explainer panel
  window.FlowbeatDemo = { Theme, C, timeString, get session() { return session; } };

  // ------------------------------------------------------------------ boot: like the simulator's -demo flag, auto-start
  setView('start');
  onResize();
  document.body.dataset.source = settings.source;
  const autostart = setTimeout(() => { if (view === 'start' && !session) start(); }, 1600);
  $('#startBtn').addEventListener('click', () => clearTimeout(autostart));
})();
