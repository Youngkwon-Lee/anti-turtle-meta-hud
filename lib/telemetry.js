'use strict';

var telemetryStoreModule = require('./telemetry-store');

var MAX_BODY_BYTES = 64 * 1024;

var ALLOWED_STATES = new Set(['STABLE', 'PENDING', 'WARNING', 'INTERVENTION']);

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  if (request.body && typeof request.body === 'object') return Promise.resolve(request.body);

  return new Promise(function (resolve, reject) {
    var bytes = 0;
    var chunks = [];
    request.on('data', function (chunk) {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        var error = new Error('Request body is too large.');
        error.code = 'BODY_TOO_LARGE';
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', function () {
      try {
        var raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        error.code = 'INVALID_JSON';
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function normalizeTelemetry(body) {
  if (!body || typeof body !== 'object') return null;
  var forwardDeg = Number(body.forwardDeg);
  var state = typeof body.state === 'string' ? body.state.toUpperCase() : '';
  if (!Number.isFinite(forwardDeg) || !ALLOWED_STATES.has(state)) return null;

  var transport = typeof body.transport === 'string' ? body.transport.slice(0, 40) : 'ble-uart';
  var sensorMode = typeof body.sensorMode === 'string' && body.sensorMode.trim()
    ? body.sensorMode.trim().toUpperCase().slice(0, 16)
    : transport === 'hybrid-relay' ? 'HYBRID' : transport === 'torso-relay' ? 'TORSO' : 'HEAD';
  var hybridFields = {
    headPitchDeg: optionalFinite(body.headPitchDeg, -180, 180),
    torsoPitchDeg: optionalFinite(body.torsoPitchDeg, -180, 180),
    relativeDeg: optionalFinite(body.relativeDeg, -360, 360),
    signedDeviationDeg: optionalFinite(body.signedDeviationDeg, -180, 180),
  };
  if (sensorMode === 'HYBRID' || transport === 'hybrid-relay') {
    if (hybridFields.headPitchDeg === null || hybridFields.torsoPitchDeg === null ||
        hybridFields.relativeDeg === null) return null;
    sensorMode = 'HYBRID';
    transport = 'hybrid-relay';
  } else if (transport === 'head-relay') {
    if (hybridFields.headPitchDeg === null) return null;
    sensorMode = 'HEAD';
  }

  var telemetry = {
    schema: 'kinelo.anti-turtle.telemetry',
    version: '0.1',
    deviceId: typeof body.deviceId === 'string' && body.deviceId.trim()
      ? body.deviceId.trim().slice(0, 80)
      : 'AntiTurtle-HEAD',
    at: Number.isFinite(Number(body.at)) ? Number(body.at) : Date.now(),
    forwardDeg: Math.max(0, Math.min(180, forwardDeg)),
    state: state,
    stateElapsedS: finiteOrZero(body.stateElapsedS),
    badDurationS: finiteOrZero(body.badDurationS),
    exposureDegS: finiteOrZero(body.exposureDegS),
    recoveryCount: Math.max(0, Math.round(finiteOrZero(body.recoveryCount))),
    stableRatioPct: Math.max(0, Math.min(100, finiteOrZero(body.stableRatioPct))),
    maxBadS: finiteOrZero(body.maxBadS),
    sensorMode: sensorMode,
    transport: transport,
    sessionId: telemetryStoreModule.normalizeSessionId(body.sessionId),
    streamId: telemetryStoreModule.normalizeStreamId(body.streamId),
    seq: normalizeSequence(body.seq, body.sentAt || body.at),
    sentAt: normalizeTimestamp(body.sentAt, body.at),
  };
  if (hybridFields.headPitchDeg !== null) telemetry.headPitchDeg = hybridFields.headPitchDeg;
  if (hybridFields.torsoPitchDeg !== null) telemetry.torsoPitchDeg = hybridFields.torsoPitchDeg;
  if (hybridFields.relativeDeg !== null) telemetry.relativeDeg = hybridFields.relativeDeg;
  if (hybridFields.signedDeviationDeg !== null) {
    telemetry.signedDeviationDeg = hybridFields.signedDeviationDeg;
  }
  return telemetry;
}

function normalizeSequence(value, fallback) {
  var number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    number = Math.max(0, Math.round(Number(fallback) || Date.now()));
  }
  return number;
}

function normalizeTimestamp(value, fallback) {
  var number = Number(value);
  if (!Number.isFinite(number) || number <= 0) number = Number(fallback);
  return Number.isFinite(number) && number > 0 ? number : Date.now();
}

function finiteOrZero(value) {
  var number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function optionalFinite(value, minimum, maximum) {
  if (value === undefined || value === null || value === '') return null;
  var number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(minimum, Math.min(maximum, number));
}

function requestUrl(request) {
  return new URL(request.url || '/', 'http://localhost');
}

function storageMetadata(store) {
  return { kind: store.kind, shared: Boolean(store.shared) };
}

function createTelemetryHandler(options) {
  var settings = options || {};
  var store = settings.store || telemetryStoreModule.createTelemetryStore(settings);
  var now = settings.now || Date.now;

  return async function telemetryHandler(request, response) {
    if (request.method === 'GET') {
      var url = requestUrl(request);
      var sessionId = telemetryStoreModule.normalizeSessionId(url.searchParams.get('session'));
      var mode = telemetryStoreModule.normalizeMode(url.searchParams.get('mode'));
      try {
        var storedTelemetry = await store.get(sessionId, mode);
        sendJson(response, 200, {
          telemetry: storedTelemetry,
          receivedAt: storedTelemetry ? storedTelemetry.receivedAt : null,
          sessionId: sessionId,
          storage: storageMetadata(store),
        });
      } catch (_) {
        sendJson(response, 503, {
          error: '공유 텔레메트리 저장소에 연결하지 못했습니다.',
          sessionId: sessionId,
          storage: storageMetadata(store),
        });
      }
      return;
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      sendJson(response, 405, { error: 'GET 또는 POST 요청만 지원합니다.' });
      return;
    }

    var body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, { error: '텔레메트리 요청 형식을 확인해 주세요.' });
      return;
    }

    var telemetry = normalizeTelemetry(body);
    if (!telemetry) {
      sendJson(response, 400, { error: '정규화된 Anti Turtle telemetry가 아닙니다.' });
      return;
    }

    telemetry.receivedAt = new Date(now()).toISOString();
    try {
      var accepted = await store.put(telemetry.sessionId, telemetry);
      if (!accepted) {
        var current = await store.get(telemetry.sessionId, telemetry.sensorMode);
        sendJson(response, 202, {
          accepted: false,
          telemetry: current,
          sessionId: telemetry.sessionId,
          storage: storageMetadata(store),
        });
        return;
      }
      sendJson(response, 201, {
        accepted: true,
        telemetry: telemetry,
        sessionId: telemetry.sessionId,
        storage: storageMetadata(store),
      });
    } catch (_) {
      sendJson(response, 503, {
        error: '공유 텔레메트리 저장소에 연결하지 못했습니다.',
        sessionId: telemetry.sessionId,
        storage: storageMetadata(store),
      });
    }
  };
}

module.exports = {
  createTelemetryHandler: createTelemetryHandler,
  normalizeTelemetry: normalizeTelemetry,
};
