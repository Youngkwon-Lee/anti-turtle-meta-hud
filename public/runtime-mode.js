(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AntiTurtleRuntimeMode = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isDedicatedHeadHost(hostname) {
    return String(hostname || '').toLowerCase().indexOf('head-only') !== -1;
  }

  function shouldUseHeadOnlyMode(search, hostname) {
    var params = new URLSearchParams(search || '');
    if (params.get('hybrid') === '1') return false;
    if (params.get('headonly') === '1') return true;

    return isDedicatedHeadHost(hostname) &&
      !params.get('source') &&
      params.get('camera') !== '1';
  }

  return {
    isDedicatedHeadHost: isDedicatedHeadHost,
    shouldUseHeadOnlyMode: shouldUseHeadOnlyMode,
  };
});
