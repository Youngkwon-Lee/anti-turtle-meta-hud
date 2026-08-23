'use strict';

var assert = require('node:assert/strict');
var EventEmitter = require('node:events');
var test = require('node:test');
var createBridgeHandler = require('../lib/bridge').createBridgeHandler;
var extractOutputText = require('../lib/bridge').extractOutputText;

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
    setHeader: function (name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end: function (body) {
      this.body = body;
    },
  };
}

test('extractOutputText supports nested Responses API output', function () {
  var text = extractOutputText({
    output: [
      { content: [{ type: 'output_text', text: '첫 문장' }] },
      { content: [{ type: 'output_text', text: '둘째 문장' }] },
    ],
  });
  assert.equal(text, '첫 문장\n둘째 문장');
});

test('handler rejects requests without a configured key', async function () {
  var handler = createBridgeHandler({ apiKey: '' });
  var response = createResponse();
  await handler(createRequest('POST', { prompt: 'hello' }), response);
  assert.equal(response.statusCode, 503);
  assert.match(JSON.parse(response.body).error, /설정/);
});

test('handler validates empty prompts before calling upstream', async function () {
  var called = false;
  var handler = createBridgeHandler({
    apiKey: 'test-key',
    fetchImpl: async function () {
      called = true;
    },
  });
  var response = createResponse();
  await handler(createRequest('POST', { prompt: '   ' }), response);
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
});

test('handler returns a concise answer from OpenAI', async function () {
  var upstreamRequest;
  var handler = createBridgeHandler({
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async function (url, options) {
      upstreamRequest = { url: url, options: options };
      return {
        ok: true,
        status: 200,
        json: async function () {
          return {
            id: 'resp_test',
            model: 'test-model',
            output: [{ content: [{ type: 'output_text', text: '연결되었습니다.' }] }],
          };
        },
      };
    },
  });
  var response = createResponse();
  await handler(createRequest('POST', { prompt: '상태를 알려줘' }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).answer, '연결되었습니다.');
  assert.equal(upstreamRequest.url, 'https://api.openai.com/v1/responses');
  assert.equal(JSON.parse(upstreamRequest.options.body).store, false);
  assert.match(upstreamRequest.options.headers.Authorization, /^Bearer /);
});

test('handler masks upstream failures', async function () {
  var handler = createBridgeHandler({
    apiKey: 'test-key',
    fetchImpl: async function () {
      return {
        ok: false,
        status: 500,
        json: async function () {
          return { error: { message: 'sensitive upstream detail' } };
        },
      };
    },
  });
  var response = createResponse();
  await handler(createRequest('POST', { prompt: 'hello' }), response);

  assert.equal(response.statusCode, 502);
  assert.doesNotMatch(response.body, /sensitive upstream detail/);
});
