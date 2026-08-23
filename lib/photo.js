'use strict';

var MAX_BODY_BYTES = 3 * 1024 * 1024;
var MAX_IMAGE_BYTES = 2 * 1024 * 1024;
var latestPhoto = null;

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

function createPhotoHandler() {
  return async function photoHandler(request, response) {
    if (request.method === 'GET') {
      if (!latestPhoto) {
        sendJson(response, 200, { photo: null });
        return;
      }
      sendJson(response, 200, { photo: latestPhoto });
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
      sendJson(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, { error: '사진 요청 형식을 확인해 주세요.' });
      return;
    }

    var imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
    var match = imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      sendJson(response, 400, { error: 'JPEG, PNG 또는 WebP 사진만 릴레이할 수 있습니다.' });
      return;
    }

    var imageBytes;
    try {
      imageBytes = Buffer.from(match[2], 'base64');
    } catch (error) {
      sendJson(response, 400, { error: '사진 데이터를 읽지 못했습니다.' });
      return;
    }
    if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES) {
      sendJson(response, 413, { error: '사진은 2MB 이하로 선택해 주세요.' });
      return;
    }

    latestPhoto = {
      imageDataUrl: imageDataUrl,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : 'META AI PHOTO',
      updatedAt: new Date().toISOString(),
    };
    sendJson(response, 201, { photo: { name: latestPhoto.name, updatedAt: latestPhoto.updatedAt } });
  };
}

module.exports = {
  createPhotoHandler: createPhotoHandler,
  readJsonBody: readJsonBody,
};
