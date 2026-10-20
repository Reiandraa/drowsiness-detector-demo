import { ClosureTracker, guidedSample } from './core.mjs';

export function mountDemo(doc, win, deps = {}) {
  const el = id => doc.getElementById(id);
  const video = el('camera'), overlay = el('overlay');
  const context = overlay.getContext('2d');
  const now = deps.now || (() => win.performance.now());
  const createBitmap = deps.createImageBitmap || (source => win.createImageBitmap(source));
  const makeWorker = deps.makeWorker || (() => new Worker(new URL('./vision-worker.mjs', import.meta.url)));
  let session = 0, stream, worker, cancelReady, timer, inFlight = false, active = false;
  let tracker = new ClosureTracker(), mode = 'off', audio, lastSound = 0;
  const titles = { open: 'Eyes open.', closed: 'Eyes closed.', prolonged: 'Prolonged eye closure.', 'no-face': 'No clear face.' };
  const details = { open: 'Your eyes are open. A short blink will pass without an alert.', closed: 'Measuring how long both eyes stay closed.', prolonged: 'Both eyes have stayed closed for at least 1.5 seconds.', 'no-face': 'Move into view and look straight ahead. No closure is inferred while tracking is lost.' };

  function announce(title, detail, status = 'ready') {
    if (el('status-title').textContent !== title) el('status-title').textContent = title;
    if (el('status-detail').textContent !== detail) el('status-detail').textContent = detail;
    doc.body.dataset.status = status;
  }
  function controls(busy) {
    active = busy; el('start').disabled = busy; el('sample').disabled = busy;
    el('stop').disabled = !busy; el('check').disabled = busy;
  }
  function release() {
    win.clearTimeout(timer); timer = null;
    cancelReady?.(); cancelReady = null;
    worker?.terminate(); worker = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.pause(); video.srcObject = null;
    video.hidden = overlay.hidden = true;
    el('placeholder').hidden = false; inFlight = false;
    context.clearRect(0, 0, overlay.width, overlay.height);
  }
  function resetMetrics() {
    tracker = new ClosureTracker();
    render({ status: 'no-face', ear: null, closedSeconds: 0, blinks: 0, alerts: 0 }, false);
  }
  function stop(note = 'Camera and processing are stopped.') {
    session++; release(); controls(false); mode = 'off'; resetMetrics();
    el('mode-label').textContent = 'Camera off'; el('sample-label').hidden = true;
    el('placeholder-text').textContent = 'Your camera starts only when you choose.';
    el('sample-face').style.opacity = '1';
    announce('Ready when you are.', note);
  }
  function begin(nextMode) {
    session++; release(); resetMetrics(); controls(true); mode = nextMode;
    el('sample-label').hidden = nextMode !== 'sample';
    return session;
  }
  function sound() {
    if (!el('sound').checked || !audio || now() - lastSound < 2000) return;
    lastSound = now();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.04, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    oscillator.start(); oscillator.stop(audio.currentTime + 0.26);
  }
  function render(observation, updateText = true) {
    el('duration').replaceChildren(doc.createTextNode(observation.closedSeconds.toFixed(1) + ' '));
    const suffix = doc.createElement('small'); suffix.textContent = '/ 1.5 s'; el('duration').append(suffix);
    el('ear').textContent = observation.ear === null ? '—' : observation.ear.toFixed(2);
    el('blinks').textContent = String(observation.blinks); el('alerts').textContent = String(observation.alerts);
    el('meter-fill').style.width = Math.min(100, observation.closedSeconds / 1.5 * 100) + '%';
    el('meter-fill').parentElement.setAttribute('aria-valuenow', String(Math.min(1.5, observation.closedSeconds)));
    if (updateText) announce(titles[observation.status], details[observation.status], observation.status);
    if (observation.status === 'prolonged') sound();
  }
  function displayEyes(points) {
    context.clearRect(0, 0, overlay.width, overlay.height);
    context.strokeStyle = '#d9c58d'; context.fillStyle = '#d9c58d'; context.lineWidth = 2;
    for (const point of points) {
      context.beginPath(); context.arc(point.x * overlay.width, point.y * overlay.height, 3, 0, 2 * Math.PI); context.fill();
    }
  }
  function failure(error, token) {
    if (token !== session) return;
    stop();
    const messages = {
      NotAllowedError: 'Camera permission is blocked. Allow it in your browser settings, or try the camera-free sample.',
      NotFoundError: 'No camera was found. Open this demo on a computer with a camera, or try the guided sample.',
      NotReadableError: 'Your camera is busy or unavailable. Close other camera apps, then try again.',
      SecurityError: 'Open the demo over HTTPS or localhost to use a camera.',
    };
    announce('Could not start.', messages[error?.name] || 'The vision engine could not run. Check your connection and browser, then retry or use the guided sample.', 'error');
    el('check-result').textContent = error?.name === 'AbortError' ? 'The setup check was stopped.' : `Setup detail: ${String(error?.message || 'Unknown error').slice(0, 240)}. You can retry the model check.`;
  }
  function loadWorker(token, onResult) {
    worker = makeWorker(); const currentWorker = worker;
    return new Promise((resolve, reject) => {
      const deadline = win.setTimeout(() => reject(new Error('Model load timed out')), 60000);
      let ready = false;
      const settle = (error) => { win.clearTimeout(deadline); cancelReady = null; error ? reject(error) : resolve(); };
      cancelReady = () => settle(new win.DOMException('Cancelled', 'AbortError'));
      currentWorker.onerror = event => {
        const error = new Error(event.message || 'Vision engine could not load');
        if (!ready) settle(error); else failure(error, token);
      };
      currentWorker.onmessage = ({ data }) => {
        if (token !== session) return;
        if (data.type === 'loading') announce('Preparing the model…', data.message);
        if (data.type === 'ready') { ready = true; settle(); }
        if (data.type === 'error') {
          const error = new Error(data.message);
          if (!ready) settle(error); else failure(error, token);
        }
        if (data.type === 'result') { inFlight = false; onResult(data); }
      };
      currentWorker.postMessage({ type: 'init' });
    });
  }
  async function camera() {
    const token = begin('camera'); el('mode-label').textContent = 'Preparing camera';
    let lastResult = now();
    announce('Preparing the model…', 'Your camera is still off. The vision engine loads first.');
    try {
      if (!win.isSecureContext || !win.navigator.mediaDevices?.getUserMedia) throw new win.DOMException('Camera unavailable', 'SecurityError');
      await loadWorker(token, result => {
        lastResult = now();
        render(tracker.update(result.left, result.right, result.timestamp / 1000)); displayEyes(result.points);
      });
      if (token !== session) return;
      announce('Allow your camera.', 'Use the permission prompt in your browser. You can stop at any time.');
      const captured = await win.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (token !== session) { captured.getTracks().forEach(track => track.stop()); return; }
      stream = captured; video.srcObject = stream; await video.play();
      if (token !== session) return;
      if (!video.videoWidth || !video.videoHeight) throw new Error('No camera frames');
      overlay.width = video.videoWidth; overlay.height = video.videoHeight;
      el('placeholder').hidden = true; video.hidden = overlay.hidden = false;
      el('mode-label').textContent = 'Live camera'; announce('Looking for your face…', 'Look straight ahead in good lighting.');
      lastResult = now();
      let lastTime = -1, lastVideoTime = -1;
      const pump = async () => {
        if (token !== session) return;
        try {
          if (now() - lastResult > 5000) throw new Error('Camera or vision processing stalled');
          if (now() - lastResult > 600) {
            render(tracker.update(null, null, now() / 1000)); displayEyes([]);
            announce('Waiting for fresh frames…', 'No eye state is inferred from old camera frames.');
          }
          if (!inFlight && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const bitmap = await createBitmap(video);
            if (token !== session) { bitmap.close(); return; }
            const timestamp = Math.max(lastTime + 1, now()); lastTime = timestamp;
            inFlight = true; worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]);
          }
          timer = win.setTimeout(pump, 90);
        } catch (error) { failure(error, token); }
      };
      for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => { if (token === session) stop('The camera disconnected. You can reconnect it and try again.'); });
      pump();
    } catch (error) { failure(error, token); }
  }
  function sample() {
    const token = begin('sample'), started = now();
    el('mode-label').textContent = 'Guided sample'; el('sample').textContent = 'Replay sample';
    const tick = () => {
      if (token !== session) return;
      const elapsed = (now() - started) / 1000;
      const [left, right, caption] = guidedSample(elapsed);
      const result = tracker.update(left, right, now() / 1000); render(result);
      el('placeholder-text').textContent = caption;
      const closed = result.status === 'closed' || result.status === 'prolonged';
      el('left-eye').setAttribute('d', closed ? 'M151 133q18 8 36 0' : 'M151 133q18-16 36 0-18 16-36 0z');
      el('right-eye').setAttribute('d', closed ? 'M214 133q18 8 36 0' : 'M214 133q18-16 36 0-18 16-36 0z');
      el('sample-face').style.opacity = left === null ? '.25' : '1';
      if (elapsed >= 8.6) { controls(false); el('mode-label').textContent = 'Sample complete'; return; }
      timer = win.setTimeout(tick, 80);
    };
    tick();
  }
  async function check() {
    const token = begin('check'); el('mode-label').textContent = 'Checking model · camera off';
    el('check-result').textContent = 'Checking the model. No camera is requested.';
    try {
      await loadWorker(token, () => {
        if (token !== session) return;
        stop('The model is ready. Start your camera when you choose.');
        el('check-result').textContent = 'Vision model loaded and processed a test frame successfully. Your camera stayed off.';
      });
      if (token !== session) return;
      const blank = doc.createElement('canvas'); blank.width = blank.height = 64;
      blank.getContext('2d').fillRect(0, 0, 64, 64);
      const bitmap = await createBitmap(blank);
      if (token !== session) { bitmap.close(); return; }
      worker.postMessage({ type: 'frame', bitmap, timestamp: now() }, [bitmap]);
      timer = win.setTimeout(() => failure(new Error('Vision test frame timed out'), token), 15000);
    } catch (error) { failure(error, token); }
  }
  el('start').addEventListener('click', camera); el('sample').addEventListener('click', sample);
  el('stop').addEventListener('click', () => stop()); el('check').addEventListener('click', check);
  el('sound').addEventListener('change', () => {
    if (el('sound').checked) {
      try { audio ??= new (win.AudioContext || win.webkitAudioContext)(); audio.resume().catch(() => { el('sound').checked = false; }); }
      catch { el('sound').checked = false; }
    }
  });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden && active) stop('Paused because this tab was hidden. Start again when you are ready.'); });
  win.addEventListener('pagehide', () => stop());
  return { stop, getMode: () => mode };
}
if (typeof document !== 'undefined') mountDemo(document, window);
