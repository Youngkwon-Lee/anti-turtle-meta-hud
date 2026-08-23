'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var relayProtocol = require('../public/relay-protocol');

test('uses one backwards-compatible default session for the existing URLs', function () {
  assert.equal(relayProtocol.sessionFromSearch(''), 'head-demo');
  assert.equal(relayProtocol.sessionFromSearch('?camera=1&source=head'), 'head-demo');
});

test('accepts a safe explicit session and rejects unsafe identifiers', function () {
  assert.equal(relayProtocol.sessionFromSearch('?session=pilot_01'), 'pilot_01');
  assert.equal(relayProtocol.sessionFromSearch('?session=../secret'), 'head-demo');
});

test('sender adds a monotonic sequence and transport timestamps', function () {
  var tick = 1000;
  var sender = relayProtocol.createSender({
    sessionId: 'pilot_01',
    streamId: 'stream-a',
    now: function () { tick += 10; return tick; },
  });
  var first = sender.decorate({ forwardDeg: 4 });
  var second = sender.decorate({ forwardDeg: 8 });
  assert.deepEqual([first.seq, second.seq], [1, 2]);
  assert.deepEqual([first.sentAt, second.sentAt], [1010, 1020]);
  assert.equal(second.sessionId, 'pilot_01');
  assert.equal(second.streamId, 'stream-a');
});

test('receiver ignores duplicates and out-of-order packets in one stream', function () {
  var receiver = relayProtocol.createReceiver();
  assert.equal(receiver.accept({ streamId: 'stream-a', seq: 2, sentAt: 2000 }), true);
  assert.equal(receiver.accept({ streamId: 'stream-a', seq: 2, sentAt: 2000 }), false);
  assert.equal(receiver.accept({ streamId: 'stream-a', seq: 1, sentAt: 1000 }), false);
  assert.equal(receiver.accept({ streamId: 'stream-a', seq: 3, sentAt: 3000 }), true);
});

test('receiver accepts a restarted sender stream with a reset sequence', function () {
  var receiver = relayProtocol.createReceiver();
  assert.equal(receiver.accept({ streamId: 'stream-a', seq: 20, sentAt: 8000 }), true);
  assert.equal(receiver.accept({ streamId: 'stream-b', seq: 1, sentAt: 9000 }), true);
  assert.deepEqual(receiver.snapshot(), { streamId: 'stream-b', seq: 1, sentAt: 9000 });
});

test('receiver rejects a late packet from an older sender stream', function () {
  var receiver = relayProtocol.createReceiver();
  assert.equal(receiver.accept({ streamId: 'new-tab', seq: 1, sentAt: 9000 }), true);
  assert.equal(receiver.accept({ streamId: 'old-tab', seq: 90, sentAt: 8000 }), false);
  assert.deepEqual(receiver.snapshot(), { streamId: 'new-tab', seq: 1, sentAt: 9000 });
});

test('builds a mode-specific encoded endpoint', function () {
  assert.equal(
    relayProtocol.telemetryUrl('pilot_01', 'head'),
    '/api/telemetry?session=pilot_01&mode=HEAD'
  );
});
