#!/usr/bin/env python3
"""Poll Anti Turtle telemetry and show native macOS posture notifications."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


DEFAULT_BASE_URL = "http://127.0.0.1:3000"
ALERT_STATES = {"WARNING", "INTERVENTION"}


def build_endpoint(base_url: str, session: str, mode: str) -> str:
    base = base_url.rstrip("/")
    query = urllib.parse.urlencode({"session": session, "mode": mode.upper()})
    return f"{base}/api/telemetry?{query}"


def parse_timestamp(value: Any) -> float | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def telemetry_event_id(telemetry: dict[str, Any]) -> tuple[str, int] | None:
    stream_id = telemetry.get("streamId")
    sequence = telemetry.get("seq")
    if not isinstance(stream_id, str) or not stream_id:
        return None
    if not isinstance(sequence, int) or sequence < 0:
        return None
    return stream_id, sequence


@dataclass(frozen=True)
class NotificationEvent:
    kind: str
    title: str
    body: str
    subtitle: str


class NotificationPolicy:
    def __init__(
        self,
        bad_seconds: float = 3.0,
        cooldown_seconds: float = 30.0,
        stale_seconds: float = 2.5,
        notify_recovery: bool = False,
    ) -> None:
        self.bad_seconds = max(0.0, bad_seconds)
        self.cooldown_seconds = max(0.0, cooldown_seconds)
        self.stale_seconds = max(0.1, stale_seconds)
        self.notify_recovery = notify_recovery
        self.last_event_id: tuple[str, int] | None = None
        self.last_alert_at = float("-inf")
        self.alert_active = False

    def evaluate(self, payload: dict[str, Any], now: float | None = None) -> NotificationEvent | None:
        current_time = time.time() if now is None else now
        telemetry = payload.get("telemetry")
        if not isinstance(telemetry, dict):
            return None

        received_at = parse_timestamp(payload.get("receivedAt") or telemetry.get("receivedAt"))
        if received_at is None or current_time - received_at > self.stale_seconds:
            return None

        event_id = telemetry_event_id(telemetry)
        if event_id is not None and event_id == self.last_event_id:
            return None
        if event_id is not None:
            self.last_event_id = event_id

        state = str(telemetry.get("state") or "").upper()
        try:
            angle = float(telemetry.get("forwardDeg"))
        except (TypeError, ValueError):
            return None
        try:
            bad_duration = float(telemetry.get("badDurationS") or 0)
        except (TypeError, ValueError):
            bad_duration = 0.0

        alert_due = state == "INTERVENTION" or (
            state in ALERT_STATES and bad_duration >= self.bad_seconds
        )
        if alert_due and current_time - self.last_alert_at >= self.cooldown_seconds:
            self.last_alert_at = current_time
            self.alert_active = True
            return NotificationEvent(
                kind="posture-alert",
                title="Anti Turtle",
                body="턱을 당기고 정수리를 위로 세워주세요.",
                subtitle=f"머리 기준 편차 {angle:.1f}° · {bad_duration:.1f}초",
            )

        if state == "STABLE" and self.alert_active:
            self.alert_active = False
            if self.notify_recovery:
                return NotificationEvent(
                    kind="recovery",
                    title="Anti Turtle",
                    body="좋은 자세로 돌아왔습니다.",
                    subtitle=f"머리 기준 편차 {angle:.1f}°",
                )
        return None


def fetch_payload(endpoint: str, timeout_seconds: float) -> dict[str, Any]:
    request = urllib.request.Request(
        endpoint,
        headers={"Accept": "application/json", "User-Agent": "anti-turtle-macos-notifier/0.1"},
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        if response.status != 200:
            raise RuntimeError(f"telemetry server returned HTTP {response.status}")
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise RuntimeError("telemetry server returned a non-object response")
    return payload


def show_notification(event: NotificationEvent, sound: str | None, dry_run: bool) -> None:
    if dry_run:
        print(f"NOTIFY {event.kind}: {event.title} | {event.subtitle} | {event.body}")
        return

    script = [
        "on run argv",
        "set notificationTitle to item 1 of argv",
        "set notificationBody to item 2 of argv",
        "set notificationSubtitle to item 3 of argv",
    ]
    if sound:
        script.append("display notification notificationBody with title notificationTitle subtitle notificationSubtitle sound name (item 4 of argv)")
    else:
        script.append("display notification notificationBody with title notificationTitle subtitle notificationSubtitle")
    script.append("end run")

    command = ["osascript"]
    for line in script:
        command.extend(["-e", line])
    command.extend(["--", event.title, event.body, event.subtitle])
    if sound:
        command.append(sound)
    subprocess.run(command, check=True, timeout=8)


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Show macOS notifications from Anti Turtle HEAD/HYBRID telemetry.",
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--session", default="head-demo")
    parser.add_argument("--mode", choices=("HEAD", "HYBRID"), default="HEAD")
    parser.add_argument("--poll-ms", type=int, default=500)
    parser.add_argument("--stale-ms", type=int, default=2500)
    parser.add_argument("--bad-seconds", type=float, default=3.0)
    parser.add_argument("--cooldown-seconds", type=float, default=30.0)
    parser.add_argument("--timeout-seconds", type=float, default=5.0)
    parser.add_argument("--notify-recovery", action="store_true")
    parser.add_argument("--sound", default="Glass")
    parser.add_argument("--no-sound", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--once", action="store_true")
    return parser


def run(args: argparse.Namespace) -> int:
    endpoint = build_endpoint(args.base_url, args.session, args.mode)
    policy = NotificationPolicy(
        bad_seconds=args.bad_seconds,
        cooldown_seconds=args.cooldown_seconds,
        stale_seconds=max(100, args.stale_ms) / 1000,
        notify_recovery=args.notify_recovery,
    )
    sound = None if args.no_sound else args.sound
    poll_seconds = max(100, args.poll_ms) / 1000
    print(f"Watching {endpoint}")
    print("Press Control-C to stop. No telemetry is stored locally.")

    while True:
        try:
            payload = fetch_payload(endpoint, max(0.5, args.timeout_seconds))
            event = policy.evaluate(payload)
            if event:
                show_notification(event, sound, args.dry_run)
        except (urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as error:
            print(f"telemetry unavailable: {error}", file=sys.stderr)
            if args.once:
                return 1
        except subprocess.SubprocessError as error:
            print(f"notification failed: {error}", file=sys.stderr)
            if args.once:
                return 1

        if args.once:
            return 0
        time.sleep(poll_seconds)


def main() -> int:
    return run(create_parser().parse_args())


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nStopped.")
        raise SystemExit(0)
