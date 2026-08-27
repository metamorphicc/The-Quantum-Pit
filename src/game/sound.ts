import { getState } from './store'

/**
 * Synthesised chiptune-ish SFX. No audio assets, no network, ~2kB of code.
 * The AudioContext is created lazily on the first user gesture so mobile
 * WebViews (Telegram included) allow playback.
 */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (!getState().settings.sound) return null
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

/** Call from a real user gesture (the boot button) to unlock playback. */
export function unlockAudio(): void {
  const a = audio()
  if (a && a.state === 'suspended') void a.resume()
}

interface ToneOpts {
  freq: number
  dur: number
  type?: OscillatorType
  gain?: number
  /** target frequency for a linear sweep */
  to?: number
  delay?: number
}

function tone({ freq, dur, type = 'square', gain = 0.06, to, delay = 0 }: ToneOpts): void {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + delay
  const osc = a.createOscillator()
  const vol = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to !== undefined) osc.frequency.linearRampToValueAtTime(to, t0 + dur)
  vol.gain.setValueAtTime(0.0001, t0)
  vol.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.3))
  vol.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(vol).connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** Short filtered noise burst for scrubs, desk hits and static. */
function noise(dur: number, gain = 0.05, bandHz = 1200, delay = 0): void {
  const a = audio()
  if (!a) return
  const frames = Math.max(1, Math.floor(a.sampleRate * dur))
  const buf = a.createBuffer(1, frames, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }
  const src = a.createBufferSource()
  src.buffer = buf
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = bandHz
  const vol = a.createGain()
  vol.gain.value = gain
  src.connect(filter).connect(vol).connect(a.destination)
  src.start(a.currentTime + delay)
}

export const SFX = {
  click() {
    tone({ freq: 220, dur: 0.05, type: 'square', gain: 0.05 })
  },
  back() {
    tone({ freq: 180, dur: 0.06, to: 120, gain: 0.045 })
  },
  deny() {
    tone({ freq: 150, dur: 0.09, type: 'sawtooth', gain: 0.05 })
    tone({ freq: 105, dur: 0.12, type: 'sawtooth', gain: 0.045, delay: 0.08 })
  },
  /** blade flash when the warden is tapped */
  spark() {
    tone({ freq: 900, dur: 0.07, to: 1500, type: 'triangle', gain: 0.05 })
    tone({ freq: 1400, dur: 0.06, to: 2200, type: 'sine', gain: 0.03, delay: 0.03 })
  },
  grunt() {
    tone({ freq: 140, dur: 0.13, to: 96, type: 'sawtooth', gain: 0.055 })
  },
  eat() {
    tone({ freq: 260, dur: 0.06, to: 190, type: 'triangle', gain: 0.05 })
    tone({ freq: 240, dur: 0.06, to: 170, type: 'triangle', gain: 0.05, delay: 0.14 })
  },
  snore() {
    tone({ freq: 90, dur: 0.5, to: 66, type: 'sawtooth', gain: 0.04 })
    tone({ freq: 74, dur: 0.35, to: 100, type: 'sawtooth', gain: 0.03, delay: 0.6 })
  },
  splash() {
    noise(0.22, 0.05, 900)
    noise(0.16, 0.035, 2200, 0.16)
  },
  sword() {
    noise(0.09, 0.05, 3200)
    tone({ freq: 700, dur: 0.09, to: 380, type: 'square', gain: 0.04 })
  },
  hit() {
    noise(0.07, 0.06, 700)
    tone({ freq: 190, dur: 0.06, to: 120, type: 'square', gain: 0.045 })
  },
  coin() {
    tone({ freq: 990, dur: 0.06, type: 'square', gain: 0.045 })
    tone({ freq: 1320, dur: 0.1, type: 'square', gain: 0.04, delay: 0.055 })
  },
  shard() {
    tone({ freq: 780, dur: 0.08, type: 'sine', gain: 0.045 })
    tone({ freq: 1170, dur: 0.14, type: 'sine', gain: 0.04, delay: 0.07 })
    tone({ freq: 1560, dur: 0.16, type: 'sine', gain: 0.028, delay: 0.14 })
  },
  fanfare() {
    const notes = [392, 523, 659, 784]
    notes.forEach((f, i) =>
      tone({ freq: f, dur: 0.16, type: 'square', gain: 0.05, delay: i * 0.1 }),
    )
  },
  dice() {
    noise(0.05, 0.04, 2600)
    noise(0.05, 0.035, 2000, 0.08)
    noise(0.06, 0.03, 1500, 0.15)
  },
}

export type SfxName = keyof typeof SFX

export function play(name: SfxName): void {
  try {
    SFX[name]()
  } catch {
    /* audio is a nice-to-have, never a crash */
  }
}
