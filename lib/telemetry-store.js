'use strict';

var DEFAULT_SESSION_ID = 'head-demo';
var DEFAULT_TTL_SECONDS = 10;
var ALLOWED_MODES = new Set(['ANY', 'HEAD', 'HYBRID', 'TORSO']);

function normalizeIdentifier(value, fallback, maxLength) {
  var text = typeof value === 'string' ? value.trim() : '';
  if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) return fallback;
  return text.slice(0, maxLength);
}

function normalizeSessionId(value) {
  return normalizeIdentifier(value, DEFAULT_SESSION_ID, 64);
}

function normalizeStreamId(value) {
  return normalizeIdentifier(value, 'legacy', 80);
}

function normalizeMode(value) {
  var mode = typeof value === 'string' ? value.trim().toUpperCase() : 'ANY';
  return ALLOWED_MODES.has(mode) ? mode : 'ANY';
}

function entryKey(sessionId, mode) {
  return normalizeSessionId(sessionId) + ':' + normalizeMode(mode);
}

function isNewer(current, next) {
  if (!current) return true;
  if (normalizeStreamId(current.streamId) === normalizeStreamId(next.streamId)) {
    return Number(next.seq) > Number(current.seq);
  }
  return Number(next.sentAt) > Number(current.sentAt);
}

function createMemoryTelemetryStore(options) {
  var settings = options || {};
  var now = settings.now || Date.now;
  var ttlMs = Math.max(1000, Number(settings.ttlMs) || DEFAULT_TTL_SECONDS * 1000);
  var entries = new Map();

  function getEntry(sessionId, mode) {
    var key = entryKey(sessionId, mode);
    var entry = entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      entries.delete(key);
      return null;
    }
    return entry.telemetry;
  }

  return {
    kind: 'memory',
    shared: false,
    get: async function (sessionId, mode) {
      return getEntry(sessionId, mode);
    },
    put: async function (sessionId, telemetry) {
      var mode = normalizeMode(telemetry.sensorMode);
      var current = getEntry(sessionId, mode);
      if (!isNewer(current, telemetry)) return false;
      var entry = { telemetry: telemetry, expiresAt: now() + ttlMs };
      entries.set(entryKey(sessionId, mode), entry);
      entries.set(entryKey(sessionId, 'ANY'), entry);
      return true;
    },
  };
}

function redisSettings(options) {
  var settings = options || {};
  var env = settings.env || process.env;
  var url = settings.url || env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  var token = settings.token || env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: String(url).replace(/\/+$/, ''), token: String(token) };
}

function createRedisTelemetryStore(options) {
  var settings = options || {};
  var config = redisSettings(settings);
  if (!config) return null;
  var fetchFn = settings.fetch || globalThis.fetch;
  var ttlSeconds = Math.max(2, Math.round(Number(settings.ttlSeconds) || DEFAULT_TTL_SECONDS));
  if (typeof fetchFn !== 'function') throw new Error('Redis telemetry store requires fetch.');

  async function command(parts) {
    var response = await fetchFn(config.url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parts),
    });
    if (!response.ok) throw new Error('Shared telemetry store returned ' + response.status + '.');
    var payload = await response.json();
    if (payload.error) throw new Error('Shared telemetry store command failed.');
    return payload.result;
  }

  function redisKey(sessionId, mode) {
    return 'anti-turtle:telemetry:' + entryKey(sessionId, mode);
  }

  return {
    kind: 'upstash-redis',
    shared: true,
    get: async function (sessionId, mode) {
      var result = await command(['GET', redisKey(sessionId, mode)]);
      if (!result) return null;
      if (typeof result === 'object') return result;
      try {
        return JSON.parse(result);
      } catch (_) {
        throw new Error('Shared telemetry store returned invalid JSON.');
      }
    },
    put: async function (sessionId, telemetry) {
      var modeKey = redisKey(sessionId, telemetry.sensorMode);
      var anyKey = redisKey(sessionId, 'ANY');
      var script = [
        "local current = redis.call('GET', KEYS[1])",
        'if current then',
        '  local decoded = cjson.decode(current)',
        '  if tostring(decoded.streamId) == ARGV[3] and tonumber(decoded.seq) >= tonumber(ARGV[2]) then',
        '    return 0',
        '  end',
        '  if tostring(decoded.streamId) ~= ARGV[3] and tonumber(decoded.sentAt or 0) >= tonumber(ARGV[5]) then',
        '    return 0',
        '  end',
        'end',
        "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[4])",
        "redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[4])",
        'return 1',
      ].join('\n');
      var result = await command([
        'EVAL', script, '2', modeKey, anyKey,
        JSON.stringify(telemetry), String(telemetry.seq),
        normalizeStreamId(telemetry.streamId), String(ttlSeconds), String(telemetry.sentAt || 0),
      ]);
      return Number(result) === 1;
    },
  };
}

function createTelemetryStore(options) {
  return createRedisTelemetryStore(options) || createMemoryTelemetryStore(options);
}

module.exports = {
  DEFAULT_SESSION_ID: DEFAULT_SESSION_ID,
  createMemoryTelemetryStore: createMemoryTelemetryStore,
  createRedisTelemetryStore: createRedisTelemetryStore,
  createTelemetryStore: createTelemetryStore,
  isNewer: isNewer,
  normalizeMode: normalizeMode,
  normalizeSessionId: normalizeSessionId,
  normalizeStreamId: normalizeStreamId,
};
