# Meta Ray-Ban Display open-source ecosystem

Reviewed on 2026-08-24. This is a commit-pinned engineering survey, not legal advice. Public source availability does not by itself make a project open source.

## What is available

The strongest official starting point is Meta's [Wearables Web App toolkit](https://github.com/facebookincubator/meta-wearables-webapp/tree/24d7bfc553d33d7fe849cd70d04544b1de555896), which carries a BSD-style license. It documents the same runtime model used by this project: a 600×600 HTML/CSS/JavaScript surface, directional input, user-initiated sensor permission, standard `DeviceMotionEvent` and `DeviceOrientationEvent` data, additive-display constraints, simulation, and web deployment.

Meta also publishes the [iOS DAT repository](https://github.com/facebook/meta-wearables-dat-ios/tree/225f64ff1617e7acc8c407bb8d3ee132f7263d00) and [Android DAT repository](https://github.com/facebook/meta-wearables-dat-android/tree/81dfb51b9be26de5cd262bb1dcbb4b8d0d6bd2bc). Their `LICENSE` files point to the Meta Wearables Developer Terms and Acceptable Use Policy rather than a standard open-source license. Treat them as public developer SDKs governed by Meta's terms, not as BSD/MIT/Apache source that can automatically be copied or redistributed.

## Projects reviewed

| Project | What it contributes | License observed | Decision for Anti Turtle |
| --- | --- | --- | --- |
| [Meta Wearables Web App](https://github.com/facebookincubator/meta-wearables-webapp/tree/24d7bfc553d33d7fe849cd70d04544b1de555896) | Official 600×600 Web App model, input, device sensors, display guidance, simulator, and deployment skills | BSD-style | Primary platform reference. Follow its public APIs and interaction constraints. |
| [Meta DAT iOS](https://github.com/facebook/meta-wearables-dat-ios/tree/225f64ff1617e7acc8c407bb8d3ee132f7263d00) | Native camera streaming, capture, device and display modules | Meta developer terms | Do not treat as reusable OSS. Re-evaluate only if a native camera/display adapter becomes necessary. |
| [Meta DAT Android](https://github.com/facebook/meta-wearables-dat-android/tree/81dfb51b9be26de5cd262bb1dcbb4b8d0d6bd2bc) | Android counterpart to the native DAT surface | Meta developer terms | Same boundary as iOS; not a dependency of the current Web App. |
| [L+R Ray-Ban Meta demos](https://github.com/levin-riegner/lr-rbm-demos/tree/a3de062530734fa5038d233590f97f9aa3de9f0c) | Real device-orientation demos with calibration, smoothing, hysteresis, gesture recognition, and local profiles | MIT | Best community behavior reference. Reimplement small patterns with tests; preserve notice if code is imported. |
| [MRBD UI Kit](https://github.com/michaelcummings12/mrbd-ui-kit/tree/0d98b01ac8939fdabe3d9290b5849833c7e7133e) | React/Tailwind 600×600 root, focus engine, scrolling, and additive-optics UI patterns | MIT | Reference selectively. Do not migrate the vanilla client only to consume the kit. |
| [WASD](https://github.com/prasanthsasikumar/WASD/tree/651ecc068d4b2e69fccdb6418dfc67e4ad0e34a4) | Browser simulation of additive-waveguide brightness, ambient luminance, scenes, capture, and recording | MIT | Optional visual-QA companion to the official simulator; no runtime dependency. |
| [XG Glass SDK](https://github.com/hkust-spark/xg-glass-sdk/tree/2c7e6254abc95a143c84493254f344d97ace32fb) | Cross-device camera, microphone, display, and audio abstractions | Apache-2.0; Meta path also depends on official DAT terms | Experimental portability research only. Its Meta video stream is still described as a validation target. |

## Near-term patterns worth testing

The L+R demos contain the closest reusable interaction patterns for a head-mounted IMU:

- separate trigger and release thresholds to prevent flicker near a boundary;
- a short calibration window and user-specific threshold selection;
- EMA smoothing, deadbands, peak/reversal detection, and refractory periods;
- local profiles for nod, shake, tilt, and stillness;
- explicit permission flow and keyboard fallback for non-device testing.

For this repository, these should become small posture-engine functions plus recorded or synthetic replay fixtures. Wholesale source import is unnecessary. If upstream code, a package, or an asset is added, record its pinned commit and required notice in `THIRD_PARTY_NOTICES.md`.

## Current architecture decision

1. Keep the current vanilla Meta Web App and head-only wellness boundary for v0.1.
2. Use the official toolkit as the platform authority.
3. Prioritize calibration quality, hysteresis, cooldown, re-seat/drift states, and replay tests for v0.2.
4. Use the official simulator first and WASD only as supplemental additive-optics visual QA.
5. Add a native DAT adapter only when a validated product requirement cannot be met through the Web App surface.
6. Defer multi-glasses abstraction until the estimator, posture policy, and telemetry interfaces are stable.

Repository searches performed during this review did not find a directly overlapping Meta Ray-Ban Display posture-coaching project. That is a search result, not proof of being the first project in the world. It does suggest that Anti Turtle can provide a useful posture-specific reference implementation if its calibration, replay, privacy, and physical-device evidence remain reproducible.

## Re-check before reuse

Before adding any project above, re-check its current commit, `LICENSE`, notices, package terms, Meta platform terms, and distribution requirements. The intake policy and non-Meta posture references remain in [OPEN_SOURCE_REVIEW.md](OPEN_SOURCE_REVIEW.md).
