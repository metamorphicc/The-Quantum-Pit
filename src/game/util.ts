export function clamp(v: number, min = 0, max = 100): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function chance(p: number): boolean {
  return Math.random() < p
}

/** Deterministic-ish pseudo noise for sprite/room detail (no allocation). */
export function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

/** "3h 12m" / "12m" / "40s" - used for the welcome-back line and cooldowns. */
export function formatAway(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  if (h < 24) return rm ? `${h}h ${rm}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}d ${rh}h` : `${d}d`
}

export function formatSeconds(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`
}
export function formatCash(v: number): string {
  const n = Math.round(v)
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US')}`
}

/** Always carries its sign - for PnL lines, where the sign is the whole story. */
export function formatSigned(v: number): string {
  const n = Math.round(v)
  return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString('en-US')}`
}

/** A share price, in cents, the way a prediction market quotes it. */
export function formatPrice(p: number): string {
  return `${Math.round(p * 100)}c`
}

export function formatProb(p: number): string {
  return `${Math.round(p * 100)}%`
}
