'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');

var publicRoot = path.join(__dirname, '..', 'public');

test('anatomical Lottie asset references both posture endpoint images', function () {
  var animation = JSON.parse(fs.readFileSync(
    path.join(publicRoot, 'assets', 'posture-anatomy.lottie.json'),
    'utf8'
  ));
  var assetNames = animation.assets.map(function (asset) { return asset.p; });

  assert.deepEqual(assetNames, [
    'posture-anatomy-neutral.webp',
    'posture-anatomy-forward.webp',
  ]);
  assert.equal(animation.fr, 30);
  assert.equal(animation.op, 61);
  assetNames.forEach(function (assetName) {
    assert.equal(fs.existsSync(path.join(publicRoot, 'assets', assetName)), true);
  });
});
