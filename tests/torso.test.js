'use strict';

var assert = require('node:assert/strict');
var EventEmitter = require('node:events');
var test = require('node:test');
var createTorsoHandler = require('../lib/torso').createTorsoHandler;

function createRequest(method, body, headers) {
  var request = new EventEmitter();
  request.method = method;
  request.body = body;
  request.headers = headers || {};
  return request;
}

function createResponse() {
  return {
    headers: {},
    statusCode: 0,
    setHeader: function (name, value) { this.headers[name.toLowerCase()] = value; },
    end: function (body) { this.body = body; },
  };
}

test('stores and reads the latest torso sample with server freshness', async function () {
  var handler = createTorsoHandler();
  var uploadResponse = createResponse();
  await handler(createRequest('POST', {
    deviceId: 'AntiTurtle-TORSO', deviceMs: 8412, pitchDeg: -3.42,
    deltaDeg: 1.18, gyroYDps: 0.09, accNormMg: 1017.6, trusted: true,
  }), uploadResponse);
  assert.equal(uploadResponse.statusCode, 202);

  var readResponse = createResponse();
  await handler(createRequest('GET'), readResponse);
  var payload = JSON.parse(readResponse.body);
  assert.equal(readResponse.statusCode, 200);
  assert.equal(payload.sample.pitchDeg, -3.42);
  assert.equal(payload.sample.trusted, true);
  assert.ok(payload.ageMs >= 0);
});

test('rejects invalid torso angles', async function () {
  var handler = createTorsoHandler();
  var response = createResponse();
  await handler(createRequest('POST', {
    deviceMs: 1, pitchDeg: 360, deltaDeg: 0,
    gyroYDps: 0, accNormMg: 1000, trusted: true,
  }), response);
  assert.equal(response.statusCode, 400);
});

test('allows the connected localhost dashboard to relay without reconnecting BLE', async function () {
  var handler = createTorsoHandler();
  var response = createResponse();
  await handler(createRequest('OPTIONS', null, {
    origin: 'http://localhost:4173',
  }), response);
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:4173');
  assert.equal(response.headers['access-control-allow-methods'], 'GET, POST, OPTIONS');
});

test('does not grant cross-origin relay access to unrelated sites', async function () {
  var handler = createTorsoHandler();
  var response = createResponse();
  await handler(createRequest('OPTIONS', null, {
    origin: 'https://example.com',
  }), response);
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('accepts a display-only relay sample without fabricated raw IMU metrics', async function () {
  var handler = createTorsoHandler();
  var response = createResponse();
  await handler(createRequest('POST', {
    deviceId: 'AntiTurtle-ANGLE',
    deviceMs: 1234,
    pitchDeg: -16.6,
    trusted: true,
  }), response);
  assert.equal(response.statusCode, 202);
  var sample = JSON.parse(response.body).sample;
  assert.equal(sample.deltaDeg, 0);
  assert.equal(sample.gyroYDps, null);
  assert.equal(sample.accNormMg, null);
});
