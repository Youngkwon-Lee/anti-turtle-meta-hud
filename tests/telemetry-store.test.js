'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var telemetryStore = require('../lib/telemetry-store');

function packet(streamId, seq, mode) {
  return {
    streamId: streamId,
    seq: seq,
    sentAt: seq * 1000,
    sensorMode: mode || 'HEAD',
    receivedAt: '2026-08-22T00:00:00.000Z',
  };
}

test('memory store keeps sessions and modes separate', async function () {
  var store = telemetryStore.createMemoryTelemetryStore();
  await store.put('pilot_a', packet('a', 1, 'HEAD'));
  await store.put('pilot_b', packet('b', 1, 'HYBRID'));
  assert.equal((await store.get('pilot_a', 'HEAD')).streamId, 'a');
  assert.equal(await store.get('pilot_a', 'HYBRID'), null);
  assert.equal((await store.get('pilot_b', 'ANY')).streamId, 'b');
});

test('memory store expires the latest sample', async function () {
  var tick = 1000;
  var store = telemetryStore.createMemoryTelemetryStore({
    now: function () { return tick; },
    ttlMs: 1000,
  });
  await store.put('pilot', packet('a', 1));
  tick = 1999;
  assert.ok(await store.get('pilot', 'HEAD'));
  tick = 2000;
  assert.equal(await store.get('pilot', 'HEAD'), null);
});

test('memory store prevents sequence rollback but allows a new stream', async function () {
  var store = telemetryStore.createMemoryTelemetryStore();
  assert.equal(await store.put('pilot', packet('a', 3)), true);
  assert.equal(await store.put('pilot', packet('a', 2)), false);
  assert.equal((await store.get('pilot', 'HEAD')).seq, 3);
  var restarted = packet('b', 1);
  restarted.sentAt = 4000;
  assert.equal(await store.put('pilot', restarted), true);
  assert.equal((await store.get('pilot', 'HEAD')).streamId, 'b');
});

test('memory store rejects a late packet from an older sender stream', async function () {
  var store = telemetryStore.createMemoryTelemetryStore();
  var current = packet('new-tab', 1);
  current.sentAt = 5000;
  var late = packet('old-tab', 90);
  late.sentAt = 4000;
  assert.equal(await store.put('pilot', current), true);
  assert.equal(await store.put('pilot', late), false);
  assert.equal((await store.get('pilot', 'HEAD')).streamId, 'new-tab');
});

test('redis store uses an atomic ordered write and a shared key read', async function () {
  var commands = [];
  var stored = JSON.stringify(packet('a', 4));
  var store = telemetryStore.createRedisTelemetryStore({
    url: 'https://redis.example',
    token: 'test-token',
    fetch: async function (_, options) {
      var command = JSON.parse(options.body);
      commands.push(command);
      var result = command[0] === 'GET' ? stored : 1;
      return { ok: true, json: async function () { return { result: result }; } };
    },
  });
  assert.equal(store.shared, true);
  assert.equal(await store.put('pilot', packet('a', 4)), true);
  assert.equal((await store.get('pilot', 'HEAD')).seq, 4);
  assert.equal(commands[0][0], 'EVAL');
  assert.equal(commands[0][2], '2');
  assert.equal(commands[0][9], '4000');
  assert.deepEqual(commands[1], ['GET', 'anti-turtle:telemetry:pilot:HEAD']);
});
