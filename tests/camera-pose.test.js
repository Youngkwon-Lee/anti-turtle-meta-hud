'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');
var cameraPose = require('../public/camera-pose');

var replay = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'camera-pose-replays.json'),
  'utf8'
));

function frame(spec, overrides) {
  var landmarks = new Array(33).fill(null);
  var offsetX = spec.offsetX || 0;
  var offsetY = spec.offsetY || 0;
  var faceDelta = spec.faceDelta || 0;
  function set(index, x, y, visibility) {
    landmarks[index] = { x: x, y: y, z: 0, visibility: visibility === undefined ? 0.99 : visibility };
  }
  set(0, 0.500 + offsetX, 0.285 + offsetY);
  set(3, 0.465 - faceDelta + offsetX, 0.275 + offsetY);
  set(6, 0.535 + faceDelta + offsetX, 0.275 + offsetY);
  set(7, 0.440 - faceDelta + offsetX, 0.320 + offsetY);
  set(8, 0.560 + faceDelta + offsetX, 0.320 + offsetY);
  set(11, 0.360, 0.500);
  set(12, 0.640, 0.500);
  set(23, 0.420, 0.800);
  set(24, 0.580, 0.800);
  Object.keys(overrides || {}).forEach(function (key) {
    landmarks[Number(key)] = overrides[key];
  });
  return landmarks;
}

test('extracts explainable front-camera geometry from the required points', function () {
  var sample = cameraPose.analyzeLandmarks(frame(replay.stableNeutral[0]), 0);

  assert.equal(sample.available, true);
  assert.equal(sample.quality.status, 'GOOD');
  assert.equal(sample.anchors.headAnchorSource, 'ears');
  assert.ok(Math.abs(sample.features.headShoulderX) < 0.0001);
  assert.ok(sample.features.headShoulderY < 0);
  assert.ok(sample.features.headScaleRatio > 0);
  assert.equal(sample.features.torsoLeanDeg, 0);
});

test('keeps head and shoulder metrics available when hips are outside the desk frame', function () {
  var sample = cameraPose.analyzeLandmarks(frame(replay.stableNeutral[0], {
    23: null,
    24: null,
  }), 0);

  assert.equal(sample.available, true);
  assert.equal(sample.quality.status, 'PARTIAL');
  assert.deepEqual(sample.quality.reasons, ['TORSO_UNAVAILABLE']);
  assert.equal(sample.features.torsoLeanDeg, null);
});

test('returns unavailable instead of a plausible number for low-confidence core points', function () {
  var sample = cameraPose.analyzeLandmarks(frame(replay.stableNeutral[0], {
    12: { x: 0.64, y: 0.5, z: 0, visibility: 0.2 },
  }), 0);

  assert.equal(sample.available, false);
  assert.equal(sample.quality.status, 'UNAVAILABLE');
  assert.deepEqual(sample.quality.reasons, ['LOW_VISIBILITY']);
  assert.equal(sample.features, null);
});

test('falls back to the outer eyes when both ear landmarks are unavailable', function () {
  var sample = cameraPose.analyzeLandmarks(frame(replay.stableNeutral[0], {
    7: null,
    8: null,
  }), 0);

  assert.equal(sample.available, true);
  assert.equal(sample.anchors.headAnchorSource, 'eyes');
});

test('creates a stable personal baseline from synthetic replay samples', function () {
  var samples = replay.stableNeutral.map(function (spec) {
    return cameraPose.analyzeLandmarks(frame(spec), spec.at);
  });
  var baseline = cameraPose.createBaseline(samples);

  assert.equal(baseline.ready, true);
  assert.equal(baseline.status, 'READY');
  assert.equal(baseline.sampleCount, 5);
});

