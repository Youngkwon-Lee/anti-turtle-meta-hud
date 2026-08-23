# macOS notification receiver

`anti_turtle_notify.py` polls the same HEAD or HYBRID relay used by the camera HUD and shows a native macOS notification when bad posture continues for the configured duration. It uses only Python's standard library and `/usr/bin/osascript`.

The Ray-Ban sender and the Mac must use the same non-sensitive session label:

```text
# Ray-Ban sender
https://YOUR_DEPLOYMENT.example/?headonly=1&session=team_demo
```

On the colleague's Mac:

```bash
python3 macos/anti_turtle_notify.py \
  --base-url https://YOUR_DEPLOYMENT.example \
  --session team_demo \
  --mode HEAD \
  --notify-recovery
```

Use `--dry-run` to print notifications without opening Notification Center, and `--once` to check connectivity once. The default policy is:

- poll every 500 ms;
- ignore telemetry older than 2.5 seconds;
- notify after 3 seconds of `WARNING`, or immediately for `INTERVENTION`;
- suppress repeated alerts for 30 seconds;
- store no telemetry locally.

macOS may ask to allow notifications from the terminal or Script Editor the first time. Open **System Settings → Notifications** if they do not appear.

This is a wellness prototype, not a medical alarm. Do not use personal or clinical identifiers as the public demo `session` value.
