# Roadmap

Anti Turtle Meta HUD is currently a wellness and research prototype. This roadmap separates dependable posture coaching from future clinical-measurement research.

## v0.1 — reproducible prototype

Goal: freeze the working Meta Display, browser HUD, relay, and macOS companion flows as a reproducible public baseline.

- automated Node, Python, and Swift checks;
- documented release and physical-device verification gates;
- issue and pull-request templates that exclude personal and health data;
- explicit open-source reuse decisions and clinical limitations.

Exit criteria: CI is green on the release commit, the clean-checkout quick start works, the public deployment returns successfully, and a sanitized physical Meta Display test covers calibration, live HEAD relay, stale recovery, and the Mac receiver.

## v0.2 — reliability and usability

Goal: make setup, calibration, and recovery understandable without changing the non-clinical claim.

- split the browser client into sensor, estimator, transport, renderer, camera, and notification boundaries;
- add recorded/synthetic telemetry fixtures and browser end-to-end tests;
- add calibration stability, explicit recalibration, glasses re-seat, drift, permission, and stale states; the first implementation checkpoint is documented in [CALIBRATION_RELIABILITY_V0_2.md](CALIBRATION_RELIABILITY_V0_2.md);
- add configurable thresholds, hold time, cooldown, auto-pause, and optional local-only session summaries;
- test setup with 5–8 participants and record time to first live angle, setup completion, false alerts, and recovery success.

Exit criteria: at least 80% of participants complete setup without intervention, the median time to a live calibrated angle is under three minutes, and every denied/stale/no-sensor state offers a clear recovery action.

## Research mode — CVA and forward-head posture

Goal: evaluate a separate side-view measurement workflow. Do not replace the current head-tilt value or market it as diagnosis.

- use a standardized sagittal camera setup;
- locate or manually confirm tragus and C7 landmarks;
- synchronize the glasses IMU, an independent upper-torso IMU, and camera frames before evaluating sensor fusion;
- evaluate ear/tragus, shoulder/acromion, head-pose, and manually confirmed or validated C7-related landmarks without treating a generic shoulder keypoint as C7;
- reject frames with inadequate confidence, visibility, or camera geometry;
- compare candidate landmark/head-pose methods against annotated reference measurements;
- report repeatability, failure rate, latency, MAE, ICC, SEM/MDC, and Bland–Altman agreement, including subgroup and failure-case analysis.

Exit criteria must be chosen after a pilot study. No clinical claim is permitted from a software demo or a single algorithm accuracy number.

## Exercise coaching research — later

Goal: evaluate optional guided movement modules separately from measurement and diagnosis.

- prototype clinician-reviewed McKenzie-style cervical-extension instructions and feedback;
- define stop instructions, symptom screening, contraindication messaging, dosage limits, and escalation guidance before participant testing;
- keep exercise completion and user-reported response separate from CVA/FHP estimation;
- compare the module with an appropriate control under a predefined protocol rather than claiming efficacy from engagement or posture telemetry alone.

No exercise should be automatically prescribed from the prototype angle. Clinical intervention studies require qualified collaborators, consent and ethics review where applicable, and appropriate outcome measures.

## Device portability — later

Goal: keep posture policy and telemetry independent from a specific pair of glasses.

1. define input/output adapters around the stable v0.2 architecture;
2. prototype Brilliant Labs hardware using its emulator before physical-device testing;
3. evaluate Even G2 or other HUD devices only when their documented APIs expose the required display or sensor capability;
4. maintain a device evidence matrix covering sensors, permissions, display constraints, latency, dropout, and battery behavior.

## Production and clinical work — not yet

Production use requires authenticated and authorized channels, rate limiting, privacy and deletion controls, incident ownership, signed/notarized macOS distribution, and abuse monitoring. Clinical research additionally requires a predefined protocol, consent and ethics review where applicable, an appropriate reference method, and qualified clinical collaborators.
