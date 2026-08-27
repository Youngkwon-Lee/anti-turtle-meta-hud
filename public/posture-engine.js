(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AntiTurtleEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var DEFAULTS = {
    cautionAt: 8,
    badAt: 15,
    badHoldMs: 3000,
    maxGapMs: 1000,
  };

  function finiteNumber(value, label) {
    var number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(label + ' must be a finite number');
    return number;
  }

  function classifyDeviation(deviation, options) {
    var value = Math.abs(finiteNumber(deviation, 'deviation'));
    if (value < options.cautionAt) return 'GOOD';
    if (value <= options.badAt) return 'CAUTION';
    return 'BAD';
  }

  function postureAnimationFrame(deviation, totalFrames, maxDeviation) {
    var value = Math.abs(finiteNumber(deviation, 'deviation'));
    var frames = Math.max(1, Math.round(finiteNumber(totalFrames, 'totalFrames')));
    var maximum = maxDeviation === undefined
      ? 25
      : Math.max(1, finiteNumber(maxDeviation, 'maxDeviation'));
    return Math.round(Math.min(maximum, value) / maximum * (frames - 1));
  }

  function signedPostureAnimationFrame(signedDeviation, totalFrames, maxDeviation) {
    var value = finiteNumber(signedDeviation, 'signedDeviation');
    var frames = Math.max(1, Math.round(finiteNumber(totalFrames, 'totalFrames')));
    var maximum = maxDeviation === undefined
      ? 25
      : Math.max(1, finiteNumber(maxDeviation, 'maxDeviation'));
    var midpoint = (frames - 1) / 2;
    var bounded = Math.max(-maximum, Math.min(maximum, value));
    return Math.round(midpoint + (bounded / maximum) * midpoint);
  }

  // Meta Display glasses report beta increasing during backward extension.
  // The HUD visual axis uses forward flexion as positive, so invert only the
  // presentation direction while preserving the raw and calibrated values.
  function postureVisualDeviation(signedDeviation) {
    return -finiteNumber(signedDeviation, 'signedDeviation');
  }

  function median(values) {
    var sorted = values.slice().sort(function (left, right) { return left - right; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function createHeadCalibrator(overrides) {
    var options = Object.assign({
      warmupMs: 300,
      sampleMs: 3000,
      // DeviceOrientation is commonly delivered at about 5 Hz on the glasses.
      // Ten samples still rejects sparse/noisy holds while allowing the
      // three-second continuous window to complete at that delivery rate.
      minSamples: 10,
      maxRangeDeg: 2.5,
      maxStepDeg: 1.2,
      maxGapMs: 2000,
    }, overrides || {});
    var startedAt = null;
    var stableStartedAt = null;
    var samples = [];
    var lastPitch = null;
    var lastAt = null;

    function result(status, elapsedMs, ready) {
      var stableElapsedMs = stableStartedAt === null
        ? 0
        : Math.max(0, elapsedMs - (stableStartedAt - startedAt));
      var timeProgress = options.sampleMs > 0
        ? Math.min(1, stableElapsedMs / options.sampleMs)
        : 1;
      var sampleProgress = options.minSamples > 0
        ? Math.min(1, samples.length / options.minSamples)
        : 1;
      var rangeDeg = samples.length
        ? Math.max.apply(null, samples) - Math.min.apply(null, samples)
        : 0;
      return {
        ready: ready,
        status: status,
        baseline: ready ? median(samples) : null,
        sampleCount: samples.length,
        elapsedMs: elapsedMs,
        stableElapsedMs: stableElapsedMs,
        progress: Math.min(timeProgress, sampleProgress),
        rangeDeg: rangeDeg,
      };
    }

    return {
      add: function (value, at) {
        var pitch = finiteNumber(value, 'headPitch');
        var timestamp = at === undefined ? Date.now() : finiteNumber(at, 'at');
        if (startedAt === null) startedAt = timestamp;
        var elapsedMs = Math.max(0, timestamp - startedAt);
        if (elapsedMs < options.warmupMs) {
          lastPitch = pitch;
          lastAt = timestamp;
          return result('WARMUP', elapsedMs, false);
        }

        if (stableStartedAt === null) {
          stableStartedAt = timestamp;
          samples = [pitch];
          lastPitch = pitch;
          lastAt = timestamp;
          return result('HOLD_STILL', elapsedMs, false);
        }

        var gapMs = lastAt === null ? 0 : Math.max(0, timestamp - lastAt);
        var movedByStep = lastPitch !== null && Math.abs(pitch - lastPitch) > options.maxStepDeg;
        var candidateSamples = samples.concat([pitch]);
        var candidateRange = Math.max.apply(null, candidateSamples) - Math.min.apply(null, candidateSamples);
        if (gapMs > options.maxGapMs || movedByStep || candidateRange > options.maxRangeDeg) {
          stableStartedAt = timestamp;
          samples = [pitch];
          lastPitch = pitch;
          lastAt = timestamp;
          return result('MOVING', elapsedMs, false);
        }

        samples.push(pitch);
        lastPitch = pitch;
        lastAt = timestamp;
        var stableElapsedMs = timestamp - stableStartedAt;
        var ready = stableElapsedMs >= options.sampleMs && samples.length >= options.minSamples;
        return result(ready ? 'READY' : 'HOLD_STILL', elapsedMs, ready);
      },
    };
  }

  function evaluateHeadContinuity(previousPitch, pitch, previousAt, at, overrides) {
    var options = Object.assign({
      maxGapMs: 2000,
      maxJumpDeg: 45,
    }, overrides || {});
    var currentPitch = finiteNumber(pitch, 'headPitch');
    var currentAt = finiteNumber(at, 'at');
    if (previousPitch === null || previousPitch === undefined ||
        previousAt === null || previousAt === undefined ||
        !Number.isFinite(Number(previousPitch)) || !Number.isFinite(Number(previousAt))) {
      return { status: 'FRESH', gapMs: 0, jumpDeg: 0 };
    }
    var gapMs = Math.max(0, currentAt - Number(previousAt));
    var jumpDeg = Math.abs(currentPitch - Number(previousPitch));
    return {
      status: gapMs > options.maxGapMs ? 'GAP' : jumpDeg > options.maxJumpDeg ? 'JUMP' : 'FRESH',
      gapMs: gapMs,
      jumpDeg: jumpDeg,
    };
  }

  function createPostureEngine(overrides) {
    var options = Object.assign({}, DEFAULTS, overrides || {});
    var session = null;

    function requireSession() {
      if (!session) throw new Error('Posture session is not calibrated');
    }

    function addElapsed(until) {
      if (!session || session.lastAt === null) return;
      var elapsed = Math.max(0, Math.min(options.maxGapMs, until - session.lastAt));
      if (session.status === 'GOOD') session.goodMs += elapsed;
      if (session.status === 'CAUTION') session.cautionMs += elapsed;
      if (session.status === 'BAD') session.badMs += elapsed;
      session.lastAt = until;
    }

    function calibrate(sample) {
      var headPitch = finiteNumber(sample.headPitch, 'headPitch');
      var torsoPitch = finiteNumber(sample.torsoPitch, 'torsoPitch');
      var at = sample.at === undefined ? Date.now() : finiteNumber(sample.at, 'at');
      var relative = headPitch - torsoPitch;

      session = {
        baselineRelative: relative,
        startedAt: at,
        lastAt: at,
        headPitch: headPitch,
        torsoPitch: torsoPitch,
        relative: relative,
        signedDeviation: 0,
        deviation: 0,
        status: 'GOOD',
        badSince: null,
        alertLatched: false,
        alerts: 0,
        samples: 1,
        goodMs: 0,
        cautionMs: 0,
        badMs: 0,
      };
      return snapshot();
    }

    function update(sample) {
      requireSession();
      var headPitch = finiteNumber(sample.headPitch, 'headPitch');
      var torsoPitch = finiteNumber(sample.torsoPitch, 'torsoPitch');
      var at = sample.at === undefined ? Date.now() : finiteNumber(sample.at, 'at');
      addElapsed(at);

      var relative = headPitch - torsoPitch;
      var signedDeviation = relative - session.baselineRelative;
      var deviation = Math.abs(signedDeviation);
      var nextStatus = classifyDeviation(deviation, options);
      var alert = false;

      if (nextStatus === 'BAD') {
        if (session.status !== 'BAD' || session.badSince === null) {
          session.badSince = at;
          session.alertLatched = false;
        }
        if (!session.alertLatched && at - session.badSince >= options.badHoldMs) {
          session.alertLatched = true;
          session.alerts += 1;
          alert = true;
        }
      } else {
        session.badSince = null;
        session.alertLatched = false;
      }

      session.headPitch = headPitch;
      session.torsoPitch = torsoPitch;
      session.relative = relative;
      session.signedDeviation = signedDeviation;
      session.deviation = deviation;
      session.status = nextStatus;
      session.samples += 1;

      var result = snapshot();
      result.alert = alert;
      return result;
    }

    function snapshot() {
      requireSession();
      var durationMs = session.goodMs + session.cautionMs + session.badMs;
      var badHoldElapsedMs = session.status === 'BAD' && session.badSince !== null
        ? Math.max(0, session.lastAt - session.badSince)
        : 0;
      return {
        baselineRelative: session.baselineRelative,
        headPitch: session.headPitch,
        torsoPitch: session.torsoPitch,
        relative: session.relative,
        signedDeviation: session.signedDeviation,
        deviation: session.deviation,
        status: session.status,
        badHoldElapsedMs: badHoldElapsedMs,
        badHoldRemainingMs: Math.max(0, options.badHoldMs - badHoldElapsedMs),
        alert: false,
        alerts: session.alerts,
        samples: session.samples,
        durationMs: durationMs,
        goodMs: session.goodMs,
        cautionMs: session.cautionMs,
        badMs: session.badMs,
        goodPercent: durationMs ? Math.round((session.goodMs / durationMs) * 100) : 100,
      };
    }

    function finish(at) {
      requireSession();
      addElapsed(at === undefined ? Date.now() : finiteNumber(at, 'at'));
      return snapshot();
    }

    return {
      calibrate: calibrate,
      update: update,
      snapshot: snapshot,
      finish: finish,
      options: Object.assign({}, options),
    };
  }

  return {
    DEFAULTS: DEFAULTS,
    classifyDeviation: classifyDeviation,
    createHeadCalibrator: createHeadCalibrator,
    createPostureEngine: createPostureEngine,
    evaluateHeadContinuity: evaluateHeadContinuity,
    postureAnimationFrame: postureAnimationFrame,
    postureVisualDeviation: postureVisualDeviation,
    signedPostureAnimationFrame: signedPostureAnimationFrame,
  };
});
