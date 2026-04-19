// ─── Sound Design ──────────────────────────────────────────────
// all sounds are synthesized via Web Audio API. no files needed.
// every function is fire-and-forget and safe to call in event handlers.
//
// call initAudio() once on any user interaction to unlock AudioContext.

const AudioCtx = window.AudioContext || window.webkitAudioContext
let ctx = null

function getCtx() {
  if (!ctx) {
    try { ctx = new AudioCtx() } catch { return null }
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/** call on first user gesture (click/tap) to unlock audio on iOS/Safari */
export function initAudio() {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume()
}

// ─── helpers ────────────────────────────────────────────────────

function osc(type, freq, gainVal, start, duration, fadeOut = 0.05) {
  const c = getCtx()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, c.currentTime + start)
  g.gain.setValueAtTime(gainVal, c.currentTime + start)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + start)
  o.stop(c.currentTime + start + duration + fadeOut)
}

function noise(duration, gainVal, start = 0) {
  const c = getCtx()
  if (!c) return
  const bufferSize = c.sampleRate * duration
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const g = c.createGain()
  g.gain.setValueAtTime(gainVal, c.currentTime + start)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration)
  src.connect(g).connect(c.destination)
  src.start(c.currentTime + start)
}

// ─── UI Sounds ──────────────────────────────────────────────────

/** soft click — filter pills, small interactions */
export function playClick() {
  osc('sine', 800, 0.08, 0, 0.06)
  osc('sine', 1200, 0.04, 0.01, 0.04)
}

/** pop — FAB buttons, opening things */
export function playPop() {
  const c = getCtx()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(400, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.05)
  o.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.1)
  g.gain.setValueAtTime(0.12, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12)
  o.connect(g).connect(c.destination)
  o.start()
  o.stop(c.currentTime + 0.15)
}

/** whoosh — modals opening */
export function playWhoosh() {
  noise(0.15, 0.06)
  osc('sine', 300, 0.04, 0, 0.08)
  osc('sine', 500, 0.03, 0.03, 0.1)
}

/** success chime — login, ticket creation */
export function playSuccess() {
  osc('sine', 523, 0.1, 0, 0.15)       // C5
  osc('sine', 659, 0.1, 0.1, 0.15)     // E5
  osc('sine', 784, 0.12, 0.2, 0.25)    // G5
  osc('triangle', 1047, 0.06, 0.3, 0.3) // C6 (octave shimmer)
}

/** error buzz — validation failures */
export function playError() {
  osc('square', 200, 0.06, 0, 0.08)
  osc('square', 180, 0.06, 0.1, 0.08)
  noise(0.06, 0.03, 0)
}

/** claim sound — grabbing a ticket */
export function playClaim() {
  osc('sine', 440, 0.08, 0, 0.1)        // A4
  osc('sine', 554, 0.08, 0.08, 0.1)     // C#5
  osc('sine', 659, 0.1, 0.16, 0.15)     // E5
  noise(0.04, 0.03, 0.16)                // crisp snap
}

/** close/delete — somber two-note */
export function playClose() {
  osc('sine', 440, 0.07, 0, 0.12)
  osc('sine', 330, 0.07, 0.1, 0.2)
}

// ─── Welcome Reveal sounds ─────────────────────────────────────

/** phase intro — mysterious shimmer */
export function playRevealIntro() {
  osc('sine', 220, 0.04, 0, 0.4)
  osc('sine', 330, 0.03, 0.1, 0.3)
  osc('triangle', 440, 0.02, 0.2, 0.25)
}

/** ceremony text — rising tension */
export function playRevealCeremony() {
  osc('sine', 330, 0.05, 0, 0.2)
  osc('sine', 392, 0.05, 0.15, 0.2)
  osc('sine', 440, 0.06, 0.3, 0.2)
  osc('triangle', 523, 0.04, 0.45, 0.3)
  // subtle tremolo
  osc('sine', 220, 0.02, 0, 0.6)
}

/** the big name slam */
export function playRevealSlam() {
  const c = getCtx()
  if (!c) return

  // deep impact
  const boom = c.createOscillator()
  const boomGain = c.createGain()
  boom.type = 'sine'
  boom.frequency.setValueAtTime(80, c.currentTime)
  boom.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.3)
  boomGain.gain.setValueAtTime(0.2, c.currentTime)
  boomGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4)
  boom.connect(boomGain).connect(c.destination)
  boom.start()
  boom.stop(c.currentTime + 0.5)

  // crack/snap noise
  noise(0.08, 0.12)

  // rising chime after impact
  osc('sine', 523, 0.08, 0.1, 0.15)
  osc('sine', 659, 0.08, 0.18, 0.15)
  osc('sine', 784, 0.1, 0.26, 0.2)
  osc('triangle', 1047, 0.06, 0.35, 0.3)
}

/** quip pop — comedic punctuation */
export function playRevealQuip() {
  osc('sine', 600, 0.06, 0, 0.05)
  osc('sine', 900, 0.05, 0.04, 0.06)
  osc('sine', 700, 0.04, 0.09, 0.08)
}

/** warning notice — ominous two-note */
export function playRevealWarning() {
  osc('triangle', 200, 0.06, 0, 0.15)
  osc('triangle', 160, 0.06, 0.12, 0.2)
  noise(0.03, 0.02, 0.12)
}

/** final button ready — bright inviting ding */
export function playRevealReady() {
  osc('sine', 784, 0.08, 0, 0.1)     // G5
  osc('sine', 1047, 0.1, 0.08, 0.2)  // C6
  osc('triangle', 1319, 0.05, 0.15, 0.25) // E6
}
