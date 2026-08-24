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

## Current decision

The v0.1 hardening milestone adds no upstream runtime code, model, dataset, or asset. Near-term work should clean-room implement calibration quality, replay fixtures, auto-pause, and modular device boundaries using the existing project code.
