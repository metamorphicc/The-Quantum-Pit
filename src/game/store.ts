import { useSyncExternalStore } from 'react'
import { STATS, STAT_ORDER } from './config'
import { loadSave, scheduleSave } from './persistence'
import type { GameState, SaveData, Stats } from './types'
import { clamp } from './util'
function createInitialState(): GameState {
  const now = Date.now()
  const { save, awayMs } = loadSave(now)
  return {
    ...save,
    screen: 'boot',
    questOpen: false,
    activity: { kind: 'idle', startedAt: now, duration: 0 },
    cooldowns: {},
    awayMs,
    line: '',
    lineId: 0,
    focusMarket: null,
    lastTrade: null,
    tapWindow: { since: now, gained: 0 },
  }
}

let state: GameState = createInitialState()
const listeners = new Set<() => void>()

export function getState(): GameState {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function saveSlice(): SaveData {
  return {
    version: state.version,
    name: state.name,
    loginMethod: state.loginMethod,
    walletAddress: state.walletAddress,
    walletChainId: state.walletChainId,
    walletConnectedAt: state.walletConnectedAt,
    onboarded: state.onboarded,
    traderClass: state.traderClass,
    achievements: state.achievements,
    stats: state.stats,
    bankroll: state.bankroll,
    xp: state.xp,
    peakBankroll: state.peakBankroll,
    credits: state.credits,
    stash: state.stash,
    owned: state.owned,
    look: state.look,
    ownedCosmetics: state.ownedCosmetics,
    activeCosmetics: state.activeCosmetics,
    tasks: state.tasks,
    dailyLogin: state.dailyLogin,
    social: state.social,
    markets: state.markets,
    marketsAt: state.marketsAt,
    hedgeUntil: state.hedgeUntil,
    lastVisit: state.lastVisit,
    firstVisit: state.firstVisit,
    visits: state.visits,
    tally: state.tally,
    settings: state.settings,
  }
}

export function setState(
  patch: Partial<GameState> | ((s: GameState) => Partial<GameState>),
): void {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  // The high-water mark is bookkeeping, not gameplay: keep it correct here
  // rather than in every caller that can move money.
  if (state.bankroll > state.peakBankroll) state.peakBankroll = state.bankroll
  for (const l of listeners) l()
  scheduleSave(saveSlice)
}

/** Replaces the whole state (used by "wipe the account"). */
export function resetState(): void {
  state = { ...createInitialState(), screen: 'boot' }
  for (const l of listeners) l()
  scheduleSave(saveSlice)
}

/**
 * Swaps in a save that came from somewhere else - currently Telegram's
 * CloudStorage, i.e. this account's progress on another device. Only the
 * persisted half is replaced; the current screen and animation state stay.
 */
export function adoptSave(save: SaveData, awayMs: number): void {
  state = { ...state, ...save, awayMs }
  for (const l of listeners) l()
  scheduleSave(saveSlice)
}

export function getSaveSlice(): SaveData {
  return saveSlice()
}
export function useGameState(): GameState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/**
 * Selector hook. The whole state object is a stable snapshot between writes,
 * so the selector can safely build derived values without tearing.
 */
export function useGame<T>(selector: (s: GameState) => T): T {
  return selector(useSyncExternalStore(subscribe, getState, getState))
}
export function addStats(delta: Partial<Stats>): Stats {
  const stats = { ...state.stats }
  for (const key of STAT_ORDER) {
    const d = delta[key]
    if (typeof d === 'number') stats[key] = clamp(stats[key] + d)
  }
  return stats
}

/**
 * One number for "how is he doing". Heat is inverted - a cold book is a healthy
 * book - so it is folded in as its complement.
 */
export function overallForm(stats: Stats): number {
  let sum = 0
  const formKeys = STAT_ORDER.filter((key) => key !== 'rep')
  for (const key of formKeys) {
    sum += STATS[key].inverted ? 100 - stats[key] : stats[key]
  }
  return sum / formKeys.length
}

/**
 * Bankroll as a 0..100 gauge, so the HUD can keep five bars without pretending
 * money is a percentage. 100 means "at the high-water mark"; it falls with the
 * drawdown off that peak.
 */
export function bankrollHealth(bankroll: number, peak: number): number {
  if (peak <= 0) return 0
  return clamp((bankroll / peak) * 100)
}
let lastTick = Date.now()

/**
 * Applies real-time drift. Safe to call at any cadence - drift is derived from
 * wall-clock delta, so a backgrounded WebView catches up on the next tick.
 * Drift pauses while he is recovering (that is the point of recovering).
 */
export function tick(now = Date.now()): void {
  const dt = now - lastTick
  lastTick = now
  if (dt <= 0) return

  const resting =
    state.activity.kind === 'recover' &&
    now < state.activity.startedAt + state.activity.duration

  const hours = dt / 3_600_000
  const stats = { ...state.stats }
  let changed = false

  if (!resting) {
    for (const key of STAT_ORDER) {
      const next = clamp(stats[key] - STATS[key].driftPerHour * hours)
      if (next !== stats[key]) {
        stats[key] = next
        changed = true
      }
    }
  }

  // expire the finished activity so the sprite returns to idle
  const activityDone =
    state.activity.kind !== 'idle' &&
    now >= state.activity.startedAt + state.activity.duration

  // reset the anti-spam PnL-checking window
  const tapWindowDone = now - state.tapWindow.since > 60_000

  if (!changed && !activityDone && !tapWindowDone) {
    // still publish once a second so cooldown timers in the UI count down
    for (const l of listeners) l()
    return
  }

  setState({
    stats: changed ? stats : state.stats,
    activity: activityDone
      ? { kind: 'idle', startedAt: now, duration: 0 }
      : state.activity,
    tapWindow: tapWindowDone ? { since: now, gained: 0 } : state.tapWindow,
  })
}

/** Call once when the app starts so the first tick has a sane baseline. */
export function resetClock(now = Date.now()): void {
  lastTick = now
}
