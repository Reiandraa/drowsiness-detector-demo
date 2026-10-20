"""Download the official MediaPipe model, with integrity verification."""
import hashlib
import ssl
from pathlib import Path
from urllib.request import urlopen

MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
MODEL_SHA256 = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'
MODEL_PATH = Path(__file__).resolve().with_name('face_landmarker.task')


def ensure_model(path=MODEL_PATH):
    path = Path(path)
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == MODEL_SHA256:
        return path
    print('Downloading the official face landmark model (about 4 MB)…')
    try:
        import certifi
        tls = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        tls = ssl.create_default_context()
    with urlopen(MODEL_URL, timeout=45, context=tls) as response:
        data = response.read(10_000_001)
    if len(data) > 10_000_000 or hashlib.sha256(data).hexdigest() != MODEL_SHA256:
        raise RuntimeError('Model integrity check failed. No unverified model was saved.')
    temporary = path.with_suffix('.part')
    temporary.write_bytes(data)
    temporary.replace(path)
    return path


if __name__ == '__main__':
    print(ensure_model())
