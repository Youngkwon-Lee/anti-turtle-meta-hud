(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AntiTurtleTorsoParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parseNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function parseTorsoLine(line) {
    if (typeof line !== 'string') return null;
    var trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#' || trimmed.indexOf('ms,role,') === 0) return null;

    var fields = trimmed.split(',');
    if (fields.length === 7 && fields[1] === 'TORSO') {
      return parseLegacyTorso(fields);
    }
    if (fields.length >= 12 && (fields[1] === 'SINGLE' || fields[1] === 'DUAL')) {
      return parseAngleSensor(fields);
    }
    return null;
  }

  function parseLegacyTorso(fields) {
    var deviceMs = parseNumber(fields[0]);
    var pitchDeg = parseNumber(fields[2]);
    var deltaDeg = parseNumber(fields[3]);
    var gyroYDps = parseNumber(fields[4]);
    var accNormMg = parseNumber(fields[5]);
    var trustedNumber = parseNumber(fields[6]);
    if (deviceMs === null || pitchDeg === null || deltaDeg === null ||
        gyroYDps === null || accNormMg === null ||
        (trustedNumber !== 0 && trustedNumber !== 1)) return null;

    return {
      deviceId: 'AntiTurtle-TORSO',
      deviceMs: deviceMs,
      pitchDeg: pitchDeg,
      deltaDeg: deltaDeg,
      gyroYDps: gyroYDps,
      accNormMg: accNormMg,
      trusted: trustedNumber === 1,
    };
  }

  function parseAngleSensor(fields) {
    var deviceMs = parseNumber(fields[0]);
    var pitchDeg = parseNumber(fields[3]);
    var deltaDeg = parseNumber(fields[4]);
    var gyroYDps = parseNumber(fields[7]);
    var accNormMg = parseNumber(fields[9]);
    var trustedNumber = parseNumber(fields[11]);
    if (deviceMs === null || pitchDeg === null || deltaDeg === null ||
        gyroYDps === null || accNormMg === null ||
        (trustedNumber !== 0 && trustedNumber !== 1)) return null;

    return {
      deviceId: 'AntiTurtle-ANGLE',
      deviceMs: deviceMs,
      pitchDeg: pitchDeg,
      deltaDeg: deltaDeg,
      gyroYDps: gyroYDps,
      accNormMg: accNormMg,
      trusted: trustedNumber === 1,
      sourceRole: fields[1],
    };
  }

  return { parseTorsoLine: parseTorsoLine };
});
