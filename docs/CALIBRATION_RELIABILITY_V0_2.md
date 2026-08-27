# Calibration reliability v0.2

Implemented on 2026-08-25 for the Meta Ray-Ban Display head-only flow. This remains a wellness and research prototype; the checks below improve baseline reliability but do not turn head orientation into CVA or an FHP diagnosis.

## User flow

1. Select `START HEAD IMU` from an explicit user action.
2. Look forward and hold a comfortable neutral posture.
3. The HUD warms up, then requires three continuous stable seconds.
4. Movement resets the progress and shows `MOVEMENT — RESTART`.
5. A successful baseline starts at `0.0°` and exposes an always-available `RECALIBRATE` action.
6. A sensor gap or large instantaneous angle jump pauses posture output and requires recalibration.

Before calibration, the HUD uses `--°`; it no longer presents `0.0°` as though a baseline already exists.

## Current engineering thresholds

| Check | Current value | Behavior |
| --- | ---: | --- |
| Sensor warm-up | 300 ms | Startup values do not enter the stable hold window. |
| Stable hold | 3,000 ms and at least 30 samples | Baseline is the median of the accepted window. |
| Window range | at most 2.5° | A wider window restarts calibration. |
| Consecutive step | at most 1.2° | A larger step reports movement and restarts calibration. |
| Stale timeout | 3,000 ms | The HUD shows `SENSOR STALE` and pauses output. |
| Continuity gap | over 2,000 ms | The next sample requires a fresh calibration. |
| Instantaneous jump | over 45° | The HUD shows `CHECK FIT` and requires recalibration. |

These are conservative prototype defaults, not clinical cutoffs. A large jump is only a fit-check signal; it does not prove that the glasses were removed or reseated. Slow sensor drift cannot be distinguished reliably from real head motion with a single head-mounted orientation stream.

## Verification

- Synthetic replay fixtures cover stable neutral calibration, movement followed by a stable hold, and gap/jump continuity classification.
- The complete Node test suite, Python companion tests, and JavaScript syntax checks must pass.
- A 600×600 local browser run must show idle `--°`, visible calibration progress, movement restart, completed `0.0°`, `RECALIBRATE`, and stale/fit-check recovery states.
- Physical Meta Display proof is still required after deployment: permission, 3-second calibration, deliberate movement rejection, normal posture response, sensor interruption, glasses reseat, recalibration, and relay recovery.

## Source boundaries

- Calibration and continuity logic: `public/posture-engine.js`
- Sensor lifecycle and HUD state: `public/client.js`
- 600×600 calibration UI: `public/index.html` and `public/styles.css`
- Replay fixtures: `tests/fixtures/head-calibration-replays.json`
- Unit coverage: `tests/posture-engine.test.js`
