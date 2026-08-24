# v0.1.0 release checklist

The package version is already `0.1.0`, but no tag or GitHub release should be published until every required gate below is complete.

## Automated gates

- [ ] GitHub Actions is green for the exact release commit.
- [ ] `npm test` passes from a clean checkout on Node.js 20+ and Python 3.10+.
- [ ] `npm run check` passes.
- [ ] The native menu-bar source passes the documented Swift typecheck on macOS.
- [ ] `git diff --check` reports no whitespace errors.

## Manual device gates

- [ ] Demo mode renders without a sensor.
- [ ] Physical Meta Display glasses complete motion permission and neutral calibration.
- [ ] The HEAD sender updates a Mac camera receiver with the same redacted session label.
- [ ] Stopping or hiding the sender produces a stale receiver state and a clear recovery path.
- [ ] HYBRID mode either passes with the NU torso sensor or is explicitly listed as not re-verified for this release.
- [ ] macOS Notification Center and menu-bar behavior are tested on a supported macOS version.

Record device, OS, browser, commit SHA, physical/simulated status, and sanitized observations in a device compatibility issue. Do not attach faces, health data, credentials, or real session labels.

## Public-project gates

- [ ] README quick start and Meta AI setup instructions match the release commit.
- [ ] `SECURITY.md`, clinical limitations, privacy warning, third-party notices, roadmap, and changelog are current.
- [ ] GitHub private vulnerability reporting, secret scanning, and branch protection are enabled where the repository plan supports them.
- [ ] The public deployment root and a telemetry stale/no-data response are smoke-tested.
- [ ] The release notes call the project a wellness/research prototype and do not claim CVA measurement or diagnosis.

## Publish

1. Move the prepared `CHANGELOG.md` entries from `Unreleased` to `0.1.0` and add the release date.
2. Merge the reviewed hardening pull request to `main`.
3. Create signed tag `v0.1.0` at the verified commit.
4. Publish a GitHub release from the changelog.
5. Re-run the public deployment and physical-device smoke checks against the tagged version.
