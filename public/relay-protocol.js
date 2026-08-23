(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AntiTurtleRelayProtocol = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_SESSION_ID = 'head-demo';

  function normalizeId(value, fallback, maxLength) {
    var text = typeof value === 'string' ? value.trim() : '';
    if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) return fallback;
    return text.slice(0, maxLength);
  }

  function sessionFromSearch(search) {
    var params = new URLSearchParams(search || '');
    return normalizeId(params.get('session'), DEFAULT_SESSION_ID, 64);
  }

  function createStreamId(randomUUID, now) {
    var value = typeof randomUUID === 'function' ? randomUUID() : '';
    return normalizeId(value, 'stream-' + String((now || Date.now)()), 80);
  }

  function createSender(options) {
    var settings = options || {};
    var now = settings.now || Date.now;
    var sessionId = normalizeId(settings.sessionId, DEFAULT_SESSION_ID, 64);
    var streamId = normalizeId(settings.streamId, '', 80);
    if (!streamId) streamId = createStreamId(null, now);
    var sequence = 0;

    return {
      decorate: function (telemetry) {
        sequence += 1;
        return Object.assign({}, telemetry, {
          sessionId: sessionId,
          streamId: streamId,
          seq: sequence,
          sentAt: now(),
        });
      },
      sessionId: sessionId,
      streamId: streamId,
    };
  }

  function createReceiver() {
    var streamId = null;
    var sequence = -1;
    var sentAt = -1;

    return {
      accept: function (telemetry) {
        if (!telemetry || typeof telemetry !== 'object') return false;
        var incomingStream = normalizeId(telemetry.streamId, '', 80);
        var incomingSequence = Number(telemetry.seq);
        var incomingSentAt = Number(telemetry.sentAt);
        if (!incomingStream || !Number.isSafeInteger(incomingSequence) || incomingSequence < 0) return true;
        if (incomingStream === streamId && incomingSequence <= sequence) return false;
        if (incomingStream !== streamId && Number.isFinite(incomingSentAt) && incomingSentAt <= sentAt) return false;
        streamId = incomingStream;
        sequence = incomingSequence;
        sentAt = Number.isFinite(incomingSentAt) ? incomingSentAt : sentAt;
        return true;
      },
      reset: function () {
        streamId = null;
        sequence = -1;
        sentAt = -1;
      },
      snapshot: function () {
        return { streamId: streamId, seq: sequence, sentAt: sentAt };
      },
    };
  }

  function telemetryUrl(sessionId, mode) {
    var params = new URLSearchParams();
    params.set('session', normalizeId(sessionId, DEFAULT_SESSION_ID, 64));
    if (mode) params.set('mode', String(mode).toUpperCase());
    return '/api/telemetry?' + params.toString();
  }

  return {
    DEFAULT_SESSION_ID: DEFAULT_SESSION_ID,
    createReceiver: createReceiver,
    createSender: createSender,
    createStreamId: createStreamId,
    sessionFromSearch: sessionFromSearch,
    telemetryUrl: telemetryUrl,
  };
});
