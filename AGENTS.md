# Anti Turtle Meta HUD agent instructions

These instructions apply to the entire repository. Keep changes focused, preserve unrelated work, and do not claim a feature works until the relevant proof has been run.

## Product boundary

Anti Turtle Meta HUD is an open-source wellness and research prototype for Meta Display glasses, browser HUDs, telemetry relays, and a macOS companion.

- The current HEAD value is calibrated head-pitch deviation from a personal baseline.
- HYBRID compares head pitch with a separate torso reference.
- Neither value is clinical craniovertebral angle (CVA), a diagnosis of forward-head posture (FHP), or a medical alarm.
- Do not convert prototype thresholds into diagnostic cutoffs or claim treatment efficacy.
- Read `docs/CLINICAL_LIMITS.md` and `docs/ROADMAP.md` before changing measurement claims, pose estimation, CVA/FHP research, or exercise coaching.

## Repository map

- `public/client.js`: browser lifecycle, sensor permissions, calibration, HUD rendering, camera, and relay orchestration.
- `public/posture-engine.js`: calibration, posture classification, continuity, and signed visualization math.
- `public/index.html` and `public/styles.css`: 600×600 Meta Display and desktop presentation UI.
- `public/relay-protocol.js`: session, stream, sequence, and freshness helpers.
- `public/torso-parser.js` and `public/torso-bridge.js`: NU/torso ingestion.
- `lib/telemetry.js` and `lib/telemetry-store.js`: normalized HEAD/HYBRID telemetry and storage ordering.
- `api/telemetry.js` and `api/torso.js`: serverless HTTP entry points.
- `macos/`: native menu-bar app and Notification Center receiver.
- `tests/`: Node behavior tests, replay fixtures, lifecycle checks, and macOS Python tests.
- `docs/`: release, reliability, clinical-limit, research-roadmap, and ecosystem evidence.

## Non-negotiable behavior

### Sensor and calibration lifecycle

- Preserve explicit permission, warm-up, stable calibration, stale, fit-check, recalibration, hidden-page, and page-exit states.
- Do not display a calibrated value before calibration succeeds.
- Stop sensor listeners, polling, timers, camera tracks, and pending relay work when the page is hidden or exited; resume only through the documented lifecycle.
- Keep signed orientation math separate from the user-facing non-negative deviation where both are required.
- Add replay or unit coverage for changes to calibration thresholds, sign conventions, continuity, stale recovery, or posture classification.

### Telemetry contract

- HEAD packets use `sensorMode: "HEAD"` and `transport: "head-relay"`.
- HYBRID packets use `sensorMode: "HYBRID"` and `transport: "hybrid-relay"`.
- Preserve `sessionId`, `streamId`, increasing `seq`, `sentAt`, freshness checks, and rejection of older streams or packets.
- Treat missing, invalid, or stale measurements as unavailable. Do not silently substitute zero.
- Do not log or commit real telemetry, personal session labels, health information, credentials, or `.env` files.

### Meta Display UI

- Target a fixed 600×600 display viewport with safe margins.
- The page background is black because black is transparent on the additive display. Visible surfaces must use emitting dark gray or bright line/text colors.
- Keep controls keyboard/D-pad focusable; Enter activates, arrow keys navigate, and focus is visibly indicated.
- Prefer lightweight DOM, Canvas, inline assets, or the vendored Lottie runtime. Avoid new network fonts and heavy client dependencies.
- Sensor-driven UI updates should normally remain in the 10–30 Hz range and stop when not visible.
- The outward-facing glasses camera is not available as a normal browser camera. Do not promise an on-glasses camera feed.
- For UI changes, verify both the 600×600 glasses state and the relevant desktop receiver viewport. State explicitly when physical-glasses testing was not performed.

### Research extensions

- IMU fusion may estimate relative head and torso orientation; it does not locate the tragus or C7.
- Generic face and shoulder keypoints do not directly establish clinical CVA. Research mode requires a standardized sagittal setup, confidence gating, reference annotations, and agreement/error reporting.
- Exercise modules, including McKenzie-style cervical extension, must remain optional research coaching with clinician-reviewed instructions, stop conditions, and contraindication messaging. Never auto-prescribe exercise from a prototype angle.

### macOS companion

- Keep the Python receiver dependency-free unless the task explicitly changes that product constraint.
- Full Xcode must not become a requirement. The Swift menu-bar app should continue to typecheck with macOS Command Line Tools.
- Preserve stale handling, alert hold time, duplicate suppression, recovery behavior, and non-identifying sessions.

### Deployment and security

- Git-triggered Vercel deployment must remain disabled in `vercel.json`.
- Do not use a Vercel-managed source build. Build locally and deploy only reviewed Build Output API artifacts with `vercel deploy --prebuilt`; add `--prod` only for an explicitly approved production release.
- The public demo relay is unauthenticated. Do not present it as suitable for clinical, patient, or production health data.

## Change workflow

1. Read the target module, its tests, and the relevant document under `docs/` before editing.
2. Preserve public URL/query compatibility unless the task explicitly includes a migration.
3. Make the smallest coherent change and add tests for behavior changes.
4. Run the narrowest relevant test first, then the repository proof below.
5. Inspect the natural surface for UI, device, macOS, or deployment changes; do not rely on unit tests alone.
6. Update both `README.md` and `README.ko.md` when user-facing setup, claims, or roadmap summaries change.

## Required proof

For ordinary JavaScript, API, or documentation changes:

```bash
npm run check
npm test
git diff --check
```

For `macos/AntiTurtleMenu.swift` changes, also run:

```bash
xcrun swiftc -typecheck \
  -framework Cocoa \
  -framework UserNotifications \
  macos/AntiTurtleMenu.swift
```

For HUD changes, record the tested URL, viewport, state, and whether proof came from desktop emulation or physical Meta Display glasses. Do not use screenshots or telemetry that contain personal or clinical information.

## Handoff

Report changed files, the user-visible behavior, proof commands and results, deployment status, and any unverified physical-device, clinical, authentication, or external-service behavior.
