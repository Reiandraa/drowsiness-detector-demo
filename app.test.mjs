import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mountDemo } from './app.mjs';
const require = createRequire(process.env.DROWSINESS_TEST_PACKAGE || import.meta.url);
const { JSDOM } = require('jsdom');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup(media = () => Promise.reject(new Error('Unexpected camera request'))) {
  const dom = new JSDOM(readFileSync(new URL('./index.html', import.meta.url), 'utf8'), { url: 'https://example.com/demo/' });
  const win = dom.window, doc = win.document, workers = [], tasks = new Map();
  let nextTask = 0, clock = 0, requests = 0;
  Object.defineProperty(win, 'isSecureContext', { value: true });
  Object.defineProperty(win.navigator, 'mediaDevices', { value: { getUserMedia: options => { requests++; assert.equal(options.audio, false); return media(); } } });
  win.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {} });
  win.HTMLMediaElement.prototype.pause = () => {};
  win.HTMLMediaElement.prototype.play = async () => {};
  Object.defineProperty(doc.getElementById('camera'), 'videoWidth', { value: 640 });
  Object.defineProperty(doc.getElementById('camera'), 'videoHeight', { value: 480 });
  win.setTimeout = (fn, delay) => { tasks.set(++nextTask, { fn, delay }); return nextTask; };
  win.clearTimeout = id => tasks.delete(id);
  const makeWorker = () => { const worker = { messages: [], terminated: false, postMessage(m) { this.messages.push(m); }, terminate() { this.terminated = true; }, emit(data) { this.onmessage?.({ data }); } }; workers.push(worker); return worker; };
  const app = mountDemo(doc, win, { makeWorker, now: () => clock, createImageBitmap: async () => ({ close() {} }) });
  return { dom, doc, win, workers, tasks, app, requests: () => requests,
    click: id => doc.getElementById(id).click(),
    advance(ms) { clock += ms; const ready = [...tasks].filter(([,t]) => t.delay < 1000); for (const [id,t] of ready) { tasks.delete(id); t.fn(); } },
    close() { app.stop(); dom.window.close(); } };
}
test('initial view and guided sample do not request camera or download a model', () => {
  const s = setup(); try {
    assert.equal(s.requests(), 0); assert.equal(s.workers.length, 0);
    s.click('sample'); for (let i = 0; i < 110; i++) s.advance(80);
    assert.equal(s.requests(), 0); assert.equal(s.workers.length, 0);
    assert.equal(s.doc.getElementById('sample-label').hidden, false);
    assert.equal(s.doc.getElementById('alerts').textContent, '1');
    assert.equal(s.doc.getElementById('blinks').textContent, '1');
    s.click('sample'); assert.equal(s.doc.getElementById('alerts').textContent, '0');
  } finally { s.close(); }
});
test('Stop during model loading terminates the worker and ignores late readiness', async () => {
  const s = setup(); try {
    s.click('start'); const worker = s.workers[0]; s.click('stop'); worker.emit({ type: 'ready' }); await flush();
    assert.equal(worker.terminated, true); assert.equal(s.requests(), 0);
    assert.equal(s.doc.getElementById('start').disabled, false);
  } finally { s.close(); }
});
test('a camera permission result arriving after Stop is immediately released', async () => {
  let resolve; let stopped = 0;
  const s = setup(() => new Promise(r => { resolve = r; })); try {
    s.click('start'); s.workers[0].emit({ type: 'ready' }); await flush(); assert.equal(s.requests(), 1);
    s.click('stop'); resolve({ getTracks: () => [{ stop() { stopped++; } }] }); await flush();
    assert.equal(stopped, 1); assert.equal(s.doc.getElementById('camera').srcObject, null);
  } finally { s.close(); }
});
test('camera denial is recoverable and leaves no running worker', async () => {
  const s = setup(() => Promise.reject(new DOMException('Denied', 'NotAllowedError'))); try {
    s.click('start'); s.workers[0].emit({ type: 'ready' }); await flush();
    assert.match(s.doc.getElementById('status-detail').textContent, /permission is blocked/);
    assert.equal(s.workers[0].terminated, true); assert.equal(s.doc.getElementById('sample').disabled, false);
  } finally { s.close(); }
});
test('model-only check processes a blank frame and never requests a camera', async () => {
  const s = setup(); try {
    s.click('check'); const worker = s.workers[0]; worker.emit({ type: 'ready' }); await flush();
    assert.equal(worker.messages.at(-1).type, 'frame'); assert.equal(s.requests(), 0);
    worker.emit({ type: 'result', left: null, right: null, points: [], timestamp: 1 });
    assert.match(s.doc.getElementById('check-result').textContent, /successfully/);
    assert.equal(worker.terminated, true);
  } finally { s.close(); }
});
test('leaving the page releases an active stream', async () => {
  let stopped = 0;
  const stream = { getTracks: () => [{ stop() { stopped++; } }], getVideoTracks: () => [{ addEventListener() {} }] };
  const s = setup(async () => stream); try {
    s.click('start'); s.workers[0].emit({ type: 'ready' }); await flush();
    s.win.dispatchEvent(new s.win.PageTransitionEvent('pagehide'));
    assert.equal(stopped, 1); assert.equal(s.workers[0].terminated, true);
    assert.equal(s.doc.getElementById('camera').srcObject, null);
  } finally { s.close(); }
});
