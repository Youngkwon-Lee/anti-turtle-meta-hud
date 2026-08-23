'use strict';

var assert = require('node:assert/strict');
var EventEmitter = require('node:events');
var test = require('node:test');
var createPhotoHandler = require('../lib/photo').createPhotoHandler;

function createRequest(method, body) {
  var request = new EventEmitter();
  request.method = method;
  request.body = body;
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

test('photo relay stores and reads the latest photo', async function () {
  var handler = createPhotoHandler();
  var imageDataUrl = 'data:image/png;base64,' + Buffer.from('photo').toString('base64');
  var uploadResponse = createResponse();
  await handler(createRequest('POST', { imageDataUrl: imageDataUrl, name: 'meta-ai.png' }), uploadResponse);
  assert.equal(uploadResponse.statusCode, 201);

  var readResponse = createResponse();
  await handler(createRequest('GET'), readResponse);
  var payload = JSON.parse(readResponse.body);
  assert.equal(readResponse.statusCode, 200);
  assert.equal(payload.photo.imageDataUrl, imageDataUrl);
  assert.equal(payload.photo.name, 'meta-ai.png');
});

test('photo relay rejects unsupported image data', async function () {
  var handler = createPhotoHandler();
  var response = createResponse();
  await handler(createRequest('POST', { imageDataUrl: 'data:image/svg+xml;base64,abc' }), response);
  assert.equal(response.statusCode, 400);
});
