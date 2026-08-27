# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-08-27

### Changed

- Replaced instant head calibration with a warm-up and continuous three-second stable hold using a median baseline.
- Allowed the three-second hold to complete with lower-rate orientation streams observed on the physical display glasses.
- Kept the HEAD value unavailable as `--°` until calibration succeeds.
- Added visible calibration progress, movement rejection, and an explicit recalibration action.
- Required recalibration after a sensor gap or a large orientation jump that may indicate the glasses were removed or reseated.

### Added

- Replay fixtures and tests for startup transients, movement rejection, stable calibration, and sensor continuity failures.
- A release guard that disables Git-triggered Vercel deployments so reviewed prebuilt artifacts can be deployed without a Vercel-managed source build.

## [0.1.0] - 2026-08-24

### Added

- Meta Display personal-baseline head-tilt HUD.
- HEAD-only and HEAD + NU torso HYBRID telemetry relay modes.
- Desktop camera receiver with fresh/stale fallback behavior.
- Native macOS posture notifications and live menu-bar angle.
- Meta AI setup instructions, privacy warnings, clinical limits, and Apache-2.0 project documentation.
- Cross-platform CI for Node, Python, and the native Swift menu-bar source.
- Public roadmap, release checklist, and open-source reuse review.
- Structured bug, device compatibility, and pull-request templates.

[Unreleased]: https://github.com/Youngkwon-Lee/anti-turtle-meta-hud/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Youngkwon-Lee/anti-turtle-meta-hud/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Youngkwon-Lee/anti-turtle-meta-hud/releases/tag/v0.1.0
