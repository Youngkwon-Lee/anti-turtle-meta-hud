'use strict';

var MAX_BODY_BYTES = 16 * 1024;
var MAX_PROMPT_LENGTH = 1200;

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  if (request.body && typeof request.body === 'object') {
    return Promise.resolve(request.body);
  }

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

function extractOutputText(payload) {
  if (payload && typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  var output = payload && Array.isArray(payload.output) ? payload.output : [];
  var textParts = [];
  output.forEach(function (item) {
    if (!item || !Array.isArray(item.content)) return;
    item.content.forEach(function (content) {
      if (content && content.type === 'output_text' && typeof content.text === 'string') {
        textParts.push(content.text);
      }
    });
  });
  return textParts.join('\n').trim();
}

function createBridgeHandler(options) {
  options = options || {};
  var fetchImpl = options.fetchImpl || globalThis.fetch;
  var apiKey = options.apiKey === undefined ? process.env.OPENAI_API_KEY : options.apiKey;
  var model = options.model || process.env.OPENAI_MODEL || 'gpt-5.4';
  var apiUrl = options.apiUrl || 'https://api.openai.com/v1/responses';

  return async function bridgeHandler(request, response) {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendJson(response, 405, { error: 'POST 요청만 지원합니다.' });
      return;
    }

    if (!apiKey) {
      sendJson(response, 503, { error: '서버의 OpenAI 연결이 아직 설정되지 않았습니다.' });
      return;
    }

    var body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      var status = error.code === 'BODY_TOO_LARGE' ? 413 : 400;
      sendJson(response, status, { error: '요청 형식을 확인해 주세요.' });
      return;
    }

    var prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      sendJson(response, 400, { error: '질문을 입력해 주세요.' });
      return;
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      sendJson(response, 400, { error: '질문은 1200자 이내로 입력해 주세요.' });
      return;
    }

    var upstreamResponse;
    try {
      upstreamResponse = await fetchImpl(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          instructions: [
            'You are Kinelo Anti Turtle, a concise posture coach shown on Meta Ray-Ban Display glasses.',
            'Reply in the language used by the wearer.',
            'Give supportive, practical posture guidance without making medical diagnoses.',
            'Use one short paragraph and stay under 55 words unless safety requires more context.',
          ].join(' '),
          input: prompt,
          max_output_tokens: 500,
          store: false,
        }),
      });
    } catch (error) {
      sendJson(response, 502, { error: 'OpenAI 서버에 연결하지 못했습니다.' });
      return;
    }

    var payload;
    try {
      payload = await upstreamResponse.json();
    } catch (error) {
      sendJson(response, 502, { error: 'OpenAI 응답 형식을 읽지 못했습니다.' });
      return;
    }

    if (!upstreamResponse.ok) {
      var upstreamMessage = payload && payload.error && payload.error.message;
      var safeMessage = upstreamResponse.status === 429
        ? '요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
        : upstreamResponse.status === 401
          ? 'OpenAI 연결 인증을 확인해 주세요.'
          : 'OpenAI 요청을 완료하지 못했습니다.';
      if (process.env.NODE_ENV !== 'production' && upstreamMessage) {
        safeMessage += ' (' + upstreamResponse.status + ')';
      }
      sendJson(response, 502, { error: safeMessage });
      return;
    }

    var answer = extractOutputText(payload);
    if (!answer) {
      sendJson(response, 502, { error: 'OpenAI에서 빈 응답이 도착했습니다.' });
      return;
    }

    sendJson(response, 200, {
      answer: answer,
      responseId: payload.id || null,
      model: payload.model || model,
    });
  };
}

module.exports = {
  createBridgeHandler: createBridgeHandler,
  extractOutputText: extractOutputText,
  readJsonBody: readJsonBody,
};
