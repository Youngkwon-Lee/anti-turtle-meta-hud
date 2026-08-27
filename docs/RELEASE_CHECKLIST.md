# v0.1.1 release checklist

Do not publish the `v0.1.1` tag or GitHub release until every required gate below is complete. Record immutable URLs and sanitized observations in `docs/releases/v0.1.1.md`.

## Automated gates

- [ ] GitHub Actions is green for the exact release commit.
- [x] `npm test` passes with 59 Node tests and 7 Python tests on Node.js 20+ and Python 3.10+.
- [x] `npm run check` passes.
- [x] The native menu-bar source passes the documented Swift typecheck on macOS.
- [x] `git diff --check` reports no whitespace errors.
- [x] `vercel.json` contains `git.deploymentEnabled=false`.

## Manual device gates

- [x] Demo mode renders without a sensor.
- [ ] Physical Meta Display glasses complete motion permission and neutral calibration.
- [ ] Calibration rejects movement, completes only after a continuous stable three-second hold, and keeps the value at `--°` beforehand.
- [ ] The HEAD sender updates a Mac camera receiver with the same redacted session label.
- [ ] Stopping or hiding the sender produces a stale receiver state and a clear recovery path.
- [ ] A sensor gap or large fit-changing jump requires recalibration and the recalibration action restores normal operation.
- [x] HYBRID mode either passes with the NU torso sensor or is explicitly listed as not re-verified for this release.
- [ ] macOS Notification Center and menu-bar behavior are tested on a supported macOS version.

Record device, OS, browser, commit SHA, physical/simulated status, and sanitized observations in a device compatibility issue. Do not attach faces, health data, credentials, or real session labels.

## Public-project gates

- [x] README quick start and Meta AI setup instructions match the release commit.
- [x] `SECURITY.md`, clinical limitations, privacy warning, third-party notices, roadmap, and changelog are current.
- [ ] GitHub private vulnerability reporting, secret scanning, and branch protection are enabled where the repository plan supports them.
- [ ] The public deployment root and a telemetry stale/no-data response are smoke-tested.
- [ ] The release was uploaded only with `vercel deploy --prebuilt`, and the stable alias points to the verified immutable deployment.
- [x] The release notes call the project a wellness/research prototype and do not claim CVA measurement or diagnosis.

## Publish

1. Move the prepared `CHANGELOG.md` entries from `Unreleased` to `0.1.1` and add the release date.
2. Merge the reviewed calibration-reliability pull request to `main`.
3. Create an annotated `v0.1.1` tag at the verified commit.
4. Publish a GitHub release from the changelog.
5. Re-run the public deployment and physical-device smoke checks against the tagged version.
