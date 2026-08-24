# Contributing

Thank you for helping improve Anti Turtle Meta HUD.

## Before opening a pull request

1. Keep changes focused and avoid unrelated formatting rewrites.
2. Do not commit `.env` files, Vercel project metadata, telemetry captures, personal session labels, or health information.
3. Preserve the distinction between head tilt from baseline and clinical CVA/FHP measurement.
4. Add or update tests for behavior changes.
5. Run:

```bash
npm test
npm run check
git diff --check
```

On macOS, changes to the native menu-bar app must also pass:

```bash
xcrun swiftc -typecheck \
  -framework Cocoa \
  -framework UserNotifications \
  macos/AntiTurtleMenu.swift
```

## Design and device evidence

For HUD changes, include the target viewport, browser, state, and a screenshot that contains no personal or clinical information. State clearly whether the change was tested on physical Meta Display glasses.

## Contributions and licensing

By submitting a contribution, you agree that it is licensed under the repository's Apache License 2.0. Only submit code and assets you have the right to license.
