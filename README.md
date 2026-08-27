# Anti Turtle Meta HUD

[English](README.md) | [한국어](README.ko.md)

[![CI](https://github.com/Youngkwon-Lee/anti-turtle-meta-hud/actions/workflows/ci.yml/badge.svg)](https://github.com/Youngkwon-Lee/anti-turtle-meta-hud/actions/workflows/ci.yml)

[Watch the 48-second live HUD demo on YouTube](https://youtube.com/shorts/-UARuJDGOuQ)

Open-source posture-coaching prototype for Meta Display glasses, a browser camera HUD, and native macOS notifications and menu-bar status.

The glasses use device orientation as a **personal head-tilt baseline**. A relay endpoint lets another browser or a colleague's Mac view the latest HEAD/HYBRID state using the same session label.

> This is a wellness and research prototype. It does not measure clinical craniovertebral angle (CVA), diagnose forward-head posture, or replace professional assessment.

## What is included

- 600×600 Meta Display HUD with anatomical Lottie posture animation
- warm-up and continuous three-second stable calibration using a median head-orientation baseline
- HEAD-only and HEAD + torso HYBRID relay modes
- live Mac/desktop camera HUD
- session-isolated, ordered telemetry with Redis support
- dependency-free macOS Notification Center receiver and live menu-bar angle
- Node and Python tests

## Quick start

Requirements: Node.js 20+ and Python 3.10+ for the optional Mac notifier tests.

```bash
npm test
npm run check
npm start
```

Open <http://127.0.0.1:3000/?demo=1&source=head> for a sensor-free HUD preview.

## Add the web app in Meta AI

This device flow requires **Meta Display Glasses with Web apps support**. The standard Ray-Ban Meta camera is not exposed to ordinary browser pages.

### Option A — scan once (recommended for a solo demo)

Scan this QR code with the phone that has the Meta AI app and the glasses paired. The deep link opens Meta AI and adds the stable public web app URL.

![QR code for adding Anti Turtle Meta HUD in the Meta AI app](docs/meta-ai-webapp-qr.png)

The QR uses the default `head-demo` session. Because the public relay is unauthenticated, use the manual option with a unique, non-sensitive session label when several people are testing.

### Option B — add it manually

1. Open the **Meta AI app** on the paired phone.
2. Go to **Devices → Display Glasses settings**.
3. Open **App connections → Web apps → Add a web app**.
4. Enter the name `Anti Turtle Meta HUD`.
5. Enter `https://stage-codex-bridge-head-only.vercel.app/?headonly=1&session=team_demo`, replacing `team_demo` with the same non-sensitive session label used on the Mac.
6. Save the web app, then open it on the glasses.
7. Select **START HEAD IMU**, allow Motion & Orientation access if prompted, and hold a comfortable neutral posture while calibration completes.
8. On the Mac, open `https://stage-codex-bridge-head-only.vercel.app/?camera=1&source=head&session=team_demo` with the matching session label.

The Mac camera provides the live video background; the glasses send the calibrated head-orientation telemetry. If the menu-bar app shows `○ --`, confirm that both devices use the same session and that **START HEAD IMU** is still running on the glasses.

## Head-only live flow

Use one non-sensitive session label on every device:

```text
# Glasses sender
https://YOUR_DEPLOYMENT.example/?headonly=1&session=team_demo

# Mac camera receiver
https://YOUR_DEPLOYMENT.example/?camera=1&source=head&session=team_demo
```

On the glasses, choose **START HEAD IMU** and hold a comfortable neutral posture without moving for three seconds. Calibration restarts when motion is detected, keeps the result unavailable as `--°` until it succeeds, and requires recalibration after a sensor gap or a large fit-changing orientation jump. The receiver accepts fresh `HEAD/head-relay` packets and becomes stale after the sender stops.

The outward-facing glasses camera is not exposed as a normal web camera. The camera receiver URL uses the Mac or phone camera where that page is open.

## macOS notifications

A colleague can receive native posture notifications without opening the camera HUD:

```bash
python3 macos/anti_turtle_notify.py \
  --base-url https://YOUR_DEPLOYMENT.example \
  --session team_demo \
  --mode HEAD \
  --notify-recovery
```

The default policy polls every 500 ms, ignores stale telemetry, alerts after three seconds of a warning state, and suppresses duplicate alerts for 30 seconds. It stores no telemetry locally. See [macos/README.md](macos/README.md).

For a persistent native status, install `macos/AntiTurtleMenu.swift` with `zsh macos/install_menu_bar.sh`. The menu bar shows a colored live angle, exposes connection details, opens the matching HUD, and can enable or disable the same posture notifications. Full Xcode is not required; macOS Command Line Tools are sufficient.

```bash
zsh macos/install_menu_bar.sh
open "$HOME/Applications/Anti Turtle Menu.app" --args \
  --base-url https://stage-codex-bridge-head-only.vercel.app \
  --session head-demo \
  --mode HEAD
```

See [macos/README.md](macos/README.md) for custom sessions, HYBRID mode, dry-run notifications, and troubleshooting.

## Hybrid mode

For HEAD + torso experiments:

1. relay NU/torso data through `public/torso-bridge.html`;
2. open `/?hybrid=1&session=team_demo` on the glasses;
3. open `/?camera=1&source=ble&session=team_demo` on the Mac;
4. use `--mode HYBRID` for the optional Mac notifier.

## Planned research directions

The next measurement work is intentionally separate from the current head-tilt coaching value:

- add an independent upper-torso IMU and fuse it with the glasses IMU to distinguish head motion from torso tilt;
- add a standardized side-view pose-estimation workflow using ear/tragus, shoulder/acromion, and manually confirmed or validated C7-related landmarks;
- combine sensor continuity, calibration quality, camera geometry, landmark confidence, and visibility into one confidence gate that abstains instead of reporting an unreliable value;
- compare candidate CVA and forward-head-posture estimates with annotated reference measurements and report measurement error, repeatability, agreement, latency, and failure cases;
- prototype clinician-reviewed McKenzie-style cervical-extension coaching as an optional exercise module with stop instructions and contraindication messaging, not as automated treatment or a medical prescription.

Shoulder and face keypoints may improve a multimodal posture estimate, but general pose models do not directly identify C7 and cannot establish clinical CVA accuracy without a standardized protocol and validation. Photographic CVA research commonly uses the tragus and C7 landmarks; see this [validation study](https://pubmed.ncbi.nlm.nih.gov/32911612/). McKenzie-style exercise evidence is treated as an intervention research input rather than a product efficacy claim; see this [small comparative study](https://pubmed.ncbi.nlm.nih.gov/30154609/). The detailed gates are maintained in [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/CLINICAL_LIMITS.md](docs/CLINICAL_LIMITS.md).

## Deployment

The repository is Vercel-compatible. Git-triggered deployments are disabled in `vercel.json`; release deployments must be built locally and uploaded with `vercel deploy --prebuilt`. Shared relay operation requires one Redis REST-compatible environment-variable pair:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Legacy Vercel KV names `KV_REST_API_URL` and `KV_REST_API_TOKEN` are also supported. Without Redis, the server falls back to process memory for local development only.

`OPENAI_API_KEY` is optional and is used only by the server-side coaching text endpoint. Never put it in browser code.

## Privacy and security

The demo relay is unauthenticated. Anyone who knows a deployment URL and session label may be able to read the latest short-lived telemetry for that session.

- never use names, emails, patient IDs, or other personal data as session labels;
- do not send clinical or production health data through the demo deployment;
- use authentication, authorization, encryption policy, retention controls, and per-user channels before real-world deployment;
- report vulnerabilities according to [SECURITY.md](SECURITY.md).

## Clinical limitations

Head orientation is not CVA. An IMU in glasses cannot locate the tragus or C7 and cannot reliably distinguish neck translation from whole-body tilt without another reference. Thresholds in this prototype are coaching defaults, not diagnostic cutoffs. See [docs/CLINICAL_LIMITS.md](docs/CLINICAL_LIMITS.md).

## Project status

This is an experimental prototype. Device support, browser sensor permissions, and Meta Display Web App behavior may change. Test on the intended glasses and operating system before relying on a release.

The current milestone is the public [`v0.1.1`](https://github.com/Youngkwon-Lee/anti-turtle-meta-hud/releases/tag/v0.1.1) research prototype. See the [roadmap](docs/ROADMAP.md), [release checklist](docs/RELEASE_CHECKLIST.md), [open-source review](docs/OPEN_SOURCE_REVIEW.md), and [Meta Ray-Ban Display ecosystem map](docs/META_RAYBAN_OPEN_SOURCE_ECOSYSTEM.md) before extending the measurement or device scope.

## Team and credits

The original TOYTHON Anti Turtle hackathon team was:

- 구철회
- 박상준
- 홍주영
- 이영권 (`Youngkwon-Lee`)

This extracted open-source repository is currently maintained by `Youngkwon-Lee`. Its Git history may not represent design, hardware, operations, presentation, and other non-code contributions made during the hackathon.

## Contributing and license

Contributions are welcome under [CONTRIBUTING.md](CONTRIBUTING.md). The project is licensed under the [Apache License 2.0](LICENSE). Third-party and generated-asset notes are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Meta, Meta AI, Ray-Ban, and EssilorLuxottica are trademarks of their respective owners. This is an independent community project and is not affiliated with or endorsed by them.
