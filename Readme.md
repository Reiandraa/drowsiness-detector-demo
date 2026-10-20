# Drowsiness Detector — portfolio demo

A refined, cross-platform educational adaptation of [P SREESANKAR's MIT MediaPipe example](https://github.com/p-sreesankar/drowsiness-detection). This new demo is separate from the original ISPO 2023 Android application. See [SOURCES.md](SOURCES.md) for attribution and changes.

## Try in a browser

https://reiandraa.com/projects/drowsiness-detector/demo/

Choose **Try without a camera** for a clearly labelled synthetic walkthrough. Choose **Start camera** on a Mac, PC or phone with a camera. Frames are processed on that device; they are not recorded or uploaded. Model downloads require an internet connection. **Stop**, leaving the page, or hiding the tab releases the camera.

This is a fixed-threshold eye-closure demonstration, not a clinical fatigue measurement or a driving safety system. Use while stationary. Lighting, eye shape, head angle, glasses, and hardware can affect it. A long closure is an observed signal, not proof that someone is asleep.

## Run Python on your Mac

Requires an Apple Silicon Mac with Python 3.10 or newer and a camera. From the downloaded/cloned project folder:

```sh
bash run-mac.sh
```

The first run creates a local `.venv`, installs the pinned packages, and downloads Google's verified model (about 4 MB). It uses no paid API. Allow Terminal to use the camera if macOS asks. Press **Q** or **Esc** to close the preview. Press **S** to toggle sound. No video file is written.

For other platforms, or to install manually:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python main.py
```

Windows: activate with `.venv\Scripts\Activate.ps1` instead. Sound starts off; `python main.py --sound` enables it. Try `--camera 1` if the default camera is unavailable.

Check the real model without opening any camera:

```sh
python main.py --check
```

## Development and tests

Python decision logic (standard library only): `python -m unittest -v test_detector.py`.

For the browser source, use Node 22.12+ / 24 and npm:

```sh
npm ci
npm test
npm run build
npm run preview
```

Use the production build for the browser worker: MediaPipe's WASM loader needs a classic worker, which Vite bundles from the module source. The deployed site integrates the same demo under its project route. The root page's back link is intended for reiandraa.com.

## Validation status

The Python model and browser model are checked with a blank frame without opening a camera. Automated tests cover timing, missing faces, frame gaps, geometry, permission denial, late permission results, Stop, and resource cleanup. A live Mac camera trial is still required before claiming Mac camera validation.

## License

MIT. Original copyright P SREESANKAR retained. Refinements by Reiandraa, 2026. MediaPipe, OpenCV and their model/dependencies retain their own terms and licenses; see SOURCES.md.
