/**
 * Tiny pub/sub used to fire visual effects from anywhere (action handlers,
 * screens) into whichever renderer is mounted. Keeps the game logic free of
 * React refs and canvas details.
 */

/**
 * Particle kinds are named after the art, not the verb, because the art has not
 * changed: the same brown flecks that used to be crumbs are now torn notes.
 */
export type ParticleKind =
  | 'spark' // blue sparks (checking the book, edge)
  | 'ember' // orange embers (fire, heat, a bad fill)
  | 'dust' // grey motes (idle room)
  | 'suds' // teal bubbles (hedging)
  | 'crumb' // brown bits (torn notes, research)
  | 'zzz' // sleep marks (recovering)
  | 'straw' // pale flecks (a resolved ticket)
  | 'coin' // gold flecks (a payout)

export type FloatTone = 'good' | 'bad' | 'cash' | 'credit' | 'plain'

export type FxEvent =
  | {
      type: 'burst'
      kind: ParticleKind
      /** logical scene coords; omitted = at the character's chest */
      x?: number
      y?: number
      count?: number
      power?: number
    }
  | {
      type: 'float'
      text: string
      tone?: FloatTone
      /** 0..1 of the scene box; omitted = above the character */
      nx?: number
      ny?: number
    }
  | { type: 'shake'; power?: number }

type Handler = (e: FxEvent) => void

const handlers = new Set<Handler>()

export function onFx(handler: Handler): () => void {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function emitFx(event: FxEvent): void {
  for (const h of handlers) h(event)
}

export function burst(
  kind: ParticleKind,
  opts: { x?: number; y?: number; count?: number; power?: number } = {},
): void {
  emitFx({ type: 'burst', kind, ...opts })
}

export function floatText(text: string, tone: FloatTone = 'plain'): void {
  emitFx({ type: 'float', text, tone })
}
export type ToastTone = 'good' | 'bad' | 'plain'

export interface ToastEvent {
  id: number
  text: string
  tone: ToastTone
  /** optional second line: the money, usually */
  sub?: string
}

type ToastHandler = (t: ToastEvent) => void

const toastHandlers = new Set<ToastHandler>()
let toastId = 1

export function onToast(handler: ToastHandler): () => void {
  toastHandlers.add(handler)
  return () => toastHandlers.delete(handler)
}

export function toast(text: string, tone: ToastTone = 'plain', sub?: string): void {
  const event: ToastEvent = { id: toastId++, text, tone, sub }
  for (const h of toastHandlers) h(event)
}
export interface AchievementToastEvent {
  id: number
  name: string
  desc: string
}

type AchievementToastHandler = (t: AchievementToastEvent) => void

const achievementToastHandlers = new Set<AchievementToastHandler>()
let achievementToastId = 1

export function onAchievementToast(handler: AchievementToastHandler): () => void {
  achievementToastHandlers.add(handler)
  return () => achievementToastHandlers.delete(handler)
}

export function achievementToast(name: string, desc: string): void {
  const event: AchievementToastEvent = { id: achievementToastId++, name, desc }
  for (const h of achievementToastHandlers) h(event)
}
