'use strict';

var MAX_BODY_BYTES = 8 * 1024;
var RELAY_ORIGINS = {
  'http://localhost:4173': true,
  'http://127.0.0.1:4173': true,
};

function allowRelayOrigin(request, response) {
  var origin = request.headers && request.headers.origin;
  if (!origin || !RELAY_ORIGINS[origin]) return false;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Max-Age', '600');
  response.setHeader('Vary', 'Origin');
  return true;
}

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

function finiteNumber(value) {
  var number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function createTorsoHandler() {
  var latestSample = null;

  return async function torsoHandler(request, response) {
    var relayOriginAllowed = allowRelayOrigin(request, response);
    if (request.method === 'OPTIONS') {
      response.statusCode = relayOriginAllowed ? 204 : 403;
      response.end();
      return;
    }

    if (request.method === 'GET') {
      sendJson(response, 200, {
        sample: latestSample,
        ageMs: latestSample ? Math.max(0, Date.now() - latestSample.receivedAtMs) : null,
      });
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
      sendJson(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400,
        { error: '몸통 센서 요청 형식을 확인해 주세요.' });
      return;
    }

    var pitchDeg = finiteNumber(body.pitchDeg);
    var deltaDeg = body.deltaDeg === undefined ? 0 : finiteNumber(body.deltaDeg);
    var gyroYDps = body.gyroYDps === undefined ? null : finiteNumber(body.gyroYDps);
    var accNormMg = body.accNormMg === undefined ? null : finiteNumber(body.accNormMg);
    var deviceMs = finiteNumber(body.deviceMs);
    var trusted = body.trusted === true || body.trusted === 1 || body.trusted === '1';

    if (pitchDeg === null || pitchDeg < -180 || pitchDeg > 180 ||
        deltaDeg === null ||
        (body.gyroYDps !== undefined && gyroYDps === null) ||
        (body.accNormMg !== undefined && accNormMg === null) ||
        deviceMs === null || deviceMs < 0) {
      sendJson(response, 400, { error: '유효한 TORSO 센서 샘플이 아닙니다.' });
      return;
    }

    latestSample = {
      schema: 'kinelo.anti-turtle.torso',
      version: '0.1',
      deviceId: typeof body.deviceId === 'string' && body.deviceId.trim()
        ? body.deviceId.trim().slice(0, 64)
        : 'AntiTurtle-TORSO',
      deviceMs: deviceMs,
      pitchDeg: pitchDeg,
      deltaDeg: deltaDeg,
      gyroYDps: gyroYDps,
      accNormMg: accNormMg,
      trusted: trusted,
      receivedAt: new Date().toISOString(),
      receivedAtMs: Date.now(),
    };
    sendJson(response, 202, { sample: latestSample });
  };
}

module.exports = {
  allowRelayOrigin: allowRelayOrigin,
  createTorsoHandler: createTorsoHandler,
  readJsonBody: readJsonBody,
};
