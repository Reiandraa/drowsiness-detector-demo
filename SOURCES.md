# Sources and changes

This is a new educational portfolio demo, separate from Rassya Rayandra and Abdul Rozak's 2023 Android project. The old Android source was not recovered.

## Adapted code

- P SREESANKAR: https://github.com/p-sreesankar/drowsiness-detection
- Inspected revision: `eecfb4d041585506a29917ad6bf337f7f9485b1b`.
- MIT license, retained in `LICENSE`. The eye landmark selection, pixel-space EAR approach, and MediaPipe task setup are adapted and reworked here. The upstream webcam example is not presented as independently validated driving-safety software.

Refinements: project-relative verified model download; Mac-compatible launcher and optional sound; no recording; fresh synchronized observations in Python; a browser worker; bilateral eye closure; elapsed-time decisions rather than frame counts; explicit no-face state; stale-frame reset; permission/cancellation cleanup; camera-free guided sample; tests.

## Additional technical reference

- LearnOpenCV's published explanation and demonstration: https://github.com/spmallick/learnopencv/tree/master/Driver-Drowsiness-detection-using-Mediapipe-in-Python
- Official task guides: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js and https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/python

LearnOpenCV is a method/reference link; its application code, images and sound files are not redistributed here.

## Runtime dependencies and model

- MediaPipe (Apache 2.0): https://github.com/google-ai-edge/mediapipe
- Browser: `@mediapipe/tasks-vision` 1.1.1, loaded from jsDelivr. Python: `mediapipe` 1.1.1 and `opencv-contrib-python` 4.13.0.92.
- Model: Google's Face Landmarker float16 bundle, version 1, downloaded at runtime. https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.
- Official model overview/cards: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/index#models

Model files are not included in this source distribution. Camera frames remain in memory on the device, with no recording or upload endpoints. Network requests retrieve static libraries, fonts, and models only.
