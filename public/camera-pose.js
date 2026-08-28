(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AntiTurtleCameraPose = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var LANDMARKS = {
    nose: 0,
    leftEyeOuter: 3,
    rightEyeOuter: 6,
    leftEar: 7,
    rightEar: 8,
    leftShoulder: 11,
    rightShoulder: 12,
    leftHip: 23,
    rightHip: 24,
  };

  var DEFAULTS = {
    minVisibility: 0.55,
    edgeMargin: 0.015,
    minShoulderWidth: 0.12,
    minFaceWidth: 0.025,
    minBaselineSamples: 5,
    maxBaselineOffsetRange: 0.04,
    maxBaselineScaleRange: 0.04,
    maxBaselineShoulderRange: 0.03,
    calibrationSampleMs: 3000,
    calibrationMinSamples: 16,
    calibrationMaxGapMs: 500,
    fusionHeadFlexionAtDeg: 8,
    fusionHeadDepthAt: 0.012,
    fusionHeadDropAt: 0.04,
    fusionTorsoDepthAt: 0.035,
    fusionSideLeanAtDeg: 6,
  };

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeLandmark(landmark) {
    if (!landmark) return null;
    var x = finiteNumber(landmark.x);
    var y = finiteNumber(landmark.y);
    if (x === null || y === null) return null;
    var visibility = finiteNumber(landmark.visibility);
    var presence = finiteNumber(landmark.presence);
    if (visibility === null) visibility = 1;
    if (presence !== null) visibility = Math.min(visibility, presence);
    return {
      x: x,
      y: y,
      z: finiteNumber(landmark.z),
      visibility: Math.max(0, Math.min(1, visibility)),
    };
  }

  function point(landmarks, name) {
    return normalizeLandmark(landmarks && landmarks[LANDMARKS[name]]);
  }

  function midpoint(left, right) {
    return {
      x: (left.x + right.x) / 2,
      y: (left.y + right.y) / 2,
      z: left.z === null || right.z === null ? null : (left.z + right.z) / 2,
      visibility: Math.min(left.visibility, right.visibility),
    };
  }

  function distance(left, right) {
    return Math.hypot(right.x - left.x, right.y - left.y);
  }

  function horizontalAngle(left, right) {
    return Math.atan2(right.y - left.y, right.x - left.x) * 180 / Math.PI;
  }

  function verticalLean(upper, lower) {
    return Math.atan2(upper.x - lower.x, lower.y - upper.y) * 180 / Math.PI;
  }

  function withinFrame(landmark, margin) {
    return landmark.x >= margin && landmark.x <= 1 - margin &&
      landmark.y >= margin && landmark.y <= 1 - margin;
  }

  function unavailable(at, reasons, anchors) {
    return {
      schemaVersion: 1,
      at: at,
      available: false,
      quality: {
        status: 'UNAVAILABLE',
        score: 0,
        reasons: reasons,
      },
      anchors: anchors || null,
      features: null,
    };
  }

  function analyzeLandmarks(landmarks, at, overrides) {
    var options = Object.assign({}, DEFAULTS, overrides || {});
    var timestamp = at === undefined ? Date.now() : finiteNumber(at);
    if (timestamp === null) throw new TypeError('at must be a finite number');
    if (!Array.isArray(landmarks)) return unavailable(timestamp, ['NO_POSE']);

    var anchors = {
      nose: point(landmarks, 'nose'),
      leftEyeOuter: point(landmarks, 'leftEyeOuter'),
      rightEyeOuter: point(landmarks, 'rightEyeOuter'),
      leftEar: point(landmarks, 'leftEar'),
      rightEar: point(landmarks, 'rightEar'),
      leftShoulder: point(landmarks, 'leftShoulder'),
      rightShoulder: point(landmarks, 'rightShoulder'),
      leftHip: point(landmarks, 'leftHip'),
      rightHip: point(landmarks, 'rightHip'),
    };

    var reasons = [];
    ['nose', 'leftShoulder', 'rightShoulder'].forEach(function (name) {
      if (!anchors[name]) reasons.push('MISSING_' + name.toUpperCase());
    });
    var hasEars = Boolean(anchors.leftEar && anchors.rightEar);
    var hasEyes = Boolean(anchors.leftEyeOuter && anchors.rightEyeOuter);
    if (!hasEars && !hasEyes) reasons.push('MISSING_HEAD_PAIR');
    if (reasons.length) return unavailable(timestamp, reasons, anchors);

    var headPair = hasEars
      ? [anchors.leftEar, anchors.rightEar]
      : [anchors.leftEyeOuter, anchors.rightEyeOuter];
    var facePair = hasEyes
      ? [anchors.leftEyeOuter, anchors.rightEyeOuter]
      : headPair;
    var core = [
      anchors.nose,
      anchors.leftShoulder,
      anchors.rightShoulder,
      headPair[0],
      headPair[1],
    ];
    if (core.some(function (landmark) { return landmark.visibility < options.minVisibility; })) {
      return unavailable(timestamp, ['LOW_VISIBILITY'], anchors);
    }
    if (core.some(function (landmark) { return !withinFrame(landmark, options.edgeMargin); })) {
      return unavailable(timestamp, ['OUT_OF_FRAME'], anchors);
    }

    var shoulderWidth = distance(anchors.leftShoulder, anchors.rightShoulder);
    var faceWidth = distance(facePair[0], facePair[1]);
    if (shoulderWidth < options.minShoulderWidth) {
      return unavailable(timestamp, ['SUBJECT_TOO_SMALL'], anchors);
    }
    if (faceWidth < options.minFaceWidth) {
      return unavailable(timestamp, ['FACE_TOO_SMALL'], anchors);
    }

    var shoulderMidpoint = midpoint(anchors.leftShoulder, anchors.rightShoulder);
    var headMidpoint = midpoint(headPair[0], headPair[1]);
    var hasHips = Boolean(anchors.leftHip && anchors.rightHip &&
      anchors.leftHip.visibility >= options.minVisibility &&
      anchors.rightHip.visibility >= options.minVisibility &&
      withinFrame(anchors.leftHip, options.edgeMargin) &&
      withinFrame(anchors.rightHip, options.edgeMargin));
    var hipMidpoint = hasHips ? midpoint(anchors.leftHip, anchors.rightHip) : null;
    var partialReasons = hasHips ? [] : ['TORSO_UNAVAILABLE'];

    return {
      schemaVersion: 1,
      at: timestamp,
      available: true,
      quality: {
        status: hasHips ? 'GOOD' : 'PARTIAL',
        score: hasHips ? 1 : 0.8,
        reasons: partialReasons,
      },
      anchors: Object.assign({}, anchors, {
        headMidpoint: headMidpoint,
        shoulderMidpoint: shoulderMidpoint,
        hipMidpoint: hipMidpoint,
        headAnchorSource: hasEars ? 'ears' : 'eyes',
      }),
      features: {
        shoulderWidth: shoulderWidth,
        faceWidth: faceWidth,
        headShoulderX: (headMidpoint.x - shoulderMidpoint.x) / shoulderWidth,
        headShoulderY: (headMidpoint.y - shoulderMidpoint.y) / shoulderWidth,
        headScaleRatio: faceWidth / shoulderWidth,
        headRollDeg: horizontalAngle(headPair[0], headPair[1]),
        shoulderTiltDeg: horizontalAngle(anchors.leftShoulder, anchors.rightShoulder),
        torsoLeanDeg: hipMidpoint ? verticalLean(shoulderMidpoint, hipMidpoint) : null,
      },
    };
  }

  function analyzeResult(result, at, overrides) {
    var landmarks = result && Array.isArray(result.landmarks) && result.landmarks.length
      ? result.landmarks[0]
      : null;
    return analyzeLandmarks(landmarks, at, overrides);
  }

  function median(values) {
    var sorted = values.slice().sort(function (left, right) { return left - right; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function range(values) {
    return Math.max.apply(null, values) - Math.min.apply(null, values);
  }

  function createBaseline(samples, overrides) {
    var options = Object.assign({}, DEFAULTS, overrides || {});
    var usable = (samples || []).filter(function (sample) {
      return sample && sample.available && sample.features;
    });
    if (usable.length < options.minBaselineSamples) {
      return {
        ready: false,
        status: 'INSUFFICIENT_SAMPLES',
        sampleCount: usable.length,
      };
    }

    var headShoulderX = usable.map(function (sample) { return sample.features.headShoulderX; });
    var headShoulderY = usable.map(function (sample) { return sample.features.headShoulderY; });
    var headScaleRatio = usable.map(function (sample) { return sample.features.headScaleRatio; });
    var shoulderWidth = usable.map(function (sample) { return sample.features.shoulderWidth; });
    if (range(headShoulderX) > options.maxBaselineOffsetRange ||
        range(headShoulderY) > options.maxBaselineOffsetRange ||
        range(headScaleRatio) > options.maxBaselineScaleRange ||
        range(shoulderWidth) > options.maxBaselineShoulderRange) {
      return {
        ready: false,
        status: 'UNSTABLE',
        sampleCount: usable.length,
      };
    }

    var torsoValues = usable.map(function (sample) { return sample.features.torsoLeanDeg; })
      .filter(Number.isFinite);
    return {
      ready: true,
      status: 'READY',
      sampleCount: usable.length,
      features: {
        shoulderWidth: median(shoulderWidth),
        headShoulderX: median(headShoulderX),
        headShoulderY: median(headShoulderY),
        headScaleRatio: median(headScaleRatio),
        headRollDeg: median(usable.map(function (sample) { return sample.features.headRollDeg; })),
        shoulderTiltDeg: median(usable.map(function (sample) { return sample.features.shoulderTiltDeg; })),
        torsoLeanDeg: torsoValues.length >= options.minBaselineSamples ? median(torsoValues) : null,
      },
    };
  }

  function compareToBaseline(sample, baseline) {
    if (!baseline || !baseline.ready || !baseline.features) {
      return { available: false, status: 'BASELINE_UNAVAILABLE', deviations: null };
    }
    if (!sample || !sample.available || !sample.features) {
      return {
        available: false,
        status: 'SAMPLE_UNAVAILABLE',
        reasons: sample && sample.quality ? sample.quality.reasons.slice() : ['NO_SAMPLE'],
        deviations: null,
      };
    }
    var torsoAvailable = Number.isFinite(sample.features.torsoLeanDeg) &&
      Number.isFinite(baseline.features.torsoLeanDeg);
    return {
      available: true,
      status: torsoAvailable ? 'AVAILABLE' : 'PARTIAL',
      quality: sample.quality,
      deviations: {
        headShoulderX: sample.features.headShoulderX - baseline.features.headShoulderX,
        headShoulderY: sample.features.headShoulderY - baseline.features.headShoulderY,
        headDepthProxy: sample.features.headScaleRatio - baseline.features.headScaleRatio,
        torsoDepthProxy: sample.features.shoulderWidth - baseline.features.shoulderWidth,
        headRollDeg: sample.features.headRollDeg - baseline.features.headRollDeg,
        shoulderTiltDeg: sample.features.shoulderTiltDeg - baseline.features.shoulderTiltDeg,
        torsoLeanDeg: torsoAvailable
          ? sample.features.torsoLeanDeg - baseline.features.torsoLeanDeg
          : null,
      },
    };
  }

  function classifyFusion(comparison, headFlexionDeg, overrides) {
    var options = Object.assign({}, DEFAULTS, overrides || {});
    if (!comparison || !comparison.available || !comparison.deviations) {
      return {
        available: false,
        state: 'UNAVAILABLE',
        label: 'REPOSITION',
        signals: null,
      };
    }
    var flexion = finiteNumber(headFlexionDeg);
    var deviations = comparison.deviations;
    var sideLean = Number.isFinite(deviations.torsoLeanDeg) &&
      Math.abs(deviations.torsoLeanDeg) >= options.fusionSideLeanAtDeg;
    if (flexion === null) {
      return {
        available: false,
        state: 'IMU_UNAVAILABLE',
        label: 'WAIT IMU',
        signals: {
          sideLean: sideLean,
          headForward: false,
          bodyForward: false,
          lookingDown: false,
        },
      };
    }

    var bodyForward = deviations.torsoDepthProxy >= options.fusionTorsoDepthAt;
    // Use both relative face scale and head-to-shoulder displacement. The IMU
    // signal below separates this frontal-camera proxy from looking down.
    var headForward = !bodyForward &&
      deviations.headDepthProxy >= options.fusionHeadDepthAt &&
      deviations.headShoulderY >= options.fusionHeadDropAt;
    var lookingDown = flexion >= options.fusionHeadFlexionAtDeg;
    var active = [sideLean, headForward, bodyForward, lookingDown]
      .filter(Boolean).length;
    var signals = {
      sideLean: sideLean,
      headForward: headForward,
      bodyForward: bodyForward,
      lookingDown: lookingDown,
    };

    if (active > 1) {
      return { available: true, state: 'MIXED', label: 'MIXED MOVEMENT', signals: signals };
    }
    if (sideLean) return { available: true, state: 'SIDE_LEAN', label: 'SIDE LEAN', signals: signals };
    if (headForward) {
      return { available: true, state: 'HEAD_FORWARD_RISK', label: 'HEAD FORWARD RISK', signals: signals };
    }
    if (bodyForward) {
      return { available: true, state: 'BODY_FORWARD', label: 'BODY FORWARD', signals: signals };
    }
    if (lookingDown) {
      return { available: true, state: 'LOOKING_DOWN', label: 'LOOKING DOWN', signals: signals };
    }
    return { available: true, state: 'NEUTRAL', label: 'NEUTRAL', signals: signals };
  }

  function createCalibrator(overrides) {
    var options = Object.assign({}, DEFAULTS, overrides || {});
    var samples = [];
    var stableStartedAt = null;
    var lastAt = null;

    function result(status, at, ready, baseline) {
      var elapsedMs = stableStartedAt === null ? 0 : Math.max(0, at - stableStartedAt);
      var timeProgress = options.calibrationSampleMs > 0
        ? Math.min(1, elapsedMs / options.calibrationSampleMs)
        : 1;
      var sampleProgress = options.calibrationMinSamples > 0
        ? Math.min(1, samples.length / options.calibrationMinSamples)
        : 1;
      return {
        ready: ready,
        status: status,
        progress: ready ? 1 : Math.min(timeProgress, sampleProgress),
        elapsedMs: elapsedMs,
        sampleCount: samples.length,
        baseline: ready ? baseline : null,
      };
    }

    function stableCandidate(candidateSamples) {
      if (candidateSamples.length < 2) return true;
      var xValues = candidateSamples.map(function (sample) { return sample.features.headShoulderX; });
      var yValues = candidateSamples.map(function (sample) { return sample.features.headShoulderY; });
      var scaleValues = candidateSamples.map(function (sample) { return sample.features.headScaleRatio; });
      return range(xValues) <= options.maxBaselineOffsetRange &&
        range(yValues) <= options.maxBaselineOffsetRange &&
        range(scaleValues) <= options.maxBaselineScaleRange;
    }

    return {
      add: function (sample) {
        var at = sample && finiteNumber(sample.at);
        if (!sample || !sample.available || !sample.features || at === null) {
          samples = [];
          stableStartedAt = null;
          lastAt = null;
          return result('WAITING_FOR_POSE', at === null ? 0 : at, false, null);
        }
        var gapMs = lastAt === null ? 0 : Math.max(0, at - lastAt);
        var candidateSamples = samples.concat([sample]);
        if (stableStartedAt === null || gapMs > options.calibrationMaxGapMs ||
            !stableCandidate(candidateSamples)) {
          samples = [sample];
          stableStartedAt = at;
          lastAt = at;
          return result(stableStartedAt === at && candidateSamples.length > 1 ? 'MOVING' : 'HOLD_STILL', at, false, null);
        }
        samples = candidateSamples;
        lastAt = at;
        var elapsedMs = at - stableStartedAt;
        var ready = elapsedMs >= options.calibrationSampleMs &&
          samples.length >= options.calibrationMinSamples;
        if (!ready) return result('HOLD_STILL', at, false, null);
        var baseline = createBaseline(samples, Object.assign({}, options, {
          minBaselineSamples: options.calibrationMinSamples,
        }));
        return result(baseline.ready ? 'READY' : 'MOVING', at, baseline.ready, baseline);
      },
      reset: function () {
        samples = [];
        stableStartedAt = null;
        lastAt = null;
      },
    };
  }

  return {
    LANDMARKS: LANDMARKS,
    DEFAULTS: DEFAULTS,
    analyzeLandmarks: analyzeLandmarks,
    analyzeResult: analyzeResult,
    createBaseline: createBaseline,
    createCalibrator: createCalibrator,
    compareToBaseline: compareToBaseline,
    classifyFusion: classifyFusion,
  };
});
