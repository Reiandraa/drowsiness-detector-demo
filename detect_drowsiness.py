"""Eye-closure logic, adapted from P SREESANKAR's MIT MediaPipe demo.

Uses pixel-correct EAR geometry with fresh, timestamped observations. Missing
faces, invalid landmarks, or gaps reset evidence instead of reusing stale EAR.
This is an educational heuristic, not a measurement of sleep or driving safety.
"""
from dataclasses import dataclass
from math import hypot, isfinite

LEFT_EYE = (362, 385, 387, 263, 373, 380)
RIGHT_EYE = (33, 160, 158, 133, 153, 144)


def eye_ratio(landmarks, indices, width, height):
    if not width or not height:
        return None
    try:
        points = [(landmarks[i].x * width, landmarks[i].y * height) for i in indices]
        if not all(isfinite(v) for p in points for v in p):
            return None
        distance = lambda a, b: hypot(a[0] - b[0], a[1] - b[1])
        horizontal = distance(points[0], points[3])
        if horizontal < 1:
            return None
        ratio = (distance(points[1], points[5]) + distance(points[2], points[4])) / (2 * horizontal)
        return ratio if 0 <= ratio <= 1 else None
    except (IndexError, TypeError, AttributeError):
        return None


@dataclass(frozen=True)
class Observation:
    status: str
    closed_seconds: float = 0.0
    ear: float | None = None
    alerts: int = 0
    blinks: int = 0


class ClosureTracker:
    def __init__(self, threshold=0.23, alert_after=1.5, max_gap=0.35):
        if not 0 < threshold < 1 or alert_after <= 0 or max_gap <= 0:
            raise ValueError('Invalid tracker settings')
        self.threshold, self.alert_after, self.max_gap = threshold, alert_after, max_gap
        self.reset()

    def reset(self):
        self.last_time = self.closed_at = None
        self.alerted = False
        self.alerts = self.blinks = 0

    def update(self, left, right, now):
        if not isfinite(now):
            raise ValueError('Timestamp must be finite')
        gap = self.last_time is not None and (now < self.last_time or now - self.last_time > self.max_gap)
        self.last_time = now
        if gap:
            self.closed_at = None
            self.alerted = False
        valid = all(v is not None and isfinite(v) and 0 <= v <= 1 for v in (left, right))
        if not valid:
            self.closed_at = None
            self.alerted = False
            return Observation('no-face', alerts=self.alerts, blinks=self.blinks)
        ear = (left + right) / 2
        if left < self.threshold and right < self.threshold:
            if self.closed_at is None:
                self.closed_at = now
            duration = now - self.closed_at
            if duration >= self.alert_after:
                if not self.alerted:
                    self.alerts += 1
                self.alerted = True
            return Observation('prolonged' if self.alerted else 'closed', duration, ear, self.alerts, self.blinks)
        if self.closed_at is not None and 0.08 <= now - self.closed_at <= 0.7 and not self.alerted:
            self.blinks += 1
        self.closed_at = None
        self.alerted = False
        return Observation('open', ear=ear, alerts=self.alerts, blinks=self.blinks)
