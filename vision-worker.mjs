import { LEFT_EYE, RIGHT_EYE, eyeRatio } from './core.mjs';
const VERSION = '1.1.1';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MODEL_HASH = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';
let detector;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      self.postMessage({ type: 'loading', message: 'Loading the vision engine…' });
      const moduleURL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`;
      const { FaceLandmarker, FilesetResolver } = await import(/* @vite-ignore */ moduleURL);
      const vision = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`);
      self.postMessage({ type: 'loading', message: 'Downloading the face model (about 4 MB)…' });
      const response = await fetch(MODEL_URL, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error('Model download failed');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== MODEL_HASH) throw new Error('Model integrity check failed');
      detector = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: bytes, delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 1,
        minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        if (!detector) throw new Error('Vision model is not ready');
        const result = detector.detectForVideo(data.bitmap, data.timestamp);
        const face = result.faceLandmarks[0];
        const points = face ? [...LEFT_EYE, ...RIGHT_EYE].map(i => ({ x: face[i].x, y: face[i].y })) : [];
        self.postMessage({ type: 'result', timestamp: data.timestamp,
          left: face ? eyeRatio(face, LEFT_EYE, data.bitmap.width, data.bitmap.height) : null,
          right: face ? eyeRatio(face, RIGHT_EYE, data.bitmap.width, data.bitmap.height) : null, points });
      } finally { data.bitmap?.close(); }
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || 'Vision processing failed' });
  }
};
