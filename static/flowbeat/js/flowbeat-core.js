/*
 * flowbeat-core.js: a line-by-line JavaScript port of Flowbeat's scoring logic.
 *
 * Source: https://github.com/xungirl/Flowbeat (ported from commit 0ea8963, 2026-11-19)
 *
 *   FocusScorer, RollingMean        FlowbeatCore/Sources/FlowbeatCore/FocusScorer.swift
 *   AwayTracker, FocusEngine,       FlowbeatCore/Sources/FlowbeatCore/FocusEngine.swift
 *   SessionStats.averageScore / focusedRatio
 *   SessionStats.focusThreshold /   FlowbeatCore/Sources/FlowbeatCore/SessionPlan.swift
 *   focusedSeconds / focusedMinutes / longestFocusStreak
 *   NudgeSettings, DistractionNudge FlowbeatCore/Sources/FlowbeatCore/DistractionNudge.swift
 *   simulateSensors()               Flowbeat/FocusSession.swift (FocusSession.simulateSensors,
 *                                   compiled only into simulator builds: "-demo" mode)
 *
 * Conventions: Swift `nil` is JS `null`. Constants are copied exactly; arithmetic is written
 * in the same order as the Swift code, so results match to the last bit (test/port.test.js
 * replays the repo's own simulator session and compares every recorded score).
 *
 * NOT ported: PersonalModel (on-device logistic regression, needs >= 8 labels of each kind),
 * PomodoroTimer, HRV, the LLM judge (backend). See the page for what is and isn't live.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlowbeatCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // FocusScorer.swift :: struct FocusScorer
  // ---------------------------------------------------------------------------

  /** FocusScorer.clamp(_:) -> min(max(x, 0), 1) */
  function clamp(x) { return Math.min(Math.max(x, 0), 1); }

  class FocusScorer {
    constructor(calibrationSeconds = 60) {
      this.calibrationSeconds = calibrationSeconds;
      /** public private(set) var baselineHR: Double? */
      this.baselineHR = null;
      this.calibrationHRs = [];
      this.smoothed = null;
    }

    /** mutating func addCalibrationHR(_ hr: Double) */
    addCalibrationHR(hr) { this.calibrationHRs.push(hr); }

    /** mutating func finishCalibration() -> Bool : median = sorted[count / 2] */
    finishCalibration() {
      if (this.calibrationHRs.length === 0) return false;
      const sorted = this.calibrationHRs.slice().sort((a, b) => a - b);
      this.baselineHR = sorted[Math.floor(sorted.length / 2)];
      return true;
    }

    /** static func motionPenalty(_ motion: Double) -> Double : 0...60 */
    static motionPenalty(motion) {
      return clamp((motion - FocusScorer.motionDeadZone) / FocusScorer.motionFullPenaltyRange) * FocusScorer.motionMaxPenalty;
    }

    /** static func hrPenalty(heartRate:baseline:) -> Double : 0...40, 0 without HR or baseline */
    static hrPenalty(heartRate, baseline) {
      if (heartRate == null || baseline == null) return 0;
      const hr = heartRate, base = baseline;
      return clamp((hr - base - FocusScorer.hrDeadZone) / FocusScorer.hrFullPenaltyRange) * FocusScorer.hrMaxPenalty;
    }

    /** static func rawScore(heartRate:motion:baseline:) -> Double (unsmoothed) */
    static rawScore(heartRate, motion, baseline) {
      return 100 - FocusScorer.motionPenalty(motion) - FocusScorer.hrPenalty(heartRate, baseline);
    }

    /** mutating func score(heartRate:motion:) -> Double : exponential smoothing, alpha 0.2 */
    score(heartRate, motion) {
      const raw = FocusScorer.rawScore(heartRate, motion, this.baselineHR);
      const next = this.smoothed != null ? this.smoothed + FocusScorer.alpha * (raw - this.smoothed) : raw;
      this.smoothed = next;
      return next;
    }
  }
  // Thresholds, copied exactly from FocusScorer.swift
  FocusScorer.alpha = 0.2;
  FocusScorer.motionDeadZone = 0.02;          // g, below this: no penalty
  FocusScorer.motionFullPenaltyRange = 0.13;  // g, deadZone + this = full penalty
  FocusScorer.motionMaxPenalty = 60.0;
  FocusScorer.hrDeadZone = 5.0;               // bpm above baseline: no penalty
  FocusScorer.hrFullPenaltyRange = 15.0;
  FocusScorer.hrMaxPenalty = 40.0;

  // ---------------------------------------------------------------------------
  // FocusScorer.swift :: struct RollingMean
  // (the watch feeds 25 Hz |userAcceleration| into RollingMean(capacity: 250) = last 10 s)
  // ---------------------------------------------------------------------------
  class RollingMean {
    constructor(capacity) {
      if (!(capacity > 0)) throw new Error('precondition failed: capacity > 0');
      this.capacity = capacity;
      this.values = [];
    }
    get count() { return this.values.length; }
    get mean() { return this.values.length === 0 ? 0 : this.values.reduce((a, b) => a + b, 0) / this.values.length; }
    append(x) {
      this.values.push(x);
      if (this.values.length > this.capacity) this.values.splice(0, this.values.length - this.capacity);
    }
    reset() { this.values = []; }
  }

  // ---------------------------------------------------------------------------
  // FocusEngine.swift :: struct AwayTracker
  // ---------------------------------------------------------------------------
  class AwayTracker {
    constructor(recoverySeconds = 60) {
      this.isAway = false;
      this.awayCount = 0;
      this.awaySeconds = 0;
      this.awayEndedAt = null;
      this.recoverySeconds = recoverySeconds;
    }
    /** @returns whether the state really changed */
    set(away, elapsed) {
      if (away === this.isAway) return false;
      this.isAway = away;
      if (away) this.awayCount += 1;
      else this.awayEndedAt = elapsed;
      return true;
    }
    /** just sat back down and still inside the HR recovery window? */
    isRecovering(elapsed) {
      if (this.isAway || this.awayEndedAt == null) return false;
      return elapsed - this.awayEndedAt < this.recoverySeconds;
    }
    addAwaySecond() { this.awaySeconds += 1; }
  }

  // ---------------------------------------------------------------------------
  // FocusEngine.swift :: struct FocusEngine (calibrate -> score, paused while away)
  // ---------------------------------------------------------------------------
  class FocusEngine {
    constructor(calibrationSeconds = 60, recoverySeconds = 60) {
      this.phase = 'calibrating';           // .calibrating | .running
      this.scorer = new FocusScorer(calibrationSeconds);
      this.away = new AwayTracker(recoverySeconds);
      /** score shown on the ring (keeps the last value while away) */
      this.score = null;
    }
    get baselineHR() { return this.scorer.baselineHR; }
    get calibrationSeconds() { return this.scorer.calibrationSeconds; }

    setAway(isAway, elapsed) { return this.away.set(isAway, elapsed); }

    /** mutating func tick(elapsed:heartRate:motion:) -> Tick */
    tick(elapsed, heartRate, motion) {
      let finished = false;
      switch (this.phase) {
        case 'calibrating':
          // HR while walking is not a resting baseline
          if (heartRate != null && !this.away.isAway) this.scorer.addCalibrationHR(heartRate);
          if (elapsed >= this.scorer.calibrationSeconds && this.scorer.finishCalibration()) {
            this.phase = 'running';
            finished = true;
          }
          break;
        case 'running':
          if (this.away.isAway) {
            this.away.addAwaySecond();      // away: not scored, not counted in the focus ratio
          } else {
            const recovering = this.away.isRecovering(elapsed);
            this.score = this.scorer.score(recovering ? null : heartRate, motion);
          }
          break;
      }
      const scored = this.phase === 'running' && !this.away.isAway && !finished;
      return { sampleScore: scored ? this.score : null, didFinishCalibration: finished };
    }
  }

  // ---------------------------------------------------------------------------
  // FocusEngine.swift + SessionPlan.swift :: enum SessionStats
  // samples: [{ score: number|null, ... }]
  // ---------------------------------------------------------------------------
  const SessionStats = {
    focusThreshold: 70.0,
    averageScore(samples) {
      const s = samples.map(x => x.score).filter(v => v != null);
      return s.length === 0 ? null : s.reduce((a, b) => a + b, 0) / s.length;
    },
    focusedRatio(samples, threshold = 70) {
      const s = samples.map(x => x.score).filter(v => v != null);
      return s.length === 0 ? null : s.filter(v => v >= threshold).length / s.length;
    },
    focusedSeconds(samples, threshold = SessionStats.focusThreshold) {
      return samples.filter(x => (x.score != null ? x.score : -1) >= threshold).length;
    },
    focusedMinutes(samples, threshold = SessionStats.focusThreshold) {
      return Math.floor(SessionStats.focusedSeconds(samples, threshold) / 60);
    },
    longestFocusStreak(samples, threshold = SessionStats.focusThreshold) {
      let best = 0, run = 0;
      for (const s of samples) {
        if (s.score != null && s.score >= threshold) { run += 1; best = Math.max(best, run); }
        else run = 0;
      }
      return best;
    },
  };

  // ---------------------------------------------------------------------------
  // DistractionNudge.swift :: NudgeSettings + DistractionNudge
  // ---------------------------------------------------------------------------
  function clampInt(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  class NudgeSettings {
    constructor({ enabled = true, distractedMinutes = 3, cooldownMinutes = 10 } = {}) {
      this.enabled = enabled;
      this.distractedMinutes = clampInt(distractedMinutes, 1, 15);   // distractedMinutesRange 1...15
      this.cooldownMinutes = clampInt(cooldownMinutes, 3, 60);       // cooldownMinutesRange 3...60
    }
  }

  class DistractionNudge {
    constructor(settings = new NudgeSettings(), threshold = DistractionNudge.defaultThreshold,
                graceSeconds = DistractionNudge.defaultGraceSeconds) {
      this.settings = settings;
      this.threshold = threshold;
      this.graceSeconds = graceSeconds;
      this.distractedSince = null;
      this.recoveredSince = null;
      this.lastNudgeAt = null;
      this.nudgeCount = 0;
    }
    distractedSeconds(elapsed) { return this.distractedSince != null ? elapsed - this.distractedSince : 0; }

    /** input: { elapsed, score, calibrating, away, onBreak } -> should the watch tap now? */
    update(input) {
      const score = input.score;
      if (!this.settings.enabled || input.calibrating || input.away || input.onBreak || score == null) {
        this.distractedSince = null;
        this.recoveredSince = null;
        return false;
      }
      const t = input.elapsed;
      if (score < this.threshold) {
        this.recoveredSince = null;
        if (this.distractedSince == null) this.distractedSince = t;
      } else if (this.distractedSince != null) {
        if (this.recoveredSince == null) this.recoveredSince = t;
        if (this.recoveredSince != null && t - this.recoveredSince >= this.graceSeconds) {
          this.distractedSince = null;
          this.recoveredSince = null;
        }
        return false;   // inside the grace period: no nudge, but no reset either
      }
      const since = this.distractedSince;
      if (since == null || !(t - since >= this.settings.distractedMinutes * 60)) return false;
      if (this.lastNudgeAt != null && t - this.lastNudgeAt < this.settings.cooldownMinutes * 60) return false;
      this.lastNudgeAt = t;
      this.nudgeCount += 1;
      this.distractedSince = t;
      return true;
    }
  }
  DistractionNudge.defaultThreshold = 40.0;
  DistractionNudge.defaultGraceSeconds = 15;

  // ---------------------------------------------------------------------------
  // Flowbeat/FocusSession.swift :: simulateSensors()  (simulator "-demo" mode only)
  // "After calibration, a 60 s loop of fake data: focused 35 s -> distracted 10 s -> walking 15 s."
  // ctx: { elapsed, calibrationSeconds, setAway(bool), heartRate, motion, steps }; mutated in place.
  // rand: () => [0, 1). Double.random(in: a...b) is approximated as a + rand() * (b - a) (uniform)
  // ---------------------------------------------------------------------------
  function randomIn(rand, a, b) { return a + rand() * (b - a); }

  function simulateSensors(ctx, rand = Math.random) {
    const afterCalibration = ctx.elapsed - ctx.calibrationSeconds;
    const t = afterCalibration > 0 ? afterCalibration % 60 : 0;   // truncatingRemainder(dividingBy: 60)
    let segment;
    if (t >= 45) {          // case 45...: walking
      ctx.setAway(true);
      ctx.heartRate = 95 + randomIn(rand, -3, 3);
      ctx.motion = randomIn(rand, 0.18, 0.30);
      ctx.steps += 2;
      segment = 'walking';
    } else if (t >= 35) {   // case 35...: seated but distracted (fidgeting, phone)
      ctx.setAway(false);
      ctx.heartRate = 86 + randomIn(rand, -2, 2);
      ctx.motion = randomIn(rand, 0.08, 0.18);
      segment = 'distracted';
    } else {                // default: focused
      ctx.setAway(false);
      ctx.heartRate = 70 + randomIn(rand, -2, 2);
      ctx.motion = randomIn(rand, 0, 0.02);
      segment = 'focused';
    }
    return { segment, cycleSecond: t };
  }

  return {
    clamp, FocusScorer, RollingMean, AwayTracker, FocusEngine, SessionStats,
    NudgeSettings, DistractionNudge, simulateSensors,
  };
});
