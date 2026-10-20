import math
import unittest
from types import SimpleNamespace
from detect_drowsiness import ClosureTracker, eye_ratio


class ClosureTests(unittest.TestCase):
    def test_blink_is_not_long_closure(self):
        t = ClosureTracker()
        t.update(.3, .3, 0)
        t.update(.1, .1, .1)
        self.assertEqual(t.update(.3, .3, .3).blinks, 1)
        self.assertEqual(t.alerts, 0)

    def test_elapsed_time_and_one_event_per_closure(self):
        for step in (.05, .1, .25):
            t = ClosureTracker()
            for i in range(round(2 / step) + 1):
                state = t.update(.1, .1, i * step)
            self.assertEqual(state.status, 'prolonged')
            self.assertEqual(state.alerts, 1)
            self.assertAlmostEqual(state.closed_seconds, 2)

    def test_missing_face_does_not_reuse_closed_eyes(self):
        t = ClosureTracker()
        for i in range(14):
            t.update(.1, .1, i / 10)
        self.assertEqual(t.update(None, None, 1.4).status, 'no-face')
        state = t.update(.1, .1, 1.5)
        self.assertEqual(state.closed_seconds, 0)
        self.assertEqual(state.alerts, 0)

    def test_gap_and_backwards_time_reset_evidence(self):
        t = ClosureTracker()
        t.update(.1, .1, 0)
        self.assertEqual(t.update(.1, .1, 10).closed_seconds, 0)
        self.assertEqual(t.update(.1, .1, 2).closed_seconds, 0)

    def test_wink_invalid_landmarks_and_zero_width(self):
        t = ClosureTracker()
        for i in range(30):
            state = t.update(.1, .3, i / 10)
        self.assertEqual(state.status, 'open')
        self.assertEqual(t.update(math.nan, .1, 3).status, 'no-face')
        self.assertIsNone(eye_ratio([], range(6), 640, 480))
        self.assertIsNone(eye_ratio([SimpleNamespace(x=.1, y=.1)] * 6, range(6), 640, 480))

    def test_ear_is_pixel_correct_and_scale_invariant(self):
        # Physical eye width 100px, vertical opening 20px, in a non-square image.
        points = [(0, 0), (25, -10), (75, -10), (100, 0), (75, 10), (25, 10)]
        landmarks = [SimpleNamespace(x=x / 640, y=y / 480) for x, y in points]
        self.assertAlmostEqual(eye_ratio(landmarks, range(6), 640, 480), .2)
        self.assertAlmostEqual(eye_ratio(landmarks, range(6), 1280, 960), .2)


if __name__ == '__main__':
    unittest.main()
