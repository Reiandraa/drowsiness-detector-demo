import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClosureTracker, eyeRatio, guidedSample } from './core.mjs';

test('a brief blink is counted without a prolonged-closure alert', () => {
  const t = new ClosureTracker(); t.update(.3, .3, 0); t.update(.1, .1, .1);
  assert.equal(t.update(.3, .3, .3).blinks, 1); assert.equal(t.alerts, 0);
});
test('closure timing is consistent at different frame rates and counted once', () => {
  for (const step of [.05, .1, .25]) {
    const t = new ClosureTracker(); let state;
    for (let i = 0; i <= Math.round(2 / step); i++) state = t.update(.1, .1, i * step);
    assert.equal(state.status, 'prolonged'); assert.equal(state.alerts, 1); assert.equal(state.closedSeconds, 2);
  }
});
test('face loss, frame gaps and timestamp rewind invalidate previous closure evidence', () => {
  const t = new ClosureTracker();
  for (let i = 0; i < 14; i++) t.update(.1, .1, i / 10);
  assert.equal(t.update(null, null, 1.4).status, 'no-face');
  assert.equal(t.update(.1, .1, 1.5).closedSeconds, 0);
  assert.equal(t.update(.1, .1, 10).closedSeconds, 0);
  assert.equal(t.update(.1, .1, 2).closedSeconds, 0);
  assert.equal(t.alerts, 0);
});
test('one closed eye, invalid geometry and absent landmarks do not produce an alert', () => {
  const t = new ClosureTracker(); let state;
  for (let i = 0; i < 30; i++) state = t.update(.1, .3, i / 10);
  assert.equal(state.status, 'open'); assert.equal(t.update(NaN, .1, 3).status, 'no-face');
  assert.equal(eyeRatio([], [0, 1, 2, 3, 4, 5], 640, 480), null);
  assert.equal(eyeRatio(Array(6).fill({ x: .1, y: .1 }), [0, 1, 2, 3, 4, 5], 640, 480), null);
});
test('EAR respects image aspect ratio and uniform resizing', () => {
  const points = [[0,0], [25,-10], [75,-10], [100,0], [75,10], [25,10]].map(([x,y]) => ({ x: x / 640, y: y / 480 }));
  assert.equal(eyeRatio(points, [0,1,2,3,4,5], 640, 480), .2);
  assert.equal(eyeRatio(points, [0,1,2,3,4,5], 1280, 960), .2);
});
test('the clearly labelled guided sample exercises one blink, one alert, and tracking loss', () => {
  const t = new ClosureTracker(); let sawLost = false;
  for (let i = 0; i <= 86; i++) {
    const [left, right] = guidedSample(i / 10); const state = t.update(left, right, i / 10);
    sawLost ||= state.status === 'no-face';
  }
  assert.equal(t.blinks, 1); assert.equal(t.alerts, 1); assert.equal(sawLost, true);
});
