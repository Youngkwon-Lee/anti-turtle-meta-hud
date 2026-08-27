'use strict';

var assert = require('node:assert/strict');
var EventEmitter = require('node:events');
var test = require('node:test');
var telemetryModule = require('../lib/telemetry');
var createTelemetryHandler = telemetryModule.createTelemetryHandler;
var normalizeTelemetry = telemetryModule.normalizeTelemetry;

function createRequest(method, body, url) {
  var request = new EventEmitter();
  request.method = method;
  request.body = body;
  request.url = url || '/api/telemetry';
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

test('normalizes a valid telemetry payload and clamps display values', function () {
  var telemetry = normalizeTelemetry({
    deviceId: ' AntiTurtle-HEAD ',
    forwardDeg: 190,
    state: 'warning',
    stableRatioPct: 120,
    recoveryCount: 2.6,
  });
  assert.equal(telemetry.deviceId, 'AntiTurtle-HEAD');
  assert.equal(telemetry.forwardDeg, 180);
  assert.equal(telemetry.state, 'WARNING');
  assert.equal(telemetry.stableRatioPct, 100);
  assert.equal(telemetry.recoveryCount, 3);
});

test('rejects telemetry with an unknown state', function () {
  assert.equal(normalizeTelemetry({ forwardDeg: 4, state: 'UNKNOWN' }), null);
});

test('normalizes complete hybrid telemetry fields', function () {
  var telemetry = normalizeTelemetry({
    forwardDeg: 12.4,
    headPitchDeg: 31.2,
    torsoPitchDeg: 18.8,
    relativeDeg: 12.4,
    state: 'pending',
    sensorMode: 'hybrid',
    transport: 'hybrid-relay',
  });
  assert.equal(telemetry.sensorMode, 'HYBRID');
  assert.equal(telemetry.transport, 'hybrid-relay');
  assert.equal(telemetry.headPitchDeg, 31.2);
  assert.equal(telemetry.torsoPitchDeg, 18.8);
  assert.equal(telemetry.relativeDeg, 12.4);
});

test('rejects incomplete hybrid telemetry packets', function () {
  assert.equal(normalizeTelemetry({
    forwardDeg: 12.4,
    headPitchDeg: 31.2,
    state: 'PENDING',
    sensorMode: 'HYBRID',
    transport: 'hybrid-relay',
  }), null);
});

test('normalizes head-only relay telemetry', function () {
  var telemetry = normalizeTelemetry({
    forwardDeg: 9.5,
    signedDeviationDeg: -9.5,
    headPitchDeg: 28.2,
    state: 'pending',
    sensorMode: 'head',
    transport: 'head-relay',
  });
  assert.equal(telemetry.sensorMode, 'HEAD');
  assert.equal(telemetry.transport, 'head-relay');
  assert.equal(telemetry.forwardDeg, 9.5);
  assert.equal(telemetry.signedDeviationDeg, -9.5);
  assert.equal(telemetry.headPitchDeg, 28.2);
  assert.equal(telemetry.torsoPitchDeg, undefined);
  assert.equal(telemetry.sessionId, 'head-demo');
  assert.equal(telemetry.streamId, 'legacy');
  assert.ok(Number.isSafeInteger(telemetry.seq));
  assert.ok(Number.isFinite(telemetry.sentAt));
});

test('rejects a head relay packet without head pitch', function () {
  assert.equal(normalizeTelemetry({
    forwardDeg: 9.5,
    state: 'PENDING',
    sensorMode: 'HEAD',
    transport: 'head-relay',
  }), null);
});

test('telemetry relay stores and reads the latest packet', async function () {
  var handler = createTelemetryHandler();
  var uploadResponse = createResponse();
  await handler(createRequest('POST', { forwardDeg: 16.2, state: 'INTERVENTION' }), uploadResponse);
  assert.equal(uploadResponse.statusCode, 201);

  var readResponse = createResponse();
  await handler(createRequest('GET'), readResponse);
  var payload = JSON.parse(readResponse.body);
  assert.equal(readResponse.statusCode, 200);
  assert.equal(payload.telemetry.forwardDeg, 16.2);
  assert.equal(payload.telemetry.state, 'INTERVENTION');
  assert.ok(payload.receivedAt);
  assert.deepEqual(payload.storage, { kind: 'memory', shared: false });
});

test('telemetry relay rejects malformed packets', async function () {
  var handler = createTelemetryHandler();
  var response = createResponse();
  await handler(createRequest('POST', { forwardDeg: 'not-a-number', state: 'STABLE' }), response);
  assert.equal(response.statusCode, 400);
});

test('telemetry relay preserves hybrid fields on readback', async function () {
  var handler = createTelemetryHandler();
  var uploadResponse = createResponse();
  await handler(createRequest('POST', {
    forwardDeg: 18,
    headPitchDeg: 39,
    torsoPitchDeg: 21,
    relativeDeg: 18,
    state: 'WARNING',
    sensorMode: 'HYBRID',
    transport: 'hybrid-relay',
  }), uploadResponse);
  assert.equal(uploadResponse.statusCode, 201);

  var readResponse = createResponse();
  await handler(createRequest('GET'), readResponse);
  var payload = JSON.parse(readResponse.body);
  assert.equal(payload.telemetry.sensorMode, 'HYBRID');
  assert.equal(payload.telemetry.headPitchDeg, 39);
  assert.equal(payload.telemetry.torsoPitchDeg, 21);
  assert.equal(payload.telemetry.relativeDeg, 18);
});

test('telemetry relay preserves head-only fields on readback', async function () {
  var handler = createTelemetryHandler();
  var uploadResponse = createResponse();
  await handler(createRequest('POST', {
    forwardDeg: 16,
    signedDeviationDeg: -16,
    headPitchDeg: 37,
    state: 'WARNING',
    sensorMode: 'HEAD',
    transport: 'head-relay',
  }), uploadResponse);
  assert.equal(uploadResponse.statusCode, 201);

  var readResponse = createResponse();
  await handler(createRequest('GET'), readResponse);
  var payload = JSON.parse(readResponse.body);
  assert.equal(payload.telemetry.sensorMode, 'HEAD');
  assert.equal(payload.telemetry.transport, 'head-relay');
  assert.equal(payload.telemetry.headPitchDeg, 37);
  assert.equal(payload.telemetry.signedDeviationDeg, -16);
  assert.equal(payload.telemetry.torsoPitchDeg, undefined);
});

test('telemetry relay isolates sessions and sensor modes', async function () {
  var handler = createTelemetryHandler();
  await handler(createRequest('POST', {
    sessionId: 'pilot_a',
    streamId: 'head-a',
    seq: 1,
    sentAt: 1000,
    forwardDeg: 7,
    headPitchDeg: 27,
    state: 'STABLE',
    sensorMode: 'HEAD',
    transport: 'head-relay',
  }), createResponse());
  await handler(createRequest('POST', {
    sessionId: 'pilot_b',
    streamId: 'hybrid-b',
    seq: 1,
    sentAt: 1000,
    forwardDeg: 12,
    headPitchDeg: 32,
    torsoPitchDeg: 20,
    relativeDeg: 12,
    state: 'PENDING',
    sensorMode: 'HYBRID',
    transport: 'hybrid-relay',
  }), createResponse());

  var headResponse = createResponse();
  await handler(createRequest('GET', null, '/api/telemetry?session=pilot_a&mode=HEAD'), headResponse);
  var headPayload = JSON.parse(headResponse.body);
  assert.equal(headPayload.telemetry.forwardDeg, 7);
  assert.equal(headPayload.telemetry.sessionId, 'pilot_a');

  var wrongModeResponse = createResponse();
  await handler(createRequest('GET', null, '/api/telemetry?session=pilot_b&mode=HEAD'), wrongModeResponse);
  assert.equal(JSON.parse(wrongModeResponse.body).telemetry, null);
});

test('telemetry relay rejects an older packet from the same sender stream', async function () {
  var handler = createTelemetryHandler();
  var newestResponse = createResponse();
  await handler(createRequest('POST', {
    streamId: 'stream-a', seq: 4, sentAt: 4000,
    forwardDeg: 14, headPitchDeg: 34, state: 'PENDING',
    sensorMode: 'HEAD', transport: 'head-relay',
  }), newestResponse);
  assert.equal(newestResponse.statusCode, 201);

  var olderResponse = createResponse();
  await handler(createRequest('POST', {
    streamId: 'stream-a', seq: 3, sentAt: 3000,
    forwardDeg: 3, headPitchDeg: 23, state: 'STABLE',
    sensorMode: 'HEAD', transport: 'head-relay',
  }), olderResponse);
  assert.equal(olderResponse.statusCode, 202);
  assert.equal(JSON.parse(olderResponse.body).telemetry.forwardDeg, 14);
});

test('telemetry relay accepts a restarted sender stream with a reset sequence', async function () {
  var handler = createTelemetryHandler();
  await handler(createRequest('POST', {
    streamId: 'stream-a', seq: 40, sentAt: 4000,
    forwardDeg: 14, headPitchDeg: 34, state: 'PENDING',
    sensorMode: 'HEAD', transport: 'head-relay',
  }), createResponse());
  var restartedResponse = createResponse();
  await handler(createRequest('POST', {
    streamId: 'stream-b', seq: 1, sentAt: 5000,
    forwardDeg: 2, headPitchDeg: 22, state: 'STABLE',
    sensorMode: 'HEAD', transport: 'head-relay',
  }), restartedResponse);
  assert.equal(restartedResponse.statusCode, 201);
});
