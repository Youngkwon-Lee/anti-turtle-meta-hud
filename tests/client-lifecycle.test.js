'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');

var clientSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'client.js'), 'utf8');

test('caps telemetry relay posts at five hertz', function () {
  var match = clientSource.match(/telemetryPostMs:\s*(\d+)/);
  assert.ok(match, 'telemetry post cadence must remain configured');
  assert.ok(Number(match[1]) >= 200, 'telemetry relay must not exceed 5 Hz');
});

test('hidden pages stop both live inputs and telemetry polling', function () {
  assert.match(
    clientSource,
    /if \(document\.hidden\) \{[\s\S]*?stopLiveInputs\(\);[\s\S]*?stopTelemetryPolling\(\);[\s\S]*?return;/
  );
});

test('camera pose analysis is opt-in and stops with the camera lifecycle', function () {
  assert.match(clientSource, /state\.cameraPoseEnabled = state\.cameraMode && params\.get\('pose'\) === '1';/);
  assert.match(clientSource, /function stopCamera\(\) \{[\s\S]*?stopCameraPose\(\);/);
  assert.match(clientSource, /function startCameraPose\(\) \{[\s\S]*?fps: 8,/);
});
