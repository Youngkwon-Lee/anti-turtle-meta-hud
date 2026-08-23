(function () {
  'use strict';

  var NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  var NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  var NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  var decoder = new TextDecoder();
  var lineBuffer = '';
  var rxCharacteristic = null;
  var pendingSample = null;
  var relayBusy = false;
  var lastRelayAt = 0;

  var statusDot = document.getElementById('status-dot');
  var statusLabel = document.getElementById('status-label');
  var pitchValue = document.getElementById('pitch-value');
  var trustValue = document.getElementById('trust-value');
  var relayValue = document.getElementById('relay-value');
  var connectButton = document.getElementById('connect-button');
  var zeroButton = document.getElementById('zero-button');
  var supportNote = document.getElementById('support-note');

  function setStatus(label, live) {
    statusLabel.textContent = label;
    statusDot.classList.toggle('live', Boolean(live));
  }

  function relayLatest() {
    if (relayBusy || !pendingSample) return;
    var elapsed = Date.now() - lastRelayAt;
    if (elapsed < 100) {
      window.setTimeout(relayLatest, 100 - elapsed);
      return;
    }
    var sample = pendingSample;
    pendingSample = null;
    relayBusy = true;
    fetch('/api/torso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample),
    }).then(function (response) {
      if (!response.ok) throw new Error('relay failed');
      lastRelayAt = Date.now();
      relayValue.textContent = 'LIVE';
    }).catch(function () {
      relayValue.textContent = 'OFFLINE';
    }).finally(function () {
      relayBusy = false;
      if (pendingSample) relayLatest();
    });
  }

  function acceptLine(line) {
    var sample = window.AntiTurtleTorsoParser.parseTorsoLine(line);
    if (!sample) return;
    pitchValue.textContent = sample.pitchDeg.toFixed(1) + '°';
    trustValue.textContent = sample.trusted ? 'GOOD' : 'MOTION';
    pendingSample = sample;
    relayLatest();
  }

  function onNotification(event) {
    lineBuffer += decoder.decode(event.target.value, { stream: true });
    var newlineIndex = lineBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      acceptLine(lineBuffer.slice(0, newlineIndex).replace(/\r$/, ''));
      lineBuffer = lineBuffer.slice(newlineIndex + 1);
      newlineIndex = lineBuffer.indexOf('\n');
    }
    if (lineBuffer.length > 512) lineBuffer = '';
  }

  function onDisconnected() {
    setStatus('연결 끊김', false);
    connectButton.disabled = false;
    zeroButton.disabled = true;
    rxCharacteristic = null;
  }

  function connect() {
    if (!navigator.bluetooth) {
      setStatus('Web Bluetooth 미지원', false);
      supportNote.textContent = 'Android Chrome에서 HTTPS 주소로 다시 여세요.';
      return;
    }
    connectButton.disabled = true;
    setStatus('기기 선택 중', false);
    navigator.bluetooth.requestDevice({
      filters: [
        { name: 'AntiTurtle-ANGLE' },
        { name: 'AntiTurtle-TORSO' },
      ],
      optionalServices: [NUS_SERVICE],
    }).then(function (device) {
      device.addEventListener('gattserverdisconnected', onDisconnected);
      setStatus('BLE 연결 중', false);
      return device.gatt.connect();
    }).then(function (server) {
      return server.getPrimaryService(NUS_SERVICE);
    }).then(function (service) {
      return Promise.all([
        service.getCharacteristic(NUS_TX),
        service.getCharacteristic(NUS_RX),
      ]);
    }).then(function (characteristics) {
      var txCharacteristic = characteristics[0];
      rxCharacteristic = characteristics[1];
      txCharacteristic.addEventListener('characteristicvaluechanged', onNotification);
      return txCharacteristic.startNotifications();
    }).then(function () {
      setStatus('센서 연결됨', true);
      zeroButton.disabled = false;
    }).catch(function (error) {
      connectButton.disabled = false;
      setStatus(error.name === 'NotFoundError' ? '선택 취소됨' : '연결 실패', false);
    });
  }

  function resetZero() {
    if (!rxCharacteristic) return;
    rxCharacteristic.writeValue(new TextEncoder().encode('z')).catch(function () {
      setStatus('영점 명령 실패', false);
    });
  }

  connectButton.addEventListener('click', connect);
  zeroButton.addEventListener('click', resetZero);
})();
