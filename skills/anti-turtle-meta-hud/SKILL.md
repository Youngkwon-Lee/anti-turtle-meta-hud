---
name: anti-turtle-meta-hud
description: Implement or review features in the Anti Turtle Meta HUD repository, including Meta Display UI, head/torso IMU calibration, telemetry relay, the macOS companion, and carefully bounded pose/CVA or exercise research. Use for code and documentation changes in this project; not for diagnosing posture or making clinical efficacy claims.
---

# Anti Turtle Meta HUD

Work inside the repository that contains this skill. Read `../../AGENTS.md` before editing; it is the source of truth for product boundaries, deployment restrictions, and required proof.

## Route the task

Read only the material needed for the requested surface:

- Meta Display HUD or gestures: `../../public/index.html`, `../../public/styles.css`, `../../public/client.js`, and the lifecycle tests.
- Calibration or posture math: `../../public/posture-engine.js`, `../../tests/posture-engine.test.js`, and `../../docs/CALIBRATION_RELIABILITY_V0_2.md`.
- HEAD/HYBRID relay: `../../public/relay-protocol.js`, `../../lib/telemetry.js`, `../../lib/telemetry-store.js`, and their tests.
- NU/torso ingestion: `../../public/torso-parser.js`, `../../public/torso-bridge.js`, `../../lib/torso.js`, and the torso tests.
- macOS menu bar or notifications: `../../macos/README.md`, the changed Swift or Python file, and `../../macos/tests/`.
- CVA/FHP, pose estimation, or exercise coaching: `../../docs/CLINICAL_LIMITS.md` and `../../docs/ROADMAP.md` before proposing code or claims.
- Release or deployment: `../../docs/RELEASE_CHECKLIST.md`, `../../vercel.json`, and the Vercel `--prebuilt` guard in `../../AGENTS.md`.

## Implement

1. Restate the requested observable outcome and identify the owning module.
2. Inspect existing behavior and tests before choosing an abstraction.
3. Preserve calibration readiness, signed direction, stale recovery, session/stream ordering, hidden-page cleanup, and non-clinical wording.
4. Add or update the nearest behavior test. Use recorded or synthetic telemetry rather than personal captures.
5. For UI work, keep the 600×600 additive-display constraints and desktop receiver behavior aligned. Prefer CSS transitions and event-driven updates over an always-running animation loop.
6. For research work, implement measurement and confidence outputs separately from coaching. An unreliable sample must become unavailable, not a plausible-looking number.
7. Keep English and Korean setup or claim summaries synchronized.

## Verify

Run the narrowest affected test while iterating. Before completion run:

```bash
npm run check
npm test
git diff --check
```

Also typecheck the Swift app after changing it:

```bash
xcrun swiftc -typecheck \
  -framework Cocoa \
  -framework UserNotifications \
  macos/AntiTurtleMenu.swift
```

Render and inspect HUD changes at 600×600 and at the affected desktop viewport. Exercise the permission, calibrating, ready, warning, stale, and recalibration states that the change can reach. If physical Meta Display glasses were not used, say so explicitly.

## Deliver

Summarize the observable change, affected files, proof results, and remaining device or research uncertainty. Never describe the HEAD/HYBRID value as clinical CVA, the unauthenticated relay as production-ready, a concept mockup as optical capture, or an exercise prototype as treatment.
