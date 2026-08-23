'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var parseTorsoLine = require('../public/torso-parser').parseTorsoLine;

test('parses a torso firmware CSV sample', function () {
  assert.deepEqual(parseTorsoLine('8412,TORSO,-3.42,1.18,0.09,1017.6,1'), {
    deviceId: 'AntiTurtle-TORSO',
    deviceMs: 8412,
    pitchDeg: -3.42,
    deltaDeg: 1.18,
    gyroYDps: 0.09,
    accNormMg: 1017.6,
    trusted: true,
  });
});

test('parses the Luma AntiTurtle-ANGLE SINGLE sample as torso A', function () {
  assert.deepEqual(parseTorsoLine(
    '8412,SINGLE,1.18,-3.42,1.18,0.00,0.00,0.09,0.00,1017.6,0.0,1,1.18,STABLE,2.00,0.00,0.00,0,100.0,0.00'
  ), {
    deviceId: 'AntiTurtle-ANGLE',
    deviceMs: 8412,
    pitchDeg: -3.42,
    deltaDeg: 1.18,
    gyroYDps: 0.09,
    accNormMg: 1017.6,
    trusted: true,
    sourceRole: 'SINGLE',
  });
});

test('uses sensor A as the torso reference for a DUAL sample', function () {
  var sample = parseTorsoLine(
    '9000,DUAL,8.00,4.50,1.50,12.50,9.50,0.10,0.20,998.0,1002.0,1,8.00,STABLE,2.00,0.00,0.00,0,100.0,0.00'
  );
  assert.equal(sample.pitchDeg, 4.5);
  assert.equal(sample.sourceRole, 'DUAL');
});

test('ignores diagnostics, headers, and malformed samples', function () {
  assert.equal(parseTorsoLine('# ready,mode=TORSO'), null);
  assert.equal(parseTorsoLine('ms,role,pitch_deg,delta_deg,gyro_y_dps,acc_norm_mg,trusted'), null);
  assert.equal(parseTorsoLine('8412,DUAL,1,2,3,1000,1'), null);
  assert.equal(parseTorsoLine('8412,TORSO,nope,2,3,1000,1'), null);
  assert.equal(parseTorsoLine('8412,TORSO,1,2,3,1000,2'), null);
});
