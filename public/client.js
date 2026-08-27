(function () {
  'use strict';

  var CONFIG = {
    endpoint: '/api/ask',
    torsoEndpoint: '/api/torso',
    requestTimeoutMs: 35000,
    sensorTimeoutMs: 3000,
    torsoPollMs: 250,
    torsoStaleMs: 2000,
    telemetryPollMs: 900,
    presentationTelemetryPollMs: 100,
    telemetryPostMs: 200,
    telemetryStaleMs: 1500,
    uiIntervalMs: 50,
    demoIntervalMs: 100,
    headReseatGapMs: 2000,
    headReseatJumpDeg: 45,
  };

  var state = {
    currentScreen: 'monitor',
    engine: null,
    running: false,
    mode: null,
    sensorListening: false,
    sensorTimeout: null,
    torsoPollTimer: null,
    torsoPollingActive: false,
    torsoRequestBusy: false,
    demoTimer: null,
    toastTimer: null,
    lastUpdateAt: 0,
    lastHeadPitch: null,
    lastTorsoPitch: 0,
    lastTorsoReceivedAt: 0,
    lastSnapshot: null,
    summary: null,
    coachLoading: false,
    photo: null,
    photoLoading: false,
    externalTelemetry: null,
    telemetryPollTimer: null,
    telemetryRequestBusy: false,
    telemetryPostTimer: null,
    telemetryPostBusy: false,
    telemetryPostController: null,
    telemetryLastPostStartedAt: 0,
    pendingTelemetry: null,
    lastTelemetryPostAt: 0,
    telemetrySender: null,
    telemetryReceiver: null,
    relaySessionId: null,
    relayShared: null,
    bleDevice: null,
    bleRx: null,
    bleTx: null,
    bleDecoder: new TextDecoder(),
    bleBuffer: '',
    bleConnecting: false,
    blePacketCount: 0,
    presentationMode: false,
    presentationDemo: false,
    presentationSource: null,
    hybridMode: false,
    cameraMode: false,
    cameraFacing: 'environment',
    cameraStarting: false,
    cameraStream: null,
    cameraUnavailable: false,
    desktopCameraPreview: false,
    headImuMode: false,
    headOnlyMode: false,
    headCalibration: null,
    headNeedsCalibration: false,
    lastRawHeadPitch: null,
    lastHeadSampleAt: null,
    headReliability: 'idle',
    postureAnimation: null,
    postureAnimationReady: false,
  };

  var elements = {};

  function cacheElements() {
    elements.monitor = document.getElementById('monitor');
    elements.summary = document.getElementById('summary');
    elements.photoRelay = document.getElementById('photo-relay');
    elements.sensorLink = document.getElementById('sensor-link');
    elements.presentationHud = document.getElementById('presentation-hud');
    elements.cameraFeed = document.getElementById('camera-feed');
    elements.cameraShade = document.getElementById('camera-shade');
    elements.cameraIndicator = document.getElementById('camera-indicator');
    elements.cameraIndicatorLabel = document.getElementById('camera-indicator-label');
    elements.cameraGate = document.getElementById('camera-gate');
    elements.cameraMessage = document.getElementById('camera-message');
    elements.cameraAction = document.getElementById('camera-action');
    elements.cameraActionLabel = document.getElementById('camera-action-label');
    elements.sourceStatus = document.getElementById('source-status');
    elements.sourceLabel = elements.sourceStatus.querySelector('.status-label');
    elements.posturePanel = document.getElementById('posture-panel');
    elements.postureState = document.getElementById('posture-state');
    elements.deviationValue = document.getElementById('deviation-value');
    elements.coachCue = document.getElementById('coach-cue');
    elements.headPitch = document.getElementById('head-pitch');
    elements.torsoPitch = document.getElementById('torso-pitch');
    elements.badHold = document.getElementById('bad-hold');
    elements.thresholdFill = document.getElementById('threshold-fill');
    elements.primaryAction = document.getElementById('primary-action');
    elements.secondaryAction = document.getElementById('secondary-action');
    elements.primaryLabel = document.getElementById('primary-label');
    elements.secondaryLabel = document.getElementById('secondary-label');
    elements.goodPercent = document.getElementById('good-percent');
    elements.sessionTime = document.getElementById('session-time');
    elements.alertCount = document.getElementById('alert-count');
    elements.summarySource = document.getElementById('summary-source');
    elements.summaryLine = document.getElementById('summary-line');
    elements.coachPanel = document.getElementById('coach-panel');
    elements.coachText = document.getElementById('coach-text');
    elements.coachAction = document.getElementById('coach-action');
    elements.toast = document.getElementById('toast');
    elements.photoStatus = document.getElementById('photo-status');
    elements.photoStatusLabel = document.getElementById('photo-status-label');
    elements.photoPlaceholder = document.getElementById('photo-placeholder');
    elements.photoPreview = document.getElementById('photo-preview');
    elements.photoCaption = document.getElementById('photo-caption');
    elements.photoName = document.getElementById('photo-name');
    elements.photoTime = document.getElementById('photo-time');
    elements.photoInput = document.getElementById('photo-input');
    elements.bleStatus = document.getElementById('ble-status');
    elements.bleStatusLabel = document.getElementById('ble-status-label');
    elements.bleDeviceName = document.getElementById('ble-device-name');
    elements.bleSupportNote = document.getElementById('ble-support-note');
    elements.blePackets = document.getElementById('ble-packets');
    elements.bleAngle = document.getElementById('ble-angle');
    elements.bleRelay = document.getElementById('ble-relay');
    elements.connectBle = document.getElementById('connect-ble');
    elements.disconnectBle = document.getElementById('disconnect-ble');
    elements.hudAngle = document.getElementById('hud-angle');
    elements.hudLiveLabel = document.getElementById('hud-live-label');
    elements.hudState = document.getElementById('hud-state');
    elements.hudCue = document.getElementById('hud-cue');
    elements.hudHold = document.getElementById('hud-hold');
    elements.hudHeadPitch = document.getElementById('hud-head-pitch');
    elements.hudTorsoPitch = document.getElementById('hud-torso-pitch');
    elements.hudPostureFigure = document.getElementById('hud-posture-figure');
    elements.hudAnatomyAvatar = document.getElementById('hud-anatomy-avatar');
    elements.hudCorrectionArrow = document.getElementById('hud-correction-arrow');
    elements.headImuAction = document.getElementById('head-imu-action');
    elements.headImuActionLabel = document.getElementById('head-imu-action-label');
    elements.hudSensorPair = document.getElementById('hud-sensor-pair');
    elements.hudCalibration = document.getElementById('hud-calibration');
    elements.hudCalibrationLabel = document.getElementById('hud-calibration-label');
    elements.hudCalibrationDetail = document.getElementById('hud-calibration-detail');
    elements.hudCalibrationProgress = document.getElementById('hud-calibration-progress');
    elements.hudCalibrationFill = document.getElementById('hud-calibration-fill');
    elements.hudSignature = document.getElementById('hud-signature');
  }

  function getFocusableElements() {
    if (state.currentScreen === 'presentation-hud') {
      return Array.prototype.slice.call(
        elements.presentationHud.querySelectorAll('.focusable:not([disabled]):not([hidden])')
      ).filter(function (element) {
        return element.offsetParent !== null;
      });
    }
    var screen = state.currentScreen === 'monitor'
      ? elements.monitor
      : state.currentScreen === 'summary' ? elements.summary
        : state.currentScreen === 'photo-relay' ? elements.photoRelay : elements.sensorLink;
    return Array.prototype.slice.call(
      screen.querySelectorAll('.focusable:not([disabled]):not([hidden])')
    ).filter(function (element) {
      return element.offsetParent !== null;
    });
  }

  function moveFocus(direction) {
    var focusables = getFocusableElements();
    if (!focusables.length) return;
    var currentIndex = focusables.indexOf(document.activeElement);
    var step = direction === 'previous' ? -1 : 1;
    var nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + step + focusables.length) % focusables.length;
    focusables[nextIndex].focus();
    focusables[nextIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function canScrollCoach(direction) {
    if (document.activeElement !== elements.coachPanel) return false;
    if (direction === 'up' && elements.coachPanel.scrollTop > 0) {
      elements.coachPanel.scrollBy({ top: -72, behavior: 'smooth' });
      return true;
    }
    if (direction === 'down' && elements.coachPanel.scrollTop + elements.coachPanel.clientHeight < elements.coachPanel.scrollHeight - 2) {
      elements.coachPanel.scrollBy({ top: 72, behavior: 'smooth' });
      return true;
    }
    return false;
  }

  function handleKeydown(event) {
    var handled = true;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        if (!canScrollCoach('up')) moveFocus('previous');
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        if (!canScrollCoach('down')) moveFocus('next');
        break;
      case 'Enter':
        if (document.activeElement && document.activeElement.classList.contains('focusable')) {
          document.activeElement.click();
        }
        break;
      case 'Escape':
        if (state.currentScreen === 'summary') resetSession();
        else if (state.currentScreen === 'photo-relay' || state.currentScreen === 'sensor-link') navigateTo('monitor');
        else if (state.running) stopSession();
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  }

  function navigateTo(screenId) {
    if (state.presentationMode) {
      state.currentScreen = 'presentation-hud';
      elements.monitor.hidden = true;
      elements.summary.hidden = true;
      elements.photoRelay.hidden = true;
      elements.sensorLink.hidden = true;
      elements.presentationHud.hidden = false;
      if (state.presentationSource === 'ble' ||
          (state.presentationSource === 'head' && state.desktopCameraPreview)) startTelemetryPolling();
      else stopTelemetryPolling();
      return;
    }
    state.currentScreen = screenId;
    elements.monitor.hidden = screenId !== 'monitor';
    elements.summary.hidden = screenId !== 'summary';
    elements.photoRelay.hidden = screenId !== 'photo-relay';
    elements.sensorLink.hidden = screenId !== 'sensor-link';
    elements.presentationHud.hidden = true;
    if (screenId === 'photo-relay') loadLatestPhoto();
    if ((screenId === 'monitor' || screenId === 'sensor-link') && !state.presentationMode) startTelemetryPolling();
    else stopTelemetryPolling();
    window.requestAnimationFrame(function () {
      var focusables = getFocusableElements();
      if (focusables.length) focusables[0].focus();
    });
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    var words = message.trim().split(/\s+/).length;
    var duration = Math.min(8000, 3500 + Math.max(0, words - 2) * 300);
    state.toastTimer = window.setTimeout(function () {
      elements.toast.hidden = true;
    }, duration);
  }

  function formatAngle(value) {
    return Number.isFinite(value) ? value.toFixed(1) + '°' : '--°';
  }

  function formatDuration(milliseconds) {
    var seconds = Math.max(0, Math.round(milliseconds / 1000));
    var minutes = Math.floor(seconds / 60);
    return minutes + ':' + String(seconds % 60).padStart(2, '0');
  }

  function sourceName(mode) {
    if (mode === 'dual') return 'DUAL IMU';
    if (mode === 'demo') return 'DEMO';
    if (mode === 'glasses') return 'HEAD ONLY';
    return 'STANDBY';
  }

  function setSource(mode, labelOverride) {
    elements.sourceStatus.dataset.source = mode || 'idle';
    elements.sourceLabel.textContent = labelOverride || sourceName(mode);
  }

  function configureRunningActions() {
    elements.primaryAction.dataset.action = 'calibrate';
    elements.primaryLabel.textContent = 'CALIBRATE';
    elements.secondaryAction.dataset.action = 'stop-session';
    elements.secondaryLabel.textContent = 'END SESSION';
  }

  function configureIdleActions() {
    elements.primaryAction.dataset.action = 'start-sensors';
    elements.primaryLabel.textContent = 'START SENSOR';
    elements.secondaryAction.dataset.action = 'start-demo';
    elements.secondaryLabel.textContent = 'RUN DEMO';
  }

  function cueFor(snapshot) {
    if (snapshot.status === 'GOOD') return '좋습니다. 현재 자세를 유지하세요.';
    if (snapshot.status === 'CAUTION') return '턱을 가볍게 당길 준비를 하세요.';
    if (snapshot.alert) return '턱을 당기고 정수리를 위로 세우세요.';
    return '교정 알림까지 ' + (snapshot.badHoldRemainingMs / 1000).toFixed(1) + '초';
  }

  function externalStatus(status) {
    if (status === 'STABLE') return 'GOOD';
    if (status === 'PENDING') return 'CAUTION';
    if (status === 'WARNING' || status === 'INTERVENTION') return 'BAD';
    return 'READY';
  }

  function externalCue(status) {
    if (status === 'STABLE') return '좋습니다. 현재 자세를 유지하세요.';
    if (status === 'PENDING') return '자세 변화를 확인하고 있습니다.';
    if (status === 'WARNING') return '턱을 가볍게 당기고 자세를 바로잡으세요.';
    if (status === 'INTERVENTION') return '지금 자세를 바로잡으세요.';
    return '센서 상태를 기다리고 있습니다.';
  }

  var UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  var UART_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  var UART_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

  function renderPresentationHud(deviation, displayStatus, holdSeconds, signedDeviation) {
    if (!elements.presentationHud) return;
    var value = deviation === null || deviation === undefined ? NaN : Number(deviation);
    var hold = Number(holdSeconds);
    var status = displayStatus || 'READY';
    var stateLabel = status === 'GOOD'
      ? 'GOOD'
      : status === 'CAUTION' ? 'HOLD'
        : status === 'BAD' ? 'CORRECT NOW'
          : status === 'CALIBRATING' ? 'CALIBRATING'
            : status === 'STALE' ? 'SENSOR STALE'
              : status === 'FIT_CHECK' ? 'CHECK FIT' : 'READY';
    var cue = status === 'GOOD'
      ? '현재 자세를 유지하세요'
      : status === 'CAUTION' ? '턱을 가볍게 당기세요'
        : status === 'BAD' ? '턱을 당기세요'
          : status === 'CALIBRATING' ? '정면을 보고 3초 유지하세요'
            : status === 'STALE' ? '센서가 멈췄습니다. 재보정하세요'
              : status === 'FIT_CHECK' ? '안경 위치를 확인하고 재보정하세요' : '자세를 확인합니다';

    elements.presentationHud.dataset.status = status.toLowerCase();
    elements.hudAngle.textContent = Number.isFinite(value) ? value.toFixed(1) : '--';
    elements.hudState.textContent = stateLabel;
    elements.hudCue.textContent = cue;
    elements.hudHold.textContent = (Number.isFinite(hold) ? Math.max(0, hold) : 0).toFixed(1) + 's';
    elements.hudHeadPitch.textContent = formatAngle(
      state.headOnlyMode || state.presentationSource === 'head' ? value : state.lastHeadPitch
    );
    elements.hudTorsoPitch.textContent = state.headOnlyMode || state.presentationSource === 'head'
      ? '--°'
      : (state.hybridMode || state.presentationSource === 'ble') && !hasFreshTorso()
      ? '--°'
      : formatAngle(state.lastTorsoPitch);
    var signedValue = Number(signedDeviation);
    if (!Number.isFinite(signedValue)) signedValue = Number.isFinite(value) ? value : 0;
    var leanValue = window.AntiTurtleEngine.postureVisualDeviation(signedValue);
    elements.hudPostureFigure.style.setProperty('--hud-lean', Math.min(15, Math.max(0, leanValue * 0.72)) + 'deg');
    if (state.postureAnimationReady && state.postureAnimation && Number.isFinite(value)) {
      state.postureAnimation.goToAndStop(
        window.AntiTurtleEngine.signedPostureAnimationFrame(
          leanValue,
          state.postureAnimation.totalFrames || 121
        ),
        true
      );
    }
    elements.hudCorrectionArrow.dataset.active = status === 'BAD' || status === 'CAUTION' ? 'true' : 'false';
  }

  function initPostureAnimation() {
    if (!elements.hudAnatomyAvatar || !window.lottie) return;
    try {
      state.postureAnimation = window.lottie.loadAnimation({
        container: elements.hudAnatomyAvatar,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: 'assets/posture-anatomy.lottie.json?v=20260827-anatomy-three-state-4',
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
          progressiveLoad: false,
        },
      });
    } catch (error) {
      state.postureAnimation = null;
      return;
    }
    state.postureAnimation.addEventListener('DOMLoaded', function () {
      state.postureAnimationReady = true;
      document.body.classList.add('lottie-avatar-ready');
      var deviation = state.externalTelemetry
        ? Number(state.externalTelemetry.forwardDeg)
        : state.lastSnapshot ? Number(state.lastSnapshot.deviation) : 0;
      var signedDeviation = state.externalTelemetry
        ? Number(state.externalTelemetry.signedDeviationDeg)
        : state.lastSnapshot ? Number(state.lastSnapshot.signedDeviation) : deviation;
      var visualDeviation = window.AntiTurtleEngine.postureVisualDeviation(
        Number.isFinite(signedDeviation) ? signedDeviation : 0
      );
      state.postureAnimation.goToAndStop(
        window.AntiTurtleEngine.signedPostureAnimationFrame(
          visualDeviation,
          state.postureAnimation.totalFrames || 121
        ),
        true
      );
    });
    state.postureAnimation.addEventListener('data_failed', function () {
      state.postureAnimationReady = false;
      document.body.classList.remove('lottie-avatar-ready');
    });
  }

  function hasFreshTorso() {
    return state.lastTorsoReceivedAt > 0 &&
      Date.now() - state.lastTorsoReceivedAt <= CONFIG.torsoStaleMs;
  }

  function applyTorsoSample(sample, ageMs) {
    if (!sample || typeof sample !== 'object') return false;
    var pitchDeg = Number(sample.pitchDeg);
    var age = Number(ageMs);
    if (!Number.isFinite(pitchDeg) || pitchDeg < -180 || pitchDeg > 180 ||
        !Number.isFinite(age) || age < 0 || age > CONFIG.torsoStaleMs) return false;

    state.lastTorsoPitch = pitchDeg;
    state.lastTorsoReceivedAt = Date.now() - age;
    elements.torsoPitch.textContent = formatAngle(pitchDeg);
    elements.hudTorsoPitch.textContent = formatAngle(pitchDeg);
    if ((state.hybridMode || state.headImuMode) && state.sensorListening) {
      state.mode = 'dual';
      elements.hudLiveLabel.textContent = 'DUAL';
      if (state.hybridMode && (!state.cameraMode || state.cameraStream)) {
        elements.cameraGate.hidden = true;
      }
    }
    return true;
  }

  function suspendHybridForStaleTorso() {
    if (!state.hybridMode || !state.sensorListening || !state.running) return;
    state.engine = null;
    state.running = false;
    state.lastSnapshot = null;
    elements.hudLiveLabel.textContent = 'NU STALE';
    renderPresentationHud(NaN, 'READY', 0);
  }

  function refreshTorso() {
    if (state.torsoRequestBusy || !state.torsoPollingActive) return Promise.resolve(false);
    state.torsoRequestBusy = true;
    return fetch(CONFIG.torsoEndpoint, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('torso relay unavailable');
        return response.json();
      })
      .then(function (payload) {
        if (!state.torsoPollingActive) return false;
        var accepted = applyTorsoSample(payload.sample, payload.ageMs);
        if (!accepted) suspendHybridForStaleTorso();
        return accepted;
      })
      .catch(function () {
        if (state.torsoPollingActive) suspendHybridForStaleTorso();
        return false;
      })
      .finally(function () {
        state.torsoRequestBusy = false;
      });
  }

  function startTorsoPolling() {
    window.clearInterval(state.torsoPollTimer);
    state.torsoPollingActive = true;
    refreshTorso();
    state.torsoPollTimer = window.setInterval(refreshTorso, CONFIG.torsoPollMs);
  }

  function stopTorsoPolling() {
    window.clearInterval(state.torsoPollTimer);
    state.torsoPollTimer = null;
    state.torsoPollingActive = false;
  }

  function setCameraGate(message, retry, actionName, actionLabel) {
    elements.cameraGate.hidden = false;
    elements.cameraMessage.textContent = message;
    elements.cameraAction.hidden = !retry;
    elements.cameraAction.dataset.action = actionName || 'start-camera';
    elements.cameraActionLabel.textContent = actionLabel || 'TRY CAMERA';
    elements.cameraIndicator.hidden = !state.cameraUnavailable;
    if (retry) {
      window.requestAnimationFrame(function () {
        elements.cameraAction.focus();
      });
    }
  }

  function stopCamera() {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(function (track) { track.stop(); });
    }
    state.cameraStream = null;
    state.cameraStarting = false;
    elements.cameraFeed.pause();
    elements.cameraFeed.srcObject = null;
    elements.cameraFeed.hidden = true;
    elements.cameraShade.hidden = true;
    elements.cameraIndicator.hidden = true;
    elements.presentationHud.classList.remove('camera-active');
  }

  function cameraErrorMessage(error) {
    if (!window.isSecureContext) return 'HTTPS 주소에서 열어야 카메라를 사용할 수 있습니다.';
    if (error && error.name === 'NotAllowedError') return '카메라 권한을 허용한 뒤 다시 시도하세요.';
    if (error && error.name === 'NotFoundError') return '사용할 수 있는 카메라를 찾지 못했습니다.';
    if (error && error.name === 'NotReadableError') return '다른 앱이 카메라를 사용 중인지 확인하세요.';
    return '이 브라우저에서는 카메라를 시작하지 못했습니다.';
  }

  function enterCameralessPresentation(message) {
    stopCamera();
    state.cameraUnavailable = true;
    state.cameraMode = false;
    document.body.classList.remove('camera-mode');
    elements.presentationHud.classList.add('cameraless-active');
    elements.cameraIndicatorLabel.textContent = 'IMU HUD · CAMERA OFF';
    elements.cameraIndicator.hidden = false;
    if (state.presentationSource === 'ble' || (state.sensorListening && hasFreshTorso())) {
      elements.cameraGate.hidden = true;
    } else {
      setCameraGate(message || '카메라 없이 IMU HUD로 계속합니다.', false);
    }
  }

  function startCamera() {
    if (!state.cameraMode || state.cameraStarting || state.cameraStream) return;
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      if (state.presentationSource === 'ble') {
        state.cameraMode = false;
        document.body.classList.remove('camera-mode');
        elements.cameraGate.hidden = true;
        return;
      }
      if (state.hybridMode) {
        enterCameralessPresentation('카메라를 사용할 수 없어 IMU HUD로 계속합니다.');
        return;
      }
      setCameraGate('이 브라우저는 실시간 카메라를 지원하지 않습니다.', false);
      return;
    }

    state.cameraStarting = true;
    if (state.presentationSource === 'ble') elements.cameraGate.hidden = true;
    else setCameraGate('카메라 권한을 허용해 주세요.', false);
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: state.cameraFacing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    }).then(function (stream) {
      state.cameraStream = stream;
      elements.cameraFeed.srcObject = stream;
      elements.cameraFeed.classList.toggle('mirrored', state.cameraFacing === 'user');
      return elements.cameraFeed.play();
    }).then(function () {
      state.cameraUnavailable = false;
      elements.presentationHud.classList.remove('cameraless-active');
      elements.cameraFeed.hidden = false;
      elements.cameraShade.hidden = false;
      if (!state.hybridMode || (state.sensorListening && hasFreshTorso())) {
        elements.cameraGate.hidden = true;
      } else {
        setCameraGate('휴대폰에서 NU 몸통 센서를 연결한 뒤 다시 선택하세요.', true,
          'start-hybrid', 'RETRY HYBRID');
      }
      elements.cameraIndicatorLabel.textContent = state.cameraFacing === 'user'
        ? 'CAMERA LIVE · FRONT'
        : 'CAMERA LIVE · REAR';
      elements.cameraIndicator.hidden = false;
      elements.presentationHud.classList.add('camera-active');
    }).catch(function (error) {
      stopCamera();
      if (state.presentationSource === 'ble') {
        state.cameraUnavailable = false;
        state.cameraMode = false;
        document.body.classList.remove('camera-mode');
        elements.presentationHud.classList.remove('cameraless-active');
        elements.cameraGate.hidden = true;
        elements.cameraIndicator.hidden = true;
        return;
      }
      if (state.hybridMode && error &&
          (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')) {
        enterCameralessPresentation('안경 카메라는 웹앱에 노출되지 않아 IMU HUD로 계속합니다.');
        return;
      }
      setCameraGate(cameraErrorMessage(error), true,
        state.hybridMode ? 'start-hybrid' : 'start-camera',
        state.hybridMode ? 'RETRY HYBRID' : 'TRY CAMERA');
    }).finally(function () {
      state.cameraStarting = false;
    });
  }

  function setBleStatus(label, source, note) {
    elements.bleStatus.dataset.source = source || 'idle';
    elements.bleStatusLabel.textContent = label;
    if (note) elements.bleSupportNote.textContent = note;
  }

  function setBleDisconnected(label) {
    state.bleDevice = null;
    state.bleRx = null;
    state.bleTx = null;
    state.bleBuffer = '';
    elements.connectBle.disabled = false;
    elements.disconnectBle.disabled = true;
    setBleStatus(label || 'OFFLINE', 'idle', '보드가 켜져 있는지 확인한 뒤 다시 연결하세요.');
  }

  function normalizeBleLine(line) {
    var trimmed = String(line || '').trim();
    if (!trimmed || trimmed.charAt(0) === '#') return null;
    if (trimmed.charAt(0) === '{') {
      try {
        return window.JSON.parse(trimmed);
      } catch (error) {
        return null;
      }
    }

    var fields = trimmed.split(',');
    if (fields.length < 16 || fields[1] !== 'HEAD') return null;
    var numbers = fields.slice(0, 1).concat(fields.slice(2, 9)).map(Number);
    if (numbers.some(function (value) { return !Number.isFinite(value); })) return null;
    var telemetry = {
      schema: 'kinelo.anti-turtle.telemetry',
      version: '0.1',
      deviceId: state.bleDevice && state.bleDevice.name ? state.bleDevice.name : 'AntiTurtle-HEAD',
      at: numbers[0],
      forwardDeg: numbers[7],
      state: fields[9],
      stateElapsedS: Number(fields[10]),
      badDurationS: Number(fields[11]),
      exposureDegS: Number(fields[12]),
      recoveryCount: Number(fields[13]),
      stableRatioPct: Number(fields[14]),
      maxBadS: Number(fields[15]),
      transport: 'ble-uart',
    };
    return Number.isFinite(telemetry.forwardDeg) && telemetry.state ? telemetry : null;
  }

  function handleBleLine(line) {
    var telemetry = normalizeBleLine(line);
    if (!telemetry || !ingestTelemetry(telemetry)) return;
    state.blePacketCount += 1;
    elements.blePackets.textContent = String(state.blePacketCount);
    elements.bleAngle.textContent = Number(telemetry.forwardDeg).toFixed(1) + '°';
    elements.bleRelay.textContent = 'SENDING';
    queueTelemetryRelay(telemetry);
  }

  function handleBleNotification(event) {
    state.bleBuffer += state.bleDecoder.decode(event.target.value, { stream: true }).replace(/\r/g, '');
    var lines = state.bleBuffer.split('\n');
    state.bleBuffer = lines.pop() || '';
    lines.forEach(handleBleLine);
  }

  function connectBle() {
    if (!navigator.bluetooth) {
      setBleStatus('UNSUPPORTED', 'idle', '휴대폰 Chrome 또는 Edge에서 HTTPS/localhost 주소로 열어주세요.');
      showToast('이 브라우저는 Web Bluetooth를 지원하지 않습니다.');
      return;
    }
    if (state.bleConnecting) return;
    state.bleConnecting = true;
    elements.connectBle.disabled = true;
    setBleStatus('CONNECTING', 'ble', '브라우저 창에서 AntiTurtle-HEAD를 선택하세요.');
    navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [UART_SERVICE],
    }).then(function (device) {
      state.bleDevice = device;
      device.addEventListener('gattserverdisconnected', function () { setBleDisconnected('DISCONNECTED'); });
      return device.gatt.connect();
    }).then(function (server) {
      return server.getPrimaryService(UART_SERVICE);
    }).then(function (service) {
      return Promise.all([
        service.getCharacteristic(UART_RX),
        service.getCharacteristic(UART_TX),
      ]);
    }).then(function (characteristics) {
      state.bleRx = characteristics[0];
      state.bleTx = characteristics[1];
      state.bleDecoder = new TextDecoder();
      state.bleBuffer = '';
      state.bleTx.addEventListener('characteristicvaluechanged', handleBleNotification);
      return state.bleTx.startNotifications();
    }).then(function () {
      elements.bleDeviceName.textContent = state.bleDevice.name || 'AntiTurtle-HEAD';
      elements.disconnectBle.disabled = false;
      setBleStatus('ONLINE', 'ble', '센서 값을 릴레이 중입니다. 레이벤 화면에서 BLE LINK를 확인하세요.');
      elements.bleRelay.textContent = 'LIVE';
      showToast('AntiTurtle-HEAD가 연결되었습니다.');
    }).catch(function (error) {
      var cancelled = error && error.name === 'NotFoundError';
      setBleDisconnected(cancelled ? 'CANCELLED' : 'ERROR');
      showToast(cancelled ? 'BLE 장치를 선택하지 않았습니다.' : 'BLE 연결에 실패했습니다.');
    }).finally(function () {
      state.bleConnecting = false;
    });
  }

  function disconnectBle() {
    if (state.bleDevice && state.bleDevice.gatt && state.bleDevice.gatt.connected) {
      state.bleDevice.gatt.disconnect();
    }
    setBleDisconnected('OFFLINE');
  }

  function queueTelemetryRelay(telemetry) {
    state.pendingTelemetry = telemetry;
    scheduleTelemetryPost();
  }

  function scheduleTelemetryPost() {
    if (!state.pendingTelemetry || state.telemetryPostTimer || state.telemetryPostBusy) return;
    var elapsed = Date.now() - state.telemetryLastPostStartedAt;
    var delay = Math.max(0, CONFIG.telemetryPostMs - elapsed);
    state.telemetryPostTimer = window.setTimeout(function () {
      state.telemetryPostTimer = null;
      flushTelemetryPost();
    }, delay);
  }

  function flushTelemetryPost() {
    if (state.telemetryPostBusy || !state.pendingTelemetry || !state.telemetrySender) return;
    var pending = state.telemetrySender.decorate(state.pendingTelemetry);
    state.pendingTelemetry = null;
    state.telemetryPostBusy = true;
    state.telemetryLastPostStartedAt = Date.now();
    state.telemetryPostController = new AbortController();
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
        signal: state.telemetryPostController.signal,
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          if (!response.ok || payload.accepted === false) throw new Error('relay');
          return payload;
        });
      }).then(function (payload) {
        state.relayShared = Boolean(payload.storage && payload.storage.shared);
        elements.bleRelay.textContent = 'LIVE';
        state.lastTelemetryPostAt = Date.now();
        if (state.headOnlyMode) {
          elements.hudLiveLabel.textContent = state.relayShared ? 'HEAD RELAY' : 'RELAY POC';
          setSource('glasses', state.relayShared ? 'HEAD RELAY LIVE' : 'RELAY MEMORY');
        }
      }).catch(function (error) {
        if (error && error.name === 'AbortError') return;
        elements.bleRelay.textContent = 'RETRY';
        if (state.headOnlyMode) {
          elements.hudLiveLabel.textContent = 'RETRY';
          setSource('glasses', 'HEAD RELAY ERROR');
        } else {
          setBleStatus('ONLINE', 'ble', 'BLE는 연결됐지만 릴레이 서버 응답이 없습니다.');
        }
      }).finally(function () {
        state.telemetryPostBusy = false;
        state.telemetryPostController = null;
        scheduleTelemetryPost();
      });
  }

  function stopTelemetryRelay() {
    window.clearTimeout(state.telemetryPostTimer);
    state.telemetryPostTimer = null;
    state.pendingTelemetry = null;
    if (state.telemetryPostController) state.telemetryPostController.abort();
    state.telemetryPostController = null;
  }

  function startTelemetryPolling() {
    if (state.telemetryPollTimer) return;
    pollTelemetry();
    var intervalMs = state.presentationMode &&
      (state.presentationSource === 'ble' || state.presentationSource === 'head')
      ? CONFIG.presentationTelemetryPollMs
      : CONFIG.telemetryPollMs;
    state.telemetryPollTimer = window.setInterval(pollTelemetry, intervalMs);
  }

  function stopTelemetryPolling() {
    window.clearInterval(state.telemetryPollTimer);
    state.telemetryPollTimer = null;
  }

  function torsoTelemetry(payload) {
    if (!payload || !applyTorsoSample(payload.sample, payload.ageMs)) return null;
    var sample = payload.sample;
    var deltaDeg = sample.deltaDeg === null || sample.deltaDeg === ''
      ? NaN
      : Number(sample.deltaDeg);
    var pitchDeg = Number(sample.pitchDeg);
    var deviation = Number.isFinite(deltaDeg) ? Math.abs(deltaDeg) : Math.abs(pitchDeg);
    if (!Number.isFinite(deviation)) return null;
    var status = deviation < 8 ? 'STABLE' : deviation <= 15 ? 'PENDING' : 'WARNING';
    return {
      forwardDeg: Math.min(180, deviation),
      state: status,
      badDurationS: 0,
      transport: 'torso-relay',
      torsoPitchDeg: pitchDeg,
      deviceId: sample.deviceId || 'NU IMU',
    };
  }

  function pollTorsoTelemetry() {
    return fetch(CONFIG.torsoEndpoint, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('torso');
        return response.json();
      })
      .then(function (payload) {
        var telemetry = torsoTelemetry(payload);
        if (telemetry && state.headImuMode) return true;
        return telemetry ? ingestTelemetry(telemetry) : false;
      })
      .catch(function () { return false; });
  }

  function pollLegacyTelemetry(requiredSensorMode, requiredTransport) {
    var endpoint = window.AntiTurtleRelayProtocol.telemetryUrl(
      state.relaySessionId,
      requiredSensorMode || 'ANY'
    );
    return fetch(endpoint, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('telemetry');
        return response.json();
      })
      .then(function (payload) {
        state.relayShared = payload.storage ? Boolean(payload.storage.shared) : null;
        if (!payload.telemetry) return false;
        var receivedAt = new Date(payload.receivedAt || 0).getTime();
        if (!Number.isFinite(receivedAt) || Date.now() - receivedAt > CONFIG.telemetryStaleMs) {
          if (!state.bleDevice) setSource(
            requiredSensorMode === 'HEAD' ? 'glasses' : 'ble',
            requiredSensorMode === 'HEAD' ? 'HEAD STALE' : 'BLE STALE'
          );
          return false;
        }
        if (requiredSensorMode && payload.telemetry.sensorMode !== requiredSensorMode) return false;
        if (requiredTransport && payload.telemetry.transport !== requiredTransport) return false;
        return ingestTelemetry(payload.telemetry);
      })
      .catch(function () { return false; });
  }

  function pollTelemetry() {
    if (state.telemetryRequestBusy) return;
    state.telemetryRequestBusy = true;
    var primary = state.presentationSource === 'head'
      ? pollLegacyTelemetry('HEAD', 'head-relay')
      : state.presentationSource !== 'ble'
        ? Promise.resolve(false)
        : state.desktopCameraPreview
          ? pollLegacyTelemetry('HYBRID', 'hybrid-relay').then(function (accepted) {
            return accepted ? true : pollTorsoTelemetry();
          })
          : pollTorsoTelemetry();
    primary.then(function (accepted) {
      return (state.presentationSource === 'head' || accepted || state.headImuMode || state.desktopCameraPreview)
        ? accepted
        : pollLegacyTelemetry();
    }).then(function (accepted) {
      if (!accepted) {
        if (state.presentationSource === 'ble' || state.presentationSource === 'head') {
          elements.hudLiveLabel.textContent = 'STALE';
        }
        if (!state.bleDevice) setSource(
          state.presentationSource === 'head' ? 'glasses' : 'ble',
          state.presentationSource === 'head' ? 'HEAD STALE' : 'BLE STALE'
        );
      }
    }).catch(function () {
        if (state.presentationSource === 'ble' || state.presentationSource === 'head') {
          elements.hudLiveLabel.textContent = 'OFFLINE';
        }
        if (state.currentScreen === 'sensor-link' && !state.bleDevice) setBleStatus('RELAY OFFLINE', 'idle');
    }).finally(function () {
      state.telemetryRequestBusy = false;
      });
  }

  function ingestTelemetry(message) {
    if (!message || typeof message !== 'object') return false;
    var forwardDeg = Number(message.forwardDeg);
    var badDurationS = Number(message.badDurationS || 0);
    var status = typeof message.state === 'string' ? message.state.toUpperCase() : '';
    if (!Number.isFinite(forwardDeg) || !status) return false;

    var hybridRelay = message.sensorMode === 'HYBRID' && message.transport === 'hybrid-relay';
    var headRelay = message.sensorMode === 'HEAD' && message.transport === 'head-relay';
    var relayHeadPitch = Number(message.headPitchDeg);
    if (headRelay && !Number.isFinite(relayHeadPitch)) return false;
    if (state.telemetryReceiver && !state.telemetryReceiver.accept(message)) return true;
    stopLiveInputs();
    state.externalTelemetry = message;
    state.mode = headRelay ? 'glasses' : 'dual';
    state.running = true;
    elements.hudLiveLabel.textContent = state.relayShared === false
      ? 'DEGRADED'
      : hybridRelay ? 'HYBRID' : headRelay ? 'HEAD' : 'LIVE';
    configureRunningActions();
    var latencyMs = Math.max(0, Date.now() - Number(message.sentAt || message.at || Date.now()));
    var latencyLabel = Number.isFinite(latencyMs) && latencyMs < 10000
      ? ' · ' + Math.round(latencyMs) + 'ms'
      : '';
    setSource(headRelay ? 'glasses' : 'ble', (hybridRelay
      ? 'HEAD + NU LIVE'
      : headRelay ? 'HEAD IMU LIVE' : 'BLE LINK') + latencyLabel);

    var displayStatus = externalStatus(status);
    elements.posturePanel.dataset.status = displayStatus.toLowerCase();
    elements.postureState.className = 'posture-state ' + displayStatus.toLowerCase();
    elements.postureState.textContent = status;
    elements.deviationValue.textContent = forwardDeg.toFixed(1);
    elements.coachCue.textContent = externalCue(status);
    if (headRelay) {
      state.lastHeadPitch = forwardDeg;
      state.lastTorsoPitch = 0;
      state.lastTorsoReceivedAt = 0;
      elements.headPitch.textContent = formatAngle(state.lastHeadPitch);
      elements.torsoPitch.textContent = '--°';
    } else if (hybridRelay) {
      state.lastHeadPitch = Number(message.headPitchDeg);
      state.lastTorsoPitch = Number(message.torsoPitchDeg);
      state.lastTorsoReceivedAt = Date.now();
      if (!Number.isFinite(state.lastHeadPitch) || !Number.isFinite(state.lastTorsoPitch)) return false;
      elements.headPitch.textContent = formatAngle(state.lastHeadPitch);
      elements.torsoPitch.textContent = formatAngle(state.lastTorsoPitch);
    } else if (message.transport === 'torso-relay') {
      state.lastHeadPitch = null;
      state.lastTorsoPitch = Number(message.torsoPitchDeg);
      state.lastTorsoReceivedAt = Date.now();
      elements.headPitch.textContent = '--°';
      elements.torsoPitch.textContent = formatAngle(state.lastTorsoPitch);
      setSource('ble', 'NU IMU LIVE');
    } else {
      state.lastHeadPitch = forwardDeg;
      elements.headPitch.textContent = formatAngle(forwardDeg);
      elements.torsoPitch.textContent = '--°';
    }
    elements.badHold.textContent = badDurationS.toFixed(1) + 's';
    elements.thresholdFill.style.width = Math.min(100, Math.max(0, (forwardDeg / 20) * 100)) + '%';
    var signedDeviation = Number(message.signedDeviationDeg);
    renderPresentationHud(
      forwardDeg,
      displayStatus,
      badDurationS,
      Number.isFinite(signedDeviation) ? signedDeviation : forwardDeg
    );
    return true;
  }

  function renderSnapshot(snapshot) {
    state.lastSnapshot = snapshot;
    elements.posturePanel.dataset.status = snapshot.status.toLowerCase();
    elements.postureState.className = 'posture-state ' + snapshot.status.toLowerCase();
    elements.postureState.textContent = snapshot.status;
    elements.deviationValue.textContent = snapshot.deviation.toFixed(1);
    elements.coachCue.textContent = cueFor(snapshot);
    elements.headPitch.textContent = formatAngle(snapshot.headPitch);
    elements.torsoPitch.textContent = formatAngle(snapshot.torsoPitch);
    elements.badHold.textContent = (snapshot.badHoldElapsedMs / 1000).toFixed(1) + 's';
    elements.thresholdFill.style.width = Math.min(100, (snapshot.deviation / 20) * 100) + '%';
    renderPresentationHud(
      snapshot.deviation,
      snapshot.status,
      snapshot.badHoldElapsedMs / 1000,
      snapshot.signedDeviation
    );
    var relayState = snapshot.status === 'GOOD'
      ? 'STABLE'
      : snapshot.status === 'CAUTION' ? 'PENDING' : snapshot.alert ? 'INTERVENTION' : 'WARNING';
    if (state.headOnlyMode && state.headImuMode) {
      queueTelemetryRelay({
        deviceId: 'Meta-RayBan',
        at: Date.now(),
        forwardDeg: snapshot.deviation,
        signedDeviationDeg: snapshot.signedDeviation,
        headPitchDeg: snapshot.headPitch,
        state: relayState,
        badDurationS: snapshot.badHoldElapsedMs / 1000,
        recoveryCount: snapshot.alerts,
        stableRatioPct: snapshot.goodPercent,
        sensorMode: 'HEAD',
        transport: 'head-relay',
      });
    } else if (state.hybridMode && state.headImuMode && hasFreshTorso()) {
      queueTelemetryRelay({
        deviceId: 'Meta-RayBan+NU',
        at: Date.now(),
        forwardDeg: snapshot.deviation,
        signedDeviationDeg: snapshot.signedDeviation,
        headPitchDeg: snapshot.headPitch,
        torsoPitchDeg: snapshot.torsoPitch,
        relativeDeg: snapshot.relative,
        state: relayState,
        badDurationS: snapshot.badHoldElapsedMs / 1000,
        recoveryCount: snapshot.alerts,
        stableRatioPct: snapshot.goodPercent,
        sensorMode: 'HYBRID',
        transport: 'hybrid-relay',
      });
    }
    if (snapshot.alert && !state.presentationDemo) showToast('목을 바로 세워주세요.');
  }

  function calibrateFromLastSample() {
    var dualHeadMode = !state.headOnlyMode && (state.hybridMode || state.headImuMode);
    if (!Number.isFinite(state.lastHeadPitch)) {
      showToast('센서 신호를 기다리고 있습니다.');
      return;
    }
    if (dualHeadMode && !hasFreshTorso()) {
      elements.hudLiveLabel.textContent = 'WAIT NU';
      return;
    }
    if (dualHeadMode) state.mode = 'dual';
    state.engine = window.AntiTurtleEngine.createPostureEngine();
    var snapshot = state.engine.calibrate({
      headPitch: state.lastHeadPitch,
      torsoPitch: state.lastTorsoPitch,
      at: Date.now(),
    });
    state.running = true;
    state.summary = null;
    configureRunningActions();
    setSource(state.mode);
    renderSnapshot(snapshot);
    showToast('현재 자세를 기준으로 저장했습니다.');
  }

  function ingestSample(sample, mode) {
    var headPitch = Number(sample.headPitch);
    var torsoPitch = Number(sample.torsoPitch);
    if (!Number.isFinite(headPitch) || !Number.isFinite(torsoPitch)) return false;

    state.lastHeadPitch = headPitch;
    state.lastTorsoPitch = torsoPitch;
    if (mode) state.mode = mode;
    var at = sample.at === undefined ? Date.now() : Number(sample.at);

    if (!state.engine || !state.running) {
      state.engine = window.AntiTurtleEngine.createPostureEngine();
      state.running = true;
      state.summary = null;
      configureRunningActions();
      setSource(state.mode);
      renderSnapshot(state.engine.calibrate({ headPitch: headPitch, torsoPitch: torsoPitch, at: at }));
      return true;
    }

    renderSnapshot(state.engine.update({ headPitch: headPitch, torsoPitch: torsoPitch, at: at }));
    return true;
  }

  function onDeviceOrientation(event) {
    var now = Date.now();
    if (now - state.lastUpdateAt < CONFIG.uiIntervalMs) return;
    if (!Number.isFinite(event.beta)) return;
    state.lastUpdateAt = now;
    var continuity = window.AntiTurtleEngine.evaluateHeadContinuity(
      state.lastRawHeadPitch,
      event.beta,
      state.lastHeadSampleAt,
      now,
      { maxGapMs: CONFIG.headReseatGapMs, maxJumpDeg: CONFIG.headReseatJumpDeg }
    );
    state.lastRawHeadPitch = event.beta;
    state.lastHeadSampleAt = now;
    if (state.headImuMode) armHeadSensorTimeout();
    else window.clearTimeout(state.sensorTimeout);
    state.lastHeadPitch = event.beta;

    if (state.headOnlyMode && state.running && !state.headCalibration &&
        !state.headNeedsCalibration && continuity.status !== 'FRESH') {
      markHeadReliability(continuity.status === 'GAP' ? 'STALE' : 'FIT_CHECK');
      return;
    }
    if (state.headOnlyMode && state.headNeedsCalibration && !state.headCalibration) {
      elements.hudLiveLabel.textContent = 'RECALIBRATE';
      return;
    }
    if (state.headOnlyMode && state.headCalibration) {
      var calibration = state.headCalibration.add(event.beta, now);
      renderHeadCalibration(calibration);
      if (!calibration.ready) return;
      state.lastHeadPitch = calibration.baseline;
      state.headCalibration = null;
      state.headReliability = 'calibrated';
      hideHeadCalibration();
      calibrateFromLastSample();
      elements.hudLiveLabel.textContent = 'HEAD CALIBRATED';
      setHeadImuAction('RECALIBRATE', false, 'recalibrate-head');
      return;
    }
    elements.hudHeadPitch.textContent = formatAngle(event.beta);
    if (state.headOnlyMode) {
      elements.hudLiveLabel.textContent = state.lastTelemetryPostAt &&
        now - state.lastTelemetryPostAt < 1500 ? 'HEAD RELAY' : 'HEAD LOCAL';
    }
    var dualHeadMode = !state.headOnlyMode && (state.hybridMode || state.headImuMode);
    if (dualHeadMode && !hasFreshTorso()) {
      elements.hudLiveLabel.textContent = 'WAIT NU';
      return;
    }
    if (!state.running) {
      state.mode = dualHeadMode || state.mode === 'dual' ? 'dual' : 'glasses';
      calibrateFromLastSample();
      if (state.mode === 'glasses') showToast('현재 머리 각도를 0° 기준으로 저장했습니다.');
      return;
    }
    ingestSample({ headPitch: event.beta, torsoPitch: state.lastTorsoPitch, at: now }, state.mode);
  }

  function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent === 'undefined') return Promise.resolve(false);
    if (typeof DeviceOrientationEvent.requestPermission !== 'function') return Promise.resolve(true);
    return DeviceOrientationEvent.requestPermission().then(function (result) {
      return result === 'granted';
    });
  }

  function startSensors(requireTorso) {
    if (state.sensorListening || state.running) return;
    setSource('idle', 'REQUESTING');
    requestOrientationPermission().then(function (granted) {
      if (!granted) {
        setSource(null, 'DENIED');
        if (requireTorso) {
          setCameraGate('Ray-Ban IMU 권한이 필요합니다.', true,
            'start-hybrid', 'RETRY HYBRID');
        } else {
          showToast('센서 권한이 필요합니다.');
        }
        return;
      }
      state.mode = requireTorso ? 'dual' : 'glasses';
      state.sensorListening = true;
      window.addEventListener('deviceorientation', onDeviceOrientation);
      if (requireTorso) {
        elements.hudLiveLabel.textContent = 'WAIT NU';
        startTorsoPolling();
        setSource('dual', 'HYBRID WAIT');
        setCameraGate('휴대폰에서 NU 몸통 센서를 연결하세요.', true,
          'start-hybrid', 'RETRY HYBRID');
      } else {
        setSource('idle', 'WAITING');
      }
      state.sensorTimeout = window.setTimeout(function () {
        if (!state.running) {
          stopLiveInputs();
          setSource(null, 'NO SENSOR');
          if (requireTorso) {
            setCameraGate('Ray-Ban IMU 신호가 없습니다.', true,
              'start-hybrid', 'RETRY HYBRID');
          } else {
            showToast('센서 신호가 없습니다. 데모 모드를 사용해 주세요.');
          }
        }
      }, CONFIG.sensorTimeoutMs);
    }).catch(function () {
      setSource(null, 'ERROR');
      if (requireTorso) {
        setCameraGate('Ray-Ban IMU를 시작하지 못했습니다.', true,
          'start-hybrid', 'RETRY HYBRID');
      } else {
        showToast('센서 연결을 시작하지 못했습니다.');
      }
    });
  }

  function setHeadImuAction(label, disabled, action) {
    if (!elements.headImuAction) return;
    elements.headImuAction.hidden = false;
    elements.headImuAction.disabled = Boolean(disabled);
    elements.headImuAction.dataset.action = action || 'start-head-imu';
    elements.headImuActionLabel.textContent = label;
  }

  function hideHeadCalibration() {
    if (!elements.hudCalibration) return;
    elements.hudCalibration.hidden = true;
  }

  function renderHeadCalibration(calibration) {
    var progress = Math.max(0, Math.min(1, Number(calibration.progress) || 0));
    var percent = Math.round(progress * 100);
    var label = calibration.status === 'WARMUP'
      ? 'WARMING UP'
      : calibration.status === 'MOVING' ? 'MOVEMENT — RESTART' : 'HOLD STILL';
    elements.hudCalibration.hidden = false;
    elements.hudCalibrationLabel.textContent = label;
    elements.hudCalibrationDetail.textContent = calibration.status === 'MOVING'
      ? '3.0s'
      : Math.max(0, (1 - progress) * 3).toFixed(1) + 's';
    elements.hudCalibrationProgress.setAttribute('aria-valuenow', String(percent));
    elements.hudCalibrationFill.style.width = percent + '%';
    elements.hudLiveLabel.textContent = label;
    elements.hudHeadPitch.textContent = '--°';
    renderPresentationHud(null, 'CALIBRATING', 0);
  }

  function beginHeadCalibration(showFeedback) {
    if (!state.headImuMode || !state.headOnlyMode) return false;
    state.engine = null;
    state.running = false;
    state.summary = null;
    state.pendingTelemetry = null;
    state.headNeedsCalibration = false;
    state.headReliability = 'calibrating';
    state.headCalibration = window.AntiTurtleEngine.createHeadCalibrator();
    elements.headImuAction.hidden = true;
    renderHeadCalibration({ status: 'WARMUP', progress: 0 });
    if (showFeedback) showToast('정면을 보고 움직이지 않은 채 3초 유지하세요.');
    return true;
  }

  function markHeadReliability(status) {
    if (!state.headOnlyMode || !state.headImuMode) return;
    var firstReport = state.headReliability !== status.toLowerCase();
    state.headReliability = status.toLowerCase();
    state.headNeedsCalibration = true;
    state.headCalibration = null;
    state.running = false;
    state.pendingTelemetry = null;
    hideHeadCalibration();
    elements.hudHeadPitch.textContent = '--°';
    elements.hudLiveLabel.textContent = status === 'STALE' ? 'SENSOR STALE' : 'CHECK FIT';
    renderPresentationHud(null, status, 0);
    setHeadImuAction('RECALIBRATE', false, 'recalibrate-head');
    if (firstReport) {
      showToast(status === 'STALE'
        ? '센서가 멈췄습니다. 다시 보정해 주세요.'
        : '안경 위치가 크게 변했습니다. 다시 보정해 주세요.');
    }
  }

  function armHeadSensorTimeout() {
    window.clearTimeout(state.sensorTimeout);
    state.sensorTimeout = window.setTimeout(function () {
      if (!state.headImuMode) return;
      if (state.lastHeadSampleAt === null) {
        stopLiveInputs();
        elements.hudLiveLabel.textContent = 'NO HEAD IMU';
        setHeadImuAction('RETRY HEAD IMU', false, 'start-head-imu');
        return;
      }
      markHeadReliability('STALE');
    }, CONFIG.sensorTimeoutMs);
  }

  function startHeadImu() {
    if (state.sensorListening || state.headImuMode) return;
    setHeadImuAction('REQUESTING IMU…', true);
    requestOrientationPermission().then(function (granted) {
      if (!granted) {
        elements.hudLiveLabel.textContent = 'HEAD DENIED';
        setHeadImuAction('RETRY HEAD IMU', false);
        return;
      }
      state.headImuMode = true;
      state.sensorListening = true;
      state.mode = state.headOnlyMode ? 'glasses' : 'dual';
      state.engine = null;
      state.running = false;
      state.lastHeadPitch = null;
      state.lastUpdateAt = 0;
      state.lastRawHeadPitch = null;
      state.lastHeadSampleAt = null;
      state.headNeedsCalibration = false;
      state.headReliability = 'starting';
      state.headCalibration = null;
      if (state.hybridMode) startTorsoPolling();
      elements.headImuAction.hidden = true;
      elements.hudLiveLabel.textContent = state.headOnlyMode
        ? 'WAIT HEAD'
        : hasFreshTorso() ? 'WAIT HEAD' : 'WAIT NU';
      setSource(state.headOnlyMode ? 'glasses' : 'dual', state.headOnlyMode ? 'HEAD IMU' : 'HEAD + NU');
      window.addEventListener('deviceorientation', onDeviceOrientation);
      if (state.headOnlyMode) beginHeadCalibration(false);
      armHeadSensorTimeout();
    }).catch(function () {
      elements.hudLiveLabel.textContent = 'HEAD ERROR';
      setHeadImuAction('RETRY HEAD IMU', false);
    });
  }

  function startHybrid() {
    state.hybridMode = true;
    startHeadImu();
  }

  function demoDeviation(elapsedMs) {
    var phase = elapsedMs % 12000;
    if (phase < 2000) return 2;
    if (phase < 4300) return 11;
    if (phase < 8000) return 18;
    if (phase < 10000) return 4;
    return 13;
  }

  function startDemo() {
    if (state.running && (state.demoTimer || !state.presentationDemo)) return;
    stopLiveInputs();
    state.mode = 'demo';
    var startedAt = Date.now();
    ingestSample({ headPitch: 0, torsoPitch: 0, at: startedAt }, 'demo');
    state.demoTimer = window.setInterval(function () {
      var now = Date.now();
      ingestSample({
        headPitch: demoDeviation(now - startedAt),
        torsoPitch: 0,
        at: now,
      }, 'demo');
    }, CONFIG.demoIntervalMs);
    if (!state.presentationDemo) showToast('12초 자세 시나리오를 반복합니다.');
  }

  function stopLiveInputs() {
    var stoppedHeadImu = state.headImuMode;
    window.clearTimeout(state.sensorTimeout);
    window.clearInterval(state.demoTimer);
    state.sensorTimeout = null;
    state.demoTimer = null;
    stopTorsoPolling();
    stopTelemetryRelay();
    if (state.sensorListening) {
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      state.sensorListening = false;
    }
    state.headImuMode = false;
    state.headCalibration = null;
    state.headNeedsCalibration = false;
    state.lastRawHeadPitch = null;
    state.lastHeadSampleAt = null;
    state.headReliability = 'idle';
    hideHeadCalibration();
    if (stoppedHeadImu && (state.hybridMode || state.headOnlyMode ||
        (state.presentationSource === 'ble' && !state.desktopCameraPreview))) {
      setHeadImuAction('START HEAD IMU', false, 'start-head-imu');
    }
  }

  function stopSession() {
    if (!state.running || !state.engine) return;
    state.summary = state.engine.finish(Date.now());
    state.running = false;
    stopLiveInputs();
    renderSummary();
    navigateTo('summary');
  }

  function renderSummary() {
    var summary = state.summary;
    elements.goodPercent.textContent = String(summary.goodPercent);
    elements.sessionTime.textContent = formatDuration(summary.durationMs);
    elements.alertCount.textContent = String(summary.alerts);
    elements.summarySource.textContent = sourceName(state.mode).replace(' ', '\n');
    elements.summaryLine.textContent = summary.goodPercent >= 80
      ? '안정적인 자세를 오래 유지했습니다.'
      : summary.alerts
        ? '교정 신호에 반응한 구간을 확인해 보세요.'
        : '조금 더 긴 세션에서 패턴을 확인해 보세요.';
    elements.coachText.textContent = 'AI 코칭을 선택하면 이번 세션을 한 문장으로 정리합니다.';
    elements.coachPanel.setAttribute('aria-busy', 'false');
    elements.coachAction.disabled = false;
  }

  function formatPhotoTime(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderPhoto(photo) {
    state.photo = photo || null;
    var hasPhoto = Boolean(photo && photo.imageDataUrl);
    elements.photoPreview.hidden = !hasPhoto;
    elements.photoPlaceholder.hidden = hasPhoto;
    elements.photoCaption.hidden = !hasPhoto;
    elements.photoStatus.dataset.source = hasPhoto ? 'demo' : 'idle';
    elements.photoStatusLabel.textContent = hasPhoto ? 'READY' : 'WAITING';
    if (!hasPhoto) {
      elements.photoPreview.src = 'data:,';
      return;
    }
    elements.photoPreview.src = photo.imageDataUrl;
    elements.photoName.textContent = photo.name || 'META AI PHOTO';
    elements.photoTime.textContent = formatPhotoTime(photo.updatedAt);
  }

  function loadLatestPhoto() {
    if (state.photoLoading) return;
    state.photoLoading = true;
    elements.photoStatusLabel.textContent = 'LOADING';
    fetch('/api/photo', { cache: 'no-store' })
      .then(function (response) {
        if (response.status === 404) return null;
        return response.json().then(function (payload) {
          if (!response.ok) throw new Error(payload.error || '사진을 불러오지 못했습니다.');
          return payload.photo;
        });
      })
      .then(function (photo) {
        renderPhoto(photo);
        if (photo) showToast('최신 사진을 표시했습니다.');
      })
      .catch(function () {
        elements.photoStatusLabel.textContent = 'OFFLINE';
        showToast('사진 서버에 연결하지 못했습니다.');
      })
      .finally(function () {
        state.photoLoading = false;
      });
  }

  function readAndResizePhoto(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('이미지 파일을 선택해 주세요.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var image = new Image();
        image.onload = function () {
          var maxSide = 560;
          var scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.onerror = function () { reject(new Error('이 사진 형식을 브라우저에서 열 수 없습니다. JPEG로 저장해 다시 시도해 주세요.')); };
        image.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('사진을 읽지 못했습니다.')); };
      reader.readAsDataURL(file);
    });
  }

  function uploadPhoto(file) {
    readAndResizePhoto(file).then(function (imageDataUrl) {
      elements.photoStatusLabel.textContent = 'SENDING';
      return fetch('/api/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: imageDataUrl, name: file.name }),
      }).then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) throw new Error(payload.error || '사진을 저장하지 못했습니다.');
          return { imageDataUrl: imageDataUrl, name: payload.photo.name, updatedAt: payload.photo.updatedAt };
        });
      });
    }).then(function (photo) {
      renderPhoto(photo);
      showToast('사진을 릴레이했습니다. 안경에서 REFRESH를 선택하세요.');
    }).catch(function (error) {
      elements.photoStatusLabel.textContent = state.photo ? 'READY' : 'WAITING';
      showToast(error.message);
    }).finally(function () {
      elements.photoInput.value = '';
    });
  }

  function requestCoach(prompt) {
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, CONFIG.requestTimeoutMs);
    return fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt }),
      signal: controller.signal,
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) throw new Error(payload.error || 'AI 코칭을 불러오지 못했습니다.');
        return payload.answer;
      });
    }).finally(function () {
      window.clearTimeout(timeout);
    });
  }

  function askCoach() {
    if (!state.summary || state.coachLoading) return;
    state.coachLoading = true;
    elements.coachAction.disabled = true;
    elements.coachPanel.setAttribute('aria-busy', 'true');
    elements.coachText.textContent = '세션 패턴을 분석하고 있습니다…';
    var prompt = [
      '안티터틀 자세 코치로서 의료 진단 없이 한국어 한 문장으로 격려와 다음 행동을 말해줘.',
      '세션 시간 ' + formatDuration(state.summary.durationMs) + ',',
      '바른 자세 비율 ' + state.summary.goodPercent + '%,',
      '3초 지속 경고 ' + state.summary.alerts + '회,',
      '측정 모드 ' + sourceName(state.mode) + '.',
    ].join(' ');

    requestCoach(prompt).then(function (answer) {
      elements.coachText.textContent = answer;
    }).catch(function (error) {
      elements.coachText.textContent = error.name === 'AbortError'
        ? '응답 시간이 길어졌습니다. 다시 시도해 주세요.'
        : error.message;
    }).finally(function () {
      state.coachLoading = false;
      elements.coachAction.disabled = false;
      elements.coachPanel.setAttribute('aria-busy', 'false');
      elements.coachPanel.focus();
    });
  }

  function resetSession() {
    stopLiveInputs();
    state.engine = null;
    state.running = false;
    state.mode = null;
    state.lastHeadPitch = null;
    state.headCalibration = null;
    state.headNeedsCalibration = false;
    state.lastRawHeadPitch = null;
    state.lastHeadSampleAt = null;
    state.headReliability = 'idle';
    state.lastTorsoPitch = 0;
    state.lastTorsoReceivedAt = 0;
    state.lastSnapshot = null;
    state.summary = null;
    state.externalTelemetry = null;
    state.lastTelemetryPostAt = 0;
    state.relayShared = null;
    if (state.telemetryReceiver) state.telemetryReceiver.reset();
    state.blePacketCount = 0;
    elements.blePackets.textContent = '0';
    elements.bleAngle.textContent = '--°';
    elements.bleRelay.textContent = 'READY';
    elements.bleDeviceName.textContent = state.bleDevice && state.bleDevice.name
      ? state.bleDevice.name
      : 'NO DEVICE';
    elements.posturePanel.dataset.status = 'idle';
    elements.postureState.className = 'posture-state idle';
    elements.postureState.textContent = 'READY';
    elements.deviationValue.textContent = '--';
    elements.coachCue.textContent = '바른 자세에서 세션을 시작하세요.';
    elements.headPitch.textContent = '--°';
    elements.torsoPitch.textContent = '--°';
    elements.badHold.textContent = '0.0s';
    elements.thresholdFill.style.width = '0%';
    hideHeadCalibration();
    renderPresentationHud(state.headOnlyMode ? null : 0, 'READY', 0);
    elements.hudLiveLabel.textContent = state.presentationSource === 'ble' || state.presentationSource === 'head'
      ? 'WAIT'
      : state.hybridMode || state.headOnlyMode ? 'WAIT START' : 'LIVE';
    setSource(null);
    configureIdleActions();
    navigateTo('monitor');
  }

  function handleAction(action) {
    if (action === 'start-sensors') startSensors(false);
    if (action === 'start-demo') startDemo();
    if (action === 'calibrate') calibrateFromLastSample();
    if (action === 'stop-session') stopSession();
    if (action === 'ask-coach') askCoach();
    if (action === 'new-session') resetSession();
    if (action === 'open-photo') navigateTo('photo-relay');
    if (action === 'open-sensor-link') navigateTo('sensor-link');
    if (action === 'connect-ble') connectBle();
    if (action === 'disconnect-ble') disconnectBle();
    if (action === 'pick-photo') elements.photoInput.click();
    if (action === 'refresh-photo') loadLatestPhoto();
    if (action === 'back-to-monitor') navigateTo('monitor');
    if (action === 'start-camera') startCamera();
    if (action === 'start-hybrid') startHybrid();
    if (action === 'start-head-imu') startHeadImu();
    if (action === 'recalibrate-head') {
      if (!beginHeadCalibration(true)) startHeadImu();
    }
  }

  function bindEvents() {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (target && !target.disabled) handleAction(target.dataset.action);
    });
    elements.photoInput.addEventListener('change', function (event) {
      if (event.target.files && event.target.files[0]) uploadPhoto(event.target.files[0]);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (state.presentationDemo || state.hybridMode || state.headImuMode) stopLiveInputs();
        else if (state.running && state.currentScreen !== 'sensor-link') stopSession();
        stopTelemetryPolling();
        if (state.cameraMode) stopCamera();
        return;
      }
      if (!document.hidden && state.presentationDemo) startDemo();
      if (!document.hidden && state.presentationMode &&
          (state.presentationSource === 'ble' ||
           (state.presentationSource === 'head' && state.desktopCameraPreview))) startTelemetryPolling();
      if (!document.hidden && state.cameraMode && !state.hybridMode) startCamera();
      if (!document.hidden && (state.hybridMode || state.headOnlyMode)) {
        elements.cameraGate.hidden = true;
        setHeadImuAction('START HEAD IMU', false, 'start-head-imu');
        window.requestAnimationFrame(function () { elements.headImuAction.focus(); });
      }
      if (!document.hidden && !state.presentationMode && (state.currentScreen === 'monitor' || state.currentScreen === 'sensor-link')) startTelemetryPolling();
    });
    window.addEventListener('pagehide', function () {
      stopCamera();
      stopLiveInputs();
      stopTelemetryPolling();
    });
  }

  function installHardwareBridge() {
    window.AntiTurtle = {
      version: '0.1',
      ingest: function (sample) {
        if (state.mode !== 'dual') stopLiveInputs();
        state.mode = 'dual';
        return ingestSample(sample, 'dual');
      },
      setTorsoPitch: function (torsoPitch) {
        var value = Number(torsoPitch);
        if (!Number.isFinite(value)) return false;
        state.lastTorsoPitch = value;
        state.lastTorsoReceivedAt = Date.now();
        state.mode = 'dual';
        if (state.running) setSource('dual');
        return true;
      },
      ingestTelemetry: ingestTelemetry,
      stop: stopSession,
      snapshot: function () { return state.lastSnapshot; },
    };
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    var requestedSource = params.get('source');
    var desktopRelayCamera = (requestedSource === 'ble' || requestedSource === 'head') &&
      /Macintosh|Windows NT|CrOS|Linux x86_64/.test(navigator.userAgent || '');
    cacheElements();
    initPostureAnimation();
    bindEvents();
    installHardwareBridge();
    state.relaySessionId = window.AntiTurtleRelayProtocol.sessionFromSearch(window.location.search);
    var randomUUID = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID.bind(window.crypto)
      : null;
    state.telemetrySender = window.AntiTurtleRelayProtocol.createSender({
      sessionId: state.relaySessionId,
      streamId: window.AntiTurtleRelayProtocol.createStreamId(randomUUID, Date.now),
    });
    state.telemetryReceiver = window.AntiTurtleRelayProtocol.createReceiver();
    state.hybridMode = params.get('hybrid') === '1';
    state.headOnlyMode = window.AntiTurtleRuntimeMode.shouldUseHeadOnlyMode(
      window.location.search,
      window.location.hostname
    );
    state.cameraMode = params.get('camera') === '1' &&
      ((requestedSource !== 'ble' && requestedSource !== 'head') || desktopRelayCamera);
    state.presentationDemo = !state.hybridMode && !state.headOnlyMode &&
      requestedSource !== 'ble' && requestedSource !== 'head' &&
      (params.get('demo') === '1' || state.cameraMode);
    state.presentationMode = state.hybridMode || state.headOnlyMode || state.presentationDemo ||
      requestedSource === 'ble' || requestedSource === 'head' || state.cameraMode;
    state.presentationSource = state.hybridMode
      ? 'hybrid'
      : state.headOnlyMode ? 'head-local'
        : state.presentationDemo ? 'demo'
          : requestedSource === 'ble' ? 'ble' : requestedSource === 'head' ? 'head' : null;
    state.cameraFacing = params.get('facing') === 'user' ||
      (desktopRelayCamera && !params.has('facing')) ? 'user' : 'environment';
    state.desktopCameraPreview = desktopRelayCamera;
    document.body.classList.toggle('presentation-mode', state.presentationMode);
    document.body.classList.toggle('camera-mode', state.cameraMode);
    document.body.classList.toggle('head-only-mode', state.headOnlyMode || requestedSource === 'head');
    if (state.headOnlyMode || requestedSource === 'head') {
      elements.hudSensorPair.setAttribute('aria-label', 'Ray-Ban 머리 IMU 보정 편차');
      elements.hudSensorPair.querySelector('span').textContent = 'RAY-BAN HEAD Δ';
      elements.hudSignature.textContent = 'ANTI TURTLE · HEAD TILT FROM BASELINE';
    }
    resetSession();
    if (state.presentationMode) {
      if (state.hybridMode) {
        setSource('dual', 'HYBRID READY');
        elements.cameraGate.hidden = true;
        setHeadImuAction('START HEAD IMU', false, 'start-head-imu');
        window.requestAnimationFrame(function () { elements.headImuAction.focus(); });
        return;
      }
      if (state.headOnlyMode) {
        setSource('glasses', 'HEAD READY');
        elements.cameraGate.hidden = true;
        setHeadImuAction('START HEAD IMU', false, 'start-head-imu');
        window.requestAnimationFrame(function () { elements.headImuAction.focus(); });
        return;
      }
      window.setTimeout(function () {
        if (state.presentationDemo) startDemo();
        else startTelemetryPolling();
        setSource(state.presentationDemo ? 'demo' : state.presentationSource === 'head' ? 'glasses' : 'ble',
          state.presentationDemo
            ? (state.cameraMode ? 'CAMERA HUD' : 'HUD DEMO')
            : state.presentationSource === 'head' ? 'HEAD CAMERA HUD' : 'NU IMU HUD');
        if (state.cameraMode) startCamera();
        if (state.presentationSource === 'ble' && !state.desktopCameraPreview) {
          setHeadImuAction('START HEAD IMU', false, 'start-head-imu');
          window.requestAnimationFrame(function () { elements.headImuAction.focus(); });
        }
      }, 350);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