test('reports forward-risk proxies as baseline deviations without claiming CVA', function () {
  var samples = replay.stableNeutral.map(function (spec) {
    return cameraPose.analyzeLandmarks(frame(spec), spec.at);
  });
  var baseline = cameraPose.createBaseline(samples);
  var current = cameraPose.analyzeLandmarks(frame(replay.forwardRisk), replay.forwardRisk.at);
  var comparison = cameraPose.compareToBaseline(current, baseline);

  assert.equal(comparison.available, true);
  assert.ok(comparison.deviations.headShoulderY > 0.05);
  assert.ok(comparison.deviations.headDepthProxy > 0.05);
  assert.equal(Object.prototype.hasOwnProperty.call(comparison.deviations, 'cva'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(comparison.deviations, 'fhp'), false);
});

test('rejects a moving sequence as an unstable baseline', function () {
  var samples = replay.unstable.map(function (spec) {
    return cameraPose.analyzeLandmarks(frame(spec), spec.at);
  });
  var baseline = cameraPose.createBaseline(samples);

  assert.equal(baseline.ready, false);
  assert.equal(baseline.status, 'UNSTABLE');
});

test('normalizes empty MediaPipe results to an unavailable sample', function () {
  var sample = cameraPose.analyzeResult({ landmarks: [] }, 100);

  assert.equal(sample.available, false);
  assert.deepEqual(sample.quality.reasons, ['NO_POSE']);
});

test('camera calibration requires a continuous stable hold before publishing a baseline', function () {
  var calibrator = cameraPose.createCalibrator({
    calibrationSampleMs: 500,
    calibrationMinSamples: 5,
  });
  var result = null;
  replay.stableNeutral.forEach(function (spec) {
    result = calibrator.add(cameraPose.analyzeLandmarks(frame(spec), spec.at));
  });

  assert.equal(result.ready, true);
  assert.equal(result.status, 'READY');
  assert.equal(result.progress, 1);
  assert.equal(result.baseline.ready, true);
});

test('camera calibration resets when the subject moves or pose becomes unavailable', function () {
  var calibrator = cameraPose.createCalibrator({
    calibrationSampleMs: 500,
    calibrationMinSamples: 5,
  });
  calibrator.add(cameraPose.analyzeLandmarks(frame(replay.stableNeutral[0]), 0));
  var moved = calibrator.add(cameraPose.analyzeLandmarks(frame(replay.unstable[1]), 125));
  var unavailableSample = cameraPose.analyzeResult({ landmarks: [] }, 250);
  var unavailable = calibrator.add(unavailableSample);

  assert.equal(moved.ready, false);
  assert.equal(moved.status, 'MOVING');
  assert.equal(moved.sampleCount, 1);
  assert.equal(unavailable.status, 'WAITING_FOR_POSE');
  assert.equal(unavailable.sampleCount, 0);
});

function baselineAndComparison(currentLandmarks) {
  var samples = replay.stableNeutral.map(function (spec) {
    return cameraPose.analyzeLandmarks(frame(spec), spec.at);
  });
  var baseline = cameraPose.createBaseline(samples);
  var current = cameraPose.analyzeLandmarks(currentLandmarks, 1000);
  return cameraPose.compareToBaseline(current, baseline);
}

test('fusion distinguishes looking down from a neutral camera pose', function () {
  var comparison = baselineAndComparison(frame(replay.stableNeutral[0]));

  assert.equal(cameraPose.classifyFusion(comparison, 0).state, 'NEUTRAL');
  assert.equal(cameraPose.classifyFusion(comparison, 12).state, 'LOOKING_DOWN');
});

test('fusion labels relative head approach as a non-clinical forward risk', function () {
  var comparison = baselineAndComparison(frame(replay.pureForwardRisk));
  var fusion = cameraPose.classifyFusion(comparison, 2);

  assert.equal(fusion.state, 'HEAD_FORWARD_RISK');
  assert.equal(fusion.signals.headForward, true);
  assert.equal(fusion.signals.bodyForward, false);
  assert.equal(fusion.signals.lookingDown, false);
  assert.ok(Math.abs(comparison.deviations.headShoulderY) < 0.01,
    'pure forward translation must not require a vertical head drop');
  assert.equal(Object.prototype.hasOwnProperty.call(fusion, 'diagnosis'), false);
});

test('fusion distinguishes whole-body approach when shoulder scale grows with the face', function () {
  var bodyCloser = frame(replay.stableNeutral[0], {
    3: { x: 0.45975, y: 0.275, z: 0, visibility: 0.99 },
    6: { x: 0.54025, y: 0.275, z: 0, visibility: 0.99 },
    7: { x: 0.431, y: 0.32, z: 0, visibility: 0.99 },
    8: { x: 0.569, y: 0.32, z: 0, visibility: 0.99 },
    11: { x: 0.339, y: 0.5, z: 0, visibility: 0.99 },
    12: { x: 0.661, y: 0.5, z: 0, visibility: 0.99 },
  });
  var comparison = baselineAndComparison(bodyCloser);
  var fusion = cameraPose.classifyFusion(comparison, 1);

  assert.equal(fusion.state, 'BODY_FORWARD');
  assert.equal(fusion.signals.bodyForward, true);
  assert.equal(fusion.signals.headForward, false);
});

test('fusion abstains from front-back classification without a fresh IMU direction', function () {
  var comparison = baselineAndComparison(frame(replay.forwardRisk));
  var fusion = cameraPose.classifyFusion(comparison, null);

  assert.equal(fusion.available, false);
  assert.equal(fusion.state, 'IMU_UNAVAILABLE');
  assert.equal(fusion.label, 'WAIT IMU');
});
