# Open-source review

Reviewed on 2026-08-24. This is an engineering intake record, not legal advice. Re-check the exact upstream commit and license before adding any dependency, code, asset, model, or dataset.

## Reuse policy

- Apache-2.0, MIT, and BSD-3-Clause material may be considered after attribution, notice, patent, and distribution obligations are reviewed.
- Strong-copyleft, noncommercial, source-available, missing-license, and ambiguous-license repositories are research references only for this Apache-2.0 project.
- Reimplement behavior from requirements and public documentation; do not translate, copy, or mechanically port restricted source.
- Record every accepted dependency or asset in `THIRD_PARTY_NOTICES.md` with its pinned version or commit.

## Reviewed projects

| Project | Useful lesson | License observed | Decision |
| --- | --- | --- | --- |
| [Pose Nudge](https://github.com/DDULDDUCK/pose-nudge/tree/d96228a6361b9a199317d2367d7e560b31ad8e6d) | Settings, local history, release automation, and cross-platform packaging | AGPL-3.0 | Ideas and black-box behavior only; do not copy code or assets. |
| [Bates Posture](https://github.com/wtbates99/batesposture/tree/fb4f11796e4e99ddafb2551713c7868cb48e5efe) | Local-first processing, auto-pause, adaptive FPS, confidence gating, and opt-in export | PolyForm Noncommercial 1.0.0 | Source-available but not suitable for this project's unrestricted use; do not copy. |
| [PosturePro](https://github.com/tanisheesh/PosturePro/tree/bcdd25b782110ec130decb976463531396a4a642) | Browser landmark-based neck and torso angle concepts | README claims GPL-3.0; GitHub did not detect a license file | Treat as non-reusable until the upstream license is clarified. |
| [MentraOS](https://github.com/Mentra-Community/MentraOS/tree/55bee6f6061b1722fd9d3c1f714ed27c0ddfad2f) | Device abstraction and multi-glasses application architecture | MIT | Architecture reference; prefer published APIs/packages over copied internals. |
| [Brilliant SDK](https://github.com/brilliantlabsAR/brilliant_sdk/tree/1221360b40408fd871d90d5f89f1e0f31982093d) | Display, camera, IMU, input APIs, and a hardware-free emulator | BSD-3-Clause | Candidate for a later isolated device adapter with notices preserved. |
| [x-io Fusion](https://github.com/xioTechnologies/Fusion/tree/d69784c8f7058a6545802b8852d26d6fcfd5e119) | Gyroscope bias correction, AHRS fusion, axis remapping, and rejection logic | MIT | Candidate only if a future device exposes suitable raw IMU data. |

## Meta Ray-Ban Display ecosystem

The Meta-specific survey is maintained in [META_RAYBAN_OPEN_SOURCE_ECOSYSTEM.md](META_RAYBAN_OPEN_SOURCE_ECOSYSTEM.md). The key license boundary is:

- Meta's [`meta-wearables-webapp`](https://github.com/facebookincubator/meta-wearables-webapp/tree/24d7bfc553d33d7fe849cd70d04544b1de555896) is a BSD-style official platform reference.
- The public [`meta-wearables-dat-ios`](https://github.com/facebook/meta-wearables-dat-ios/tree/225f64ff1617e7acc8c407bb8d3ee132f7263d00) and [`meta-wearables-dat-android`](https://github.com/facebook/meta-wearables-dat-android/tree/81dfb51b9be26de5cd262bb1dcbb4b8d0d6bd2bc) repositories are governed by Meta developer terms rather than a standard open-source license.
- MIT community projects such as [L+R demos](https://github.com/levin-riegner/lr-rbm-demos/tree/a3de062530734fa5038d233590f97f9aa3de9f0c), [MRBD UI Kit](https://github.com/michaelcummings12/mrbd-ui-kit/tree/0d98b01ac8939fdabe3d9290b5849833c7e7133e), and [WASD](https://github.com/prasanthsasikumar/WASD/tree/651ecc068d4b2e69fccdb6418dfc67e4ad0e34a4) are references for interaction and QA patterns. Any imported code still requires its notice and pinned provenance.

## Current decision

The v0.1 hardening milestone adds no upstream runtime code, model, dataset, or asset. Near-term work should clean-room implement calibration quality, replay fixtures, threshold hysteresis, cooldown, re-seat/drift handling, auto-pause, and modular device boundaries using the existing project code.
