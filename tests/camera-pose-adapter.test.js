'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var adapterModule = require('../public/camera-pose-adapter');

test('runs MediaPipe video inference on a capped local timer and closes cleanly', async function () {
  var scheduled = [];
  var statuses = [];
  var samples = [];
  var closed = false;
  var detected = 0;
  var now = 1000;
  var fakeLandmarker = {
    detectForVideo: function (_video, at) {
      detected += 1;
      return { landmarks: [[{ x: at, y: 0 }]] };
    },
    close: function () { closed = true; },
  };
  var adapter = adapterModule.createMediaPipePoseAdapter({
    fps: 8,
    now: function () { return now; },
    setTimer: function (callback, delay) {
      scheduled.push({ callback: callback, delay: delay });
      return scheduled.length;
    },
    clearTimer: function () {},
    visionLoader: function () {
      return Promise.resolve({
        FilesetResolver: {
          forVisionTasks: function () { return Promise.resolve({}); },
        },
        PoseLandmarker: {
          createFromOptions: function () { return Promise.resolve(fakeLandmarker); },
        },
      });
    },
    analyzeResult: function (result, at) { return { result: result, at: at }; },
    onSample: function (sample) { samples.push(sample); },
    onStatus: function (status) { statuses.push(status.status); },
  });
  var video = { readyState: 4, currentTime: 1 };

  assert.equal(await adapter.start(video), true);
  assert.deepEqual(statuses, ['LOADING', 'READY']);
  assert.equal(scheduled[0].delay, 0);
  scheduled.shift().callback();

  assert.equal(detected, 1);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].at, 1000);
  assert.ok(scheduled[0].delay >= 100, 'pose loop must remain at or below 10 Hz');

  adapter.stop();
  assert.equal(adapter.isRunning(), false);
  assert.equal(closed, true);
  assert.equal(statuses[statuses.length - 1], 'STOPPED');
});

test('does not publish a late model after the adapter is stopped', async function () {
  var resolveLandmarker;
  var closed = false;
  var adapter = adapterModule.createMediaPipePoseAdapter({
    setTimer: function () { return 1; },
    clearTimer: function () {},
    visionLoader: function () {
      return Promise.resolve({
        FilesetResolver: {
          forVisionTasks: function () { return Promise.resolve({}); },
        },
        PoseLandmarker: {
          createFromOptions: function () {
            return new Promise(function (resolve) { resolveLandmarker = resolve; });
          },
        },
      });
    },
  });

  var starting = adapter.start({ readyState: 4, currentTime: 1 });
  await Promise.resolve();
  await Promise.resolve();
  adapter.stop();
  resolveLandmarker({ close: function () { closed = true; } });

  assert.equal(await starting, false);
  assert.equal(closed, true);
  assert.equal(adapter.isRunning(), false);
});
