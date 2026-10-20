"""Local webcam demo. Frames are processed in memory and never recorded."""
import argparse
from pathlib import Path
import subprocess
import sys
import time

from detect_drowsiness import ClosureTracker, LEFT_EYE, RIGHT_EYE, eye_ratio
from download_model import ensure_model
from load_video import Camera


def beep():
    if sys.platform == 'darwin':
        subprocess.Popen(['afplay', '/System/Library/Sounds/Ping.aiff'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    elif sys.platform == 'win32':
        import winsound
        winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
    else:
        print('\a', end='', flush=True)


def main():
    parser = argparse.ArgumentParser(description='Local eye-closure demo. Use while stationary; not a driving safety system.')
    parser.add_argument('--camera', type=int, default=0)
    parser.add_argument('--sound', action='store_true', help='Enable a sound for each prolonged closure')
    parser.add_argument('--check', action='store_true', help='Load the model and process a blank frame without opening a camera')
    args = parser.parse_args()
    try:
        import cv2
        import mediapipe as mp
    except ImportError:
        print('Install the dependencies first: python -m pip install -r requirements.txt', file=sys.stderr)
        return 2
    try:
        model = ensure_model()
    except Exception as error:
        print(f'Model could not be prepared: {error}', file=sys.stderr)
        return 2
    if args.check:
        import numpy as np
        options = mp.tasks.vision.FaceLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)))
        with mp.tasks.vision.FaceLandmarker.create_from_options(options) as model_check:
            result = model_check.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.zeros((256, 256, 3), dtype=np.uint8)))
        print(f'Model ready. Blank test frame: {len(result.face_landmarks)} faces. No camera was opened.')
        return 0
    tracker = ClosureTracker()
    camera = Camera(args.camera)
    if not camera.isOpened():
        camera.release()
        print('No camera is available. On Mac, allow Terminal to use the camera in System Settings, or try --camera 1.', file=sys.stderr)
        return 2
    sound = args.sound
    previous_alerts = 0
    last_timestamp = -1
    labels = {'open': 'Eyes open', 'closed': 'Eyes closed', 'prolonged': 'Prolonged eye closure', 'no-face': 'No clear face — move into view'}
    print('Q / Esc: stop   S: sound on/off. No video is recorded. Educational demo only.')
    try:
        options = mp.tasks.vision.FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),
            running_mode=mp.tasks.vision.RunningMode.VIDEO, num_faces=1,
        )
        with mp.tasks.vision.FaceLandmarker.create_from_options(options) as landmarker:
            while True:
                ok, frame = camera.read()
                if not ok or frame is None:
                    print('Camera stopped providing frames. Close other camera apps and try again.', file=sys.stderr)
                    return 2
                height, width = frame.shape[:2]
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                timestamp = max(last_timestamp + 1, int(time.monotonic() * 1000))
                last_timestamp = timestamp
                result = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), timestamp)
                face = result.face_landmarks[0] if result.face_landmarks else None
                left = eye_ratio(face, LEFT_EYE, width, height) if face else None
                right = eye_ratio(face, RIGHT_EYE, width, height) if face else None
                observation = tracker.update(left, right, timestamp / 1000)
                color = (105, 173, 126) if observation.status == 'open' else (70, 170, 220)
                if observation.status == 'prolonged':
                    color = (90, 90, 225)
                if face:
                    for index in LEFT_EYE + RIGHT_EYE:
                        point = face[index]
                        cv2.circle(frame, (int(point.x * width), int(point.y * height)), 2, color, -1)
                frame = cv2.flip(frame, 1)
                cv2.rectangle(frame, (0, 0), (width, 125), (36, 30, 24), -1)
                texts = [labels[observation.status], f'Closure: {observation.closed_seconds:.1f}s / 1.5s',
                         f'Blinks: {observation.blinks}   Closures: {observation.alerts}   Sound: {"on" if sound else "off"}', 'Q: stop  |  S: sound  |  No recording']
                for i, text in enumerate(texts):
                    cv2.putText(frame, text, (16, 27 + i * 27), cv2.FONT_HERSHEY_SIMPLEX, 0.57, color if i == 0 else (235, 230, 220), 1, cv2.LINE_AA)
                if observation.alerts > previous_alerts and sound:
                    beep()
                previous_alerts = observation.alerts
                cv2.imshow('Drowsiness Detector — educational demo', frame)
                key = cv2.waitKey(1) & 0xff
                if key in (ord('q'), 27) or cv2.getWindowProperty('Drowsiness Detector — educational demo', cv2.WND_PROP_VISIBLE) < 1:
                    break
                if key == ord('s'):
                    sound = not sound
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        print(f'Demo stopped: {error}', file=sys.stderr)
        return 2
    finally:
        camera.release()
        cv2.destroyAllWindows()


if __name__ == '__main__':
    sys.exit(main())
