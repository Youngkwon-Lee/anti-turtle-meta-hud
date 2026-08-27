'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');
var posture = require('../public/posture-engine');
var calibrationReplays = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'head-calibration-replays.json'),
  'utf8'
));

test('classifies the Anti Turtle MVP thresholds', function () {
  assert.equal(posture.classifyDeviation(7.99, posture.DEFAULTS), 'GOOD');
  assert.equal(posture.classifyDeviation(8, posture.DEFAULTS), 'CAUTION');
  assert.equal(posture.classifyDeviation(15, posture.DEFAULTS), 'CAUTION');
  assert.equal(posture.classifyDeviation(15.01, posture.DEFAULTS), 'BAD');
});

test('calibration removes the initial head-to-torso offset', function () {
  var engine = posture.createPostureEngine();
  var calibrated = engine.calibrate({ headPitch: 24, torsoPitch: 10, at: 0 });
  var samePosture = engine.update({ headPitch: 29, torsoPitch: 15, at: 100 });

  assert.equal(calibrated.baselineRelative, 14);
  assert.equal(samePosture.deviation, 0);
  assert.equal(samePosture.status, 'GOOD');
});

test('head calibration ignores startup transients and uses a stable median', function () {
  var calibrator = posture.createHeadCalibrator({
    warmupMs: 300,
    sampleMs: 700,
    minSamples: 4,
    maxRangeDeg: 4,
    maxStepDeg: 4,
  });

  assert.equal(calibrator.add(0, 0).ready, false);
  assert.equal(calibrator.add(8, 150).ready, false);
  calibrator.add(62, 300);
  calibrator.add(63, 500);
  calibrator.add(61, 750);
  var calibrated = calibrator.add(64, 1000);

  assert.equal(calibrated.ready, true);
  assert.equal(calibrated.baseline, 62.5);
  assert.equal(calibrated.sampleCount, 4);
});

test('head calibration requires a continuous stable hold', function () {
  var calibrator = posture.createHeadCalibrator({
    warmupMs: 300,
    sampleMs: 3000,
    minSamples: 6,
  });
  var results = calibrationReplays.stableNeutral.map(function (sample) {
    return calibrator.add(sample[1], sample[0]);
  });

  assert.equal(results[0].status, 'WARMUP');
  assert.equal(results[3].status, 'HOLD_STILL');
  assert.equal(results[results.length - 1].ready, true);
  assert.equal(results[results.length - 1].status, 'READY');
  assert.ok(Math.abs(results[results.length - 1].baseline - 62.1) < 0.01);
});

test('head calibration rejects movement and restarts the hold window', function () {
  var calibrator = posture.createHeadCalibrator({
    warmupMs: 300,
    sampleMs: 3000,
    minSamples: 6,
  });
  var results = calibrationReplays.movementThenNeutral.map(function (sample) {
    return calibrator.add(sample[1], sample[0]);
  });

  assert.equal(results[3].status, 'MOVING');
  assert.equal(results[3].progress, 0);
  assert.equal(results[results.length - 1].ready, true);
  assert.ok(Math.abs(results[results.length - 1].baseline - 66.2) < 0.01);
});

test('head calibration rejects a sensor gap and restarts the continuous hold', function () {
  var calibrator = posture.createHeadCalibrator({
    warmupMs: 0,
    sampleMs: 3000,
    minSamples: 4,
    maxGapMs: 2000,
  });

  calibrator.add(62, 0);
  calibrator.add(62, 100);
  calibrator.add(62, 200);
  var afterGap = calibrator.add(62, 2501);

  assert.equal(afterGap.ready, false);
  assert.equal(afterGap.status, 'MOVING');
  assert.equal(afterGap.sampleCount, 1);
  assert.equal(calibrator.add(62, 3000).ready, false);
  assert.equal(calibrator.add(62, 4000).ready, false);
  assert.equal(calibrator.add(62, 5501).ready, true);
});

test('head continuity flags sensor gaps and large jumps', function () {
  assert.equal(posture.evaluateHeadContinuity(null, 62, null, 100).status, 'FRESH');
  assert.equal(posture.evaluateHeadContinuity(62, 63, 100, 200).status, 'FRESH');
  assert.equal(posture.evaluateHeadContinuity(62, 63, 100, 2201).status, 'GAP');
  assert.equal(posture.evaluateHeadContinuity(62, 108, 100, 200).status, 'JUMP');
});

test('maps calibrated posture deviation to a bounded Lottie frame', function () {
  assert.equal(posture.postureAnimationFrame(0, 60), 0);
  assert.equal(posture.postureAnimationFrame(12.5, 60), 30);
  assert.equal(posture.postureAnimationFrame(25, 60), 59);
  assert.equal(posture.postureAnimationFrame(90, 60), 59);
  assert.equal(posture.postureAnimationFrame(-10, 60), 24);
  assert.equal(posture.postureAnimationFrame(25, 61), 60);
});

test('fires one alert only after BAD persists for three seconds', function () {
  var engine = posture.createPostureEngine({ maxGapMs: 5000 });
  engine.calibrate({ headPitch: 0, torsoPitch: 0, at: 0 });

  assert.equal(engine.update({ headPitch: 16, torsoPitch: 0, at: 1000 }).alert, false);
  assert.equal(engine.update({ headPitch: 17, torsoPitch: 0, at: 3999 }).alert, false);
  assert.equal(engine.update({ headPitch: 18, torsoPitch: 0, at: 4000 }).alert, true);
  assert.equal(engine.update({ headPitch: 18, torsoPitch: 0, at: 5000 }).alert, false);
  assert.equal(engine.snapshot().alerts, 1);
});

test('resets the BAD alert latch after posture recovery', function () {
  var engine = posture.createPostureEngine({ badHoldMs: 1000, maxGapMs: 5000 });
  engine.calibrate({ headPitch: 0, torsoPitch: 0, at: 0 });
  engine.update({ headPitch: 20, torsoPitch: 0, at: 100 });
  assert.equal(engine.update({ headPitch: 20, torsoPitch: 0, at: 1100 }).alert, true);
  engine.update({ headPitch: 0, torsoPitch: 0, at: 1200 });
  engine.update({ headPitch: 20, torsoPitch: 0, at: 1300 });
  assert.equal(engine.update({ headPitch: 20, torsoPitch: 0, at: 2300 }).alert, true);
  assert.equal(engine.snapshot().alerts, 2);
});

test('summarizes accumulated posture time', function () {
  var engine = posture.createPostureEngine({ maxGapMs: 5000 });
  engine.calibrate({ headPitch: 0, torsoPitch: 0, at: 0 });
  engine.update({ headPitch: 10, torsoPitch: 0, at: 1000 });
  engine.update({ headPitch: 20, torsoPitch: 0, at: 2000 });
  var summary = engine.finish(3000);

  assert.equal(summary.goodMs, 1000);
  assert.equal(summary.cautionMs, 1000);
  assert.equal(summary.badMs, 1000);
  assert.equal(summary.goodPercent, 33);
});
