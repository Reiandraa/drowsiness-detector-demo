// Adapted from P SREESANKAR's MIT-licensed MediaPipe/EAR example. See SOURCES.md.
export const LEFT_EYE = [362, 385, 387, 263, 373, 380];
export const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
export function eyeRatio(landmarks, indices, width, height) {
  if (!(width > 0 && height > 0)) return null;
  const points = indices.map(i => landmarks?.[i]).map(p => p && [p.x * width, p.y * height]);
  if (points.some(p => !p || p.some(v => !Number.isFinite(v)))) return null;
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const horizontal = distance(points[0], points[3]);
  if (horizontal < 1) return null;
  const value = (distance(points[1], points[5]) + distance(points[2], points[4])) / (2 * horizontal);
  return value >= 0 && value <= 1 ? value : null;
}
export class ClosureTracker {
  constructor({ threshold = 0.23, alertAfter = 1.5, maxGap = 0.35 } = {}) {
    if (!(threshold > 0 && threshold < 1 && alertAfter > 0 && maxGap > 0)) throw new Error('Invalid tracker settings');
    Object.assign(this, { threshold, alertAfter, maxGap });
    this.reset();
  }
  reset() { this.lastTime = this.closedAt = null; this.alerted = false; this.alerts = this.blinks = 0; }
  update(left, right, now) {
    if (!Number.isFinite(now)) throw new Error('Timestamp must be finite');
    if (this.lastTime !== null && (now < this.lastTime || now - this.lastTime > this.maxGap)) {
      this.closedAt = null; this.alerted = false;
    }
    this.lastTime = now;
    const snapshot = (status, seconds = 0, ear = null) => ({ status, closedSeconds: seconds, ear, alerts: this.alerts, blinks: this.blinks });
    if (![left, right].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) {
      this.closedAt = null; this.alerted = false;
      return snapshot('no-face');
    }
    const ear = (left + right) / 2;
    if (left < this.threshold && right < this.threshold) {
      this.closedAt ??= now;
      const seconds = now - this.closedAt;
      if (seconds >= this.alertAfter) { if (!this.alerted) this.alerts++; this.alerted = true; }
      return snapshot(this.alerted ? 'prolonged' : 'closed', seconds, ear);
    }
    if (this.closedAt !== null && now - this.closedAt >= 0.08 && now - this.closedAt <= 0.7 && !this.alerted) this.blinks++;
    this.closedAt = null; this.alerted = false;
    return snapshot('open', 0, ear);
  }
}
export function guidedSample(seconds) {
  // Synthetic measurements, never presented as camera or model inference.
  if (seconds < 1.8) return [0.31, 0.30, 'Eyes open'];
  if (seconds < 2.0) return [0.10, 0.11, 'A normal blink'];
  if (seconds < 3.0) return [0.31, 0.30, 'A blink does not trigger a prolonged-closure alert'];
  if (seconds < 5.4) return [0.09, 0.10, 'Now the eyes stay closed'];
  if (seconds < 6.7) return [0.31, 0.30, 'Eyes reopen and the timer resets'];
  if (seconds < 8.0) return [null, null, 'Lost tracking resets evidence; it does not mean asleep'];
  return [0.31, 0.30, 'Sample complete. Try your camera when you are ready.'];
}
