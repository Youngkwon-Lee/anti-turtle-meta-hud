'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var runtimeMode = require('../public/runtime-mode');

test('dedicated head-only host defaults its root page to the sensor sender', function () {
  assert.equal(runtimeMode.shouldUseHeadOnlyMode('', 'my-head-only-app.example'), true);
});

test('head camera receiver does not start the local sensor sender', function () {
  assert.equal(runtimeMode.shouldUseHeadOnlyMode(
    '?camera=1&source=head',
    'my-head-only-app.example'
  ), false);
});

test('explicit head-only mode still works on another host', function () {
  assert.equal(runtimeMode.shouldUseHeadOnlyMode('?headonly=1', 'localhost'), true);
});

test('hybrid mode takes precedence over the dedicated hostname', function () {
  assert.equal(runtimeMode.shouldUseHeadOnlyMode(
    '?hybrid=1',
    'my-head-only-app.example'
  ), false);
});
