(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AntiTurtleCameraPoseAdapter = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var VISION_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm';
  var WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
  var MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

  function defaultVisionLoader() {
    return import(VISION_MODULE_URL);
  }

  function createMediaPipePoseAdapter(overrides) {
    var options = Object.assign({
      fps: 8,
      visionLoader: defaultVisionLoader,
      wasmBaseUrl: WASM_BASE_URL,
      modelUrl: MODEL_URL,
      now: function () { return performance.now(); },
      setTimer: function (callback, delay) { return setTimeout(callback, delay); },
      clearTimer: function (timer) { clearTimeout(timer); },
      analyzeResult: null,
      onSample: function () {},
      onStatus: function () {},
      onError: function () {},
    }, overrides || {});
    var video = null;
    var landmarker = null;
    var timer = null;
    var running = false;
    var generation = 0;
    var lastVideoTime = -1;
    var intervalMs = Math.max(100, Math.round(1000 / Math.max(1, options.fps)));

    function emitStatus(status, detail) {
      options.onStatus({ status: status, detail: detail || null });
    }

    function schedule(delay, activeGeneration) {
      if (!running || activeGeneration !== generation) return;
      options.clearTimer(timer);
      timer = options.setTimer(function () {
        timer = null;
        tick(activeGeneration);
      }, delay);
    }

    function tick(activeGeneration) {
      if (!running || activeGeneration !== generation || !video || !landmarker) return;
      var startedAt = options.now();
      try {
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          var result = landmarker.detectForVideo(video, startedAt);
          var sample = typeof options.analyzeResult === 'function'
            ? options.analyzeResult(result, startedAt)
            : result;
          options.onSample(sample);
        }
      } catch (error) {
        emitStatus('ERROR', error && error.message ? error.message : 'Pose inference failed');
        options.onError(error);
      }
      var elapsedMs = Math.max(0, options.now() - startedAt);
      schedule(Math.max(0, intervalMs - elapsedMs), activeGeneration);
    }

    function closeLandmarker() {
      if (landmarker && typeof landmarker.close === 'function') landmarker.close();
      landmarker = null;
    }

    return {
      start: function (nextVideo) {
        if (!nextVideo) return Promise.reject(new TypeError('video is required'));
        generation += 1;
        var activeGeneration = generation;
        running = true;
        video = nextVideo;
        lastVideoTime = -1;
        options.clearTimer(timer);
        timer = null;
        closeLandmarker();
        emitStatus('LOADING');
        return Promise.resolve(options.visionLoader()).then(function (visionApi) {
          if (!running || activeGeneration !== generation) return false;
          return visionApi.FilesetResolver.forVisionTasks(options.wasmBaseUrl).then(function (vision) {
            if (!running || activeGeneration !== generation) return false;
            return visionApi.PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: options.modelUrl,
                delegate: 'GPU',
              },
              runningMode: 'VIDEO',
              numPoses: 1,
              minPoseDetectionConfidence: 0.6,
              minPosePresenceConfidence: 0.6,
              minTrackingConfidence: 0.6,
              outputSegmentationMasks: false,
            });
          });
        }).then(function (createdLandmarker) {
          if (!createdLandmarker) return false;
          if (!running || activeGeneration !== generation) {
            if (typeof createdLandmarker.close === 'function') createdLandmarker.close();
            return false;
          }
          landmarker = createdLandmarker;
          emitStatus('READY');
          schedule(0, activeGeneration);
          return true;
        }).catch(function (error) {
          if (running && activeGeneration === generation) {
            emitStatus('ERROR', error && error.message ? error.message : 'Pose model failed to load');
            options.onError(error);
          }
          return false;
        });
      },
      stop: function () {
        generation += 1;
        running = false;
        options.clearTimer(timer);
        timer = null;
        video = null;
        lastVideoTime = -1;
        closeLandmarker();
        emitStatus('STOPPED');
      },
      isRunning: function () { return running; },
    };
  }

  return {
    VISION_MODULE_URL: VISION_MODULE_URL,
    WASM_BASE_URL: WASM_BASE_URL,
    MODEL_URL: MODEL_URL,
    createMediaPipePoseAdapter: createMediaPipePoseAdapter,
  };
});
