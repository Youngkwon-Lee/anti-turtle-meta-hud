import importlib.util
import pathlib
import sys
import unittest
from datetime import datetime, timezone
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).parents[1] / "anti_turtle_notify.py"
SPEC = importlib.util.spec_from_file_location("anti_turtle_notify", MODULE_PATH)
notifier = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = notifier
SPEC.loader.exec_module(notifier)


def payload(
    now: float,
    *,
    state: str = "WARNING",
    bad_duration: float = 3.2,
    angle: float = 18.0,
    stream: str = "stream-a",
    sequence: int = 1,
):
    return {
        "receivedAt": datetime.fromtimestamp(now, timezone.utc).isoformat(),
        "telemetry": {
            "state": state,
            "badDurationS": bad_duration,
            "forwardDeg": angle,
            "streamId": stream,
            "seq": sequence,
        },
    }


class NotificationPolicyTest(unittest.TestCase):
    def test_builds_mode_and_session_specific_endpoint(self):
        endpoint = notifier.build_endpoint("https://example.test/", "pilot 01", "head")
        self.assertEqual(
            endpoint,
            "https://example.test/api/telemetry?session=pilot+01&mode=HEAD",
        )

    def test_notifies_after_warning_hold_and_suppresses_duplicate(self):
        policy = notifier.NotificationPolicy(cooldown_seconds=30)
        first = policy.evaluate(payload(100, sequence=4), now=100)
        duplicate = policy.evaluate(payload(100, sequence=4), now=101)

        self.assertEqual(first.kind, "posture-alert")
        self.assertIn("18.0°", first.subtitle)
        self.assertIsNone(duplicate)

    def test_cooldown_prevents_repeated_alerts(self):
        policy = notifier.NotificationPolicy(cooldown_seconds=30)
        self.assertIsNotNone(policy.evaluate(payload(100, sequence=1), now=100))
        self.assertIsNone(policy.evaluate(payload(105, sequence=2), now=105))
        self.assertIsNotNone(policy.evaluate(payload(131, sequence=3), now=131))

    def test_ignores_short_warning_and_stale_packet(self):
        policy = notifier.NotificationPolicy(stale_seconds=2.5)
        self.assertIsNone(policy.evaluate(payload(100, bad_duration=2.9), now=100))
        self.assertIsNone(policy.evaluate(payload(100, sequence=2), now=103))

    def test_intervention_alerts_immediately(self):
        policy = notifier.NotificationPolicy(bad_seconds=10)
        event = policy.evaluate(
            payload(100, state="INTERVENTION", bad_duration=3.0),
            now=100,
        )
        self.assertEqual(event.kind, "posture-alert")

    def test_optional_recovery_notification_fires_once(self):
        policy = notifier.NotificationPolicy(notify_recovery=True)
        policy.evaluate(payload(100, sequence=1), now=100)
        recovery = policy.evaluate(
            payload(101, state="STABLE", bad_duration=0, angle=2, sequence=2),
            now=101,
        )
        repeated = policy.evaluate(
            payload(102, state="STABLE", bad_duration=0, angle=2, sequence=3),
            now=102,
        )

        self.assertEqual(recovery.kind, "recovery")
        self.assertIsNone(repeated)

    @mock.patch.object(notifier.subprocess, "run")
    def test_native_notification_uses_osascript_argv_without_shell(self, run_process):
        event = notifier.NotificationEvent(
            kind="posture-alert",
            title="Anti Turtle",
            body="자세를 확인하세요.",
            subtitle="머리 기준 편차 18.0°",
        )

        notifier.show_notification(event, "Glass", dry_run=False)

        command = run_process.call_args.args[0]
        self.assertEqual(command[0], "osascript")
        self.assertIn(event.title, command)
        self.assertIn(event.body, command)
        self.assertIn(event.subtitle, command)
        self.assertNotIn("shell", run_process.call_args.kwargs)


if __name__ == "__main__":
    unittest.main()
