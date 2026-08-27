import {
  CLOUD_SAVE_KEY,
  DONATION_COSMETIC_BY_ID,
  MARKET_BY_ID,
  MAX_OFFLINE_HOURS,
  OFFLINE_FLOOR,
  SAVE_KEY_LEGACY,
  SAVE_KEY_PREFIX,
  SAVE_VERSION,
  STATS,
  STAT_ORDER,
  TRADER_CLASS_BY_ID,
  freshSave,
  sanitizeName,
} from './config'
import type {
  AchievementId,
  AchievementRecord,
  ActiveCosmetics,
  CosmeticCategory,
  LoginMethod,
  MarketState,
  SaveData,
  Stats,
  TaskBucketState,
  TaskMetric,
  TaskPeriod,
  TasksState,
  TraderClassId,
  DailyLoginState,
} from './types'
import { clamp } from './util'
import { ACHIEVEMENT_BY_ID } from './achievements'
import { snapshotBaseline } from './tasks'
import { dayIndex } from './daily'
import {
  cloudAvailable,
  cloudGet,
  cloudRemove,
  cloudSet,
  tgUserId,
} from '../telegram/telegram'

export interface LoadResult {
  save: SaveData
  /** ms since the previous session (0 for a brand new save) */
  awayMs: number
  fresh: boolean
}
function localKey(): string {
  const id = tgUserId()
  return `${SAVE_KEY_PREFIX}${id === null ? 'guest' : id}`
}

function readKey(key: string): Partial<SaveData> | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return null // private mode / storage disabled - play in-memory
  }
  if (!raw) return null
  return parseSave(raw)
}

function parseSave(raw: string): Partial<SaveData> | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Partial<SaveData>) : null
  } catch {
    return null
  }
}

/** `lastVisit` as it was found on disk - used to decide if the cloud is newer. */
let localSavedAt = 0

/**
 * Reads the save, repairs anything missing/corrupt, then applies the drift that
 * happened while the app was closed. Offline drift is capped so a long absence
 * is survivable.
 */
export function loadSave(now: number): LoadResult {
  const base = freshSave(now)

  // The namespaced key wins. Falling back to the old flat key adopts a save
  // made before per-account namespacing existed - once, and only if this
  // account has nothing of its own yet.
  const input = readKey(localKey()) ?? readKey(SAVE_KEY_LEGACY)
  if (!input) {
    localSavedAt = 0
    return { save: base, awayMs: 0, fresh: true }
  }

  const save = migrate(input, base)
  localSavedAt = save.lastVisit
  const awayMs = Math.max(0, now - save.lastVisit)

  save.stats = applyDrift(save.stats, awayMs)
  save.lastVisit = now
  save.visits += 1

  return { save, awayMs, fresh: false }
}

/**
 * Merge an unknown-shaped payload onto a fresh save, field by field.
 *
 * This is also the v4 -> v5 path. A pre-Quantum-Pit save has `needs`, `coins`,
 * `shards` and `larder`, none of which mean anything now, so they are simply
 * not read - the trader half comes out fresh. What does carry over is the part
 * that is still his: the name, the rig he owns, what he is wearing, and how
 * long you have been at this.
 */
function migrate(input: Partial<SaveData>, base: SaveData): SaveData {
  const stats = { ...base.stats }
  if (input.stats && typeof input.stats === 'object') {
    for (const key of STAT_ORDER) {
      const v = (input.stats as Partial<Stats>)[key]
      if (typeof v === 'number' && Number.isFinite(v)) stats[key] = clamp(v)
    }
  }

  const stash: Record<string, number> = {}
  if (input.stash && typeof input.stash === 'object') {
    for (const [k, v] of Object.entries(input.stash)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        stash[k] = Math.floor(v)
      }
    }
  }

  const bankroll = Math.max(0, num(input.bankroll, base.bankroll))
  const hadProgress =
    num(input.xp, 0) > 0 ||
    num(input.visits, 0) > 1 ||
    num(input.tally?.bets, 0) > 0 ||
    num(input.tally?.scans, 0) > 0
  const traderClass = readTraderClass(input.traderClass)
  // Pulled out of the return so the task baselines can key off the migrated
  // totals, not the fresh-save zeros in `base`.
  const xp = Math.max(0, Math.floor(num(input.xp, base.xp)))
  const tally = { ...base.tally, ...(input.tally ?? {}) }

  return {
    version: SAVE_VERSION,
    // Saves written before v4 have no name at all. The old default name is
    // presentation debt, not a player choice, so it follows the new character.
    name: readName(input.name, base.name),
    loginMethod: readLoginMethod(input.loginMethod),
    walletAddress: readWalletAddress(input.walletAddress),
    walletChainId: typeof input.walletChainId === 'string' ? input.walletChainId : null,
    walletConnectedAt: Math.max(0, num(input.walletConnectedAt, 0)),
    onboarded: typeof input.onboarded === 'boolean' ? input.onboarded : hadProgress,
    traderClass,
    achievements: readAchievements(input.achievements),
    stats,
    bankroll,
    xp,
    peakBankroll: Math.max(bankroll, num(input.peakBankroll, base.peakBankroll)),
    credits: Math.max(0, num(input.credits, base.credits)),
    stash: Object.keys(stash).length ? stash : base.stash,
    owned: Array.isArray(input.owned)
      ? Array.from(new Set([...base.owned, ...input.owned.filter((x) => typeof x === 'string')]))
      : base.owned,
    look: {
      head: str(input.look?.head, base.look.head),
      cloak: str(input.look?.cloak, base.look.cloak),
      blade: str(input.look?.blade, base.look.blade),
    },
    ownedCosmetics: readOwnedCosmetics(input.ownedCosmetics),
    activeCosmetics: readActiveCosmetics(input.activeCosmetics),
    tasks: readTasks(input.tasks, { xp, tally }, base.tasks),
    dailyLogin: readDailyLogin(input.dailyLogin, base.dailyLogin),
    markets: readMarkets(input.markets),
    marketsAt: num(input.marketsAt, base.marketsAt),
    hedgeUntil: num(input.hedgeUntil, base.hedgeUntil),
    lastVisit: num(input.lastVisit, base.lastVisit),
    firstVisit: num(input.firstVisit, base.firstVisit),
    visits: num(input.visits, base.visits),
    tally,
    settings: { ...base.settings, ...(input.settings ?? {}) },
  }
}

function readDailyLogin(input: unknown, fallback: DailyLoginState): DailyLoginState {
  if (!input || typeof input !== 'object') return fallback
  const raw = input as Partial<DailyLoginState>
  const today = dayIndex(Date.now())
  const lastClaimDay = Math.floor(num(raw.lastClaimDay, fallback.lastClaimDay))
  return {
    streak: Math.max(0, Math.floor(num(raw.streak, 0))),
    bestStreak: Math.max(0, Math.floor(num(raw.bestStreak, 0))),
    lastClaimDay: Math.min(today, lastClaimDay),
  }
}

/** Task ids are opaque strings; keep the unique, well-typed ones. */
function readTaskStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return Array.from(new Set(input.filter((x): x is string => typeof x === 'string')))
}

/** A stored baseline is a metric->count map; drop anything non-numeric. */
function readTaskBaseline(input: unknown): Partial<Record<TaskMetric, number>> {
  const out: Partial<Record<TaskMetric, number>> = {}
  if (!input || typeof input !== 'object') return out
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k as TaskMetric] = v
  }
  return out
}

/**
 * Rebuild the task record. When a stored bucket still names the current window
 * we keep its baseline and claims; otherwise (rolled, absent, or a pre-v11 save
 * with no tasks at all) we snapshot the migrated counters as the new baseline,
 * so upgrading mid-career doesn't hand out a window's worth of instant clears.
 * Milestones are absolute, so keeping only the claimed ids is enough - a
 * veteran can rightly claim the career steps they have already passed.
 */
function readTasks(
  input: unknown,
  metrics: Pick<SaveData, 'xp' | 'tally'>,
  fallback: TasksState,
): TasksState {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : null
  const bucket = (key: TaskPeriod): TaskBucketState => {
    const fb = fallback[key]
    const raw = src?.[key]
    if (raw && typeof raw === 'object') {
      const r = raw as Partial<TaskBucketState>
      if (typeof r.period === 'number' && r.period === fb.period) {
        return {
          period: fb.period,
          baseline: readTaskBaseline(r.baseline),
          claimed: readTaskStringArray(r.claimed),
        }
      }
    }
    return { period: fb.period, baseline: snapshotBaseline(metrics), claimed: [] }
  }
  return {
    daily: bucket('daily'),
    weekly: bucket('weekly'),
    monthly: bucket('monthly'),
    milestones: readTaskStringArray(src?.milestones),
  }
}

/** Quotes are only kept for questions that still exist in this build. */
function readMarkets(input: unknown): MarketState[] {
  if (!Array.isArray(input)) return []
  const out: MarketState[] = []
  for (const row of input) {
    if (!row || typeof row !== 'object') continue
    const { id, prob, quotedAt } = row as Partial<MarketState>
    if (typeof id !== 'string' || !MARKET_BY_ID[id]) continue
    if (typeof prob !== 'number' || !Number.isFinite(prob)) continue
    out.push({
      id,
      prob: Math.min(0.99, Math.max(0.01, prob)),
      quotedAt: typeof quotedAt === 'number' && Number.isFinite(quotedAt) ? quotedAt : 0,
    })
  }
  return out
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function readName(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const name = sanitizeName(v)
  return name === 'Old Halvard' ? fallback : name
}

function readTraderClass(v: unknown): TraderClassId | null {
  return typeof v === 'string' && v in TRADER_CLASS_BY_ID ? (v as TraderClassId) : null
}

function readLoginMethod(v: unknown): LoginMethod | null {
  return v === 'base' || v === 'telegram' || v === 'guest' ? v : null
}

function readAchievements(input: unknown): Partial<Record<AchievementId, AchievementRecord>> {
  if (!input || typeof input !== 'object') return {}
  const achievements: Partial<Record<AchievementId, AchievementRecord>> = {}
  for (const [id, raw] of Object.entries(input)) {
    if (!(id in ACHIEVEMENT_BY_ID) || !raw || typeof raw !== 'object') continue
    const record = raw as Partial<AchievementRecord>
    const unlockedAt = Math.max(0, num(record.unlockedAt, 0))
    if (unlockedAt <= 0) continue
    achievements[id as AchievementId] = {
      unlockedAt,
      claimStatus: record.claimStatus === 'claimed' ? 'claimed' : 'unclaimed',
      claimedAt: Math.max(0, num(record.claimedAt, 0)),
      txHash: typeof record.txHash === 'string' && record.txHash.length > 0 ? record.txHash : null,
    }
  }
  return achievements
}

function readWalletAddress(v: unknown): string | null {
  return typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v) ? v : null
}

function readOwnedCosmetics(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return Array.from(
    new Set(input.filter((id): id is string => typeof id === 'string' && id in DONATION_COSMETIC_BY_ID)),
  )
}

function readActiveCosmetics(input: unknown): ActiveCosmetics {
  if (!input || typeof input !== 'object') return {}
  const out: ActiveCosmetics = {}
  for (const [category, id] of Object.entries(input)) {
    if (!isCosmeticCategory(category)) continue
    if (typeof id !== 'string' || !(id in DONATION_COSMETIC_BY_ID)) continue
    if (DONATION_COSMETIC_BY_ID[id].category !== category) continue
    out[category] = id
  }
  return out
}

function isCosmeticCategory(v: string): v is CosmeticCategory {
  return v === 'outfit' || v === 'desk' || v === 'monitor' || v === 'room' || v === 'tool'
}

function str(v: unknown, fallback: string | null): string | null {
  return typeof v === 'string' ? v : v === null ? null : fallback
}

/** Stats after `elapsedMs` of neglect. Heat cools; everything else erodes. */
export function applyDrift(stats: Stats, elapsedMs: number): Stats {
  const hours = Math.min(elapsedMs / 3_600_000, MAX_OFFLINE_HOURS)
  if (hours <= 0) return stats
  const out = { ...stats }
  for (const key of STAT_ORDER) {
    const drifted = clamp(out[key] - STATS[key].driftPerHour * hours)
    // Heat is allowed all the way to nothing. The eroding gauges stop at the
    // floor, so a returning player always has enough left to act - and never
    // gets a gauge handed back up if it was already below it.
    out[key] = STATS[key].inverted
      ? drifted
      : Math.max(drifted, Math.min(out[key], OFFLINE_FLOOR))
  }
  return out
}
let saveTimer: number | undefined

/** Debounced write. Call `flushSave` when the app is about to disappear. */
export function scheduleSave(get: () => SaveData): void {
  if (saveTimer !== undefined) return
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined
    writeSave(get())
  }, 500)
}

export function flushSave(data: SaveData): void {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  writeSave(data, true)
}

export function writeSave(data: SaveData, immediateCloud = false): void {
  const payload: SaveData = {
    version: SAVE_VERSION,
    name: data.name,
    loginMethod: data.loginMethod,
    walletAddress: data.walletAddress,
    walletChainId: data.walletChainId,
    walletConnectedAt: data.walletConnectedAt,
    onboarded: data.onboarded,
    traderClass: data.traderClass,
    achievements: data.achievements,
    stats: data.stats,
    bankroll: data.bankroll,
    xp: data.xp,
    peakBankroll: data.peakBankroll,
    credits: data.credits,
    stash: data.stash,
    owned: data.owned,
    look: data.look,
    ownedCosmetics: data.ownedCosmetics,
    activeCosmetics: data.activeCosmetics,
    tasks: data.tasks,
    dailyLogin: data.dailyLogin,
    markets: data.markets,
    marketsAt: data.marketsAt,
    hedgeUntil: data.hedgeUntil,
    lastVisit: Date.now(),
    firstVisit: data.firstVisit,
    visits: data.visits,
    tally: data.tally,
    settings: data.settings,
  }
  const json = JSON.stringify(payload)

  try {
    localStorage.setItem(localKey(), json)
  } catch {
    // out of quota or storage blocked - nothing we can do, keep playing
  }

  queueCloudWrite(json, immediateCloud)
}

export function clearSave(): void {
  try {
    localStorage.removeItem(localKey())
    // Drop the pre-namespacing key too, or it gets adopted all over again.
    localStorage.removeItem(SAVE_KEY_LEGACY)
  } catch {
    /* ignore */
  }
  if (cloudTimer !== undefined) {
    clearTimeout(cloudTimer)
    cloudTimer = undefined
  }
  pendingCloud = null
  void cloudRemove(CLOUD_SAVE_KEY)
}
const CLOUD_DEBOUNCE = 12_000

let cloudTimer: number | undefined
let pendingCloud: string | null = null
let cloudGateOpen = false

function queueCloudWrite(json: string, immediate: boolean): void {
  if (!cloudAvailable()) return
  pendingCloud = json
  if (!cloudGateOpen) return

  if (immediate) {
    if (cloudTimer !== undefined) {
      clearTimeout(cloudTimer)
      cloudTimer = undefined
    }
    flushCloud()
    return
  }
  if (cloudTimer !== undefined) return
  cloudTimer = window.setTimeout(() => {
    cloudTimer = undefined
    flushCloud()
  }, CLOUD_DEBOUNCE)
}

function flushCloud(): void {
  const json = pendingCloud
  pendingCloud = null
  if (json) void cloudSet(CLOUD_SAVE_KEY, json)
}

/**
 * Reads the account-wide copy. Resolves with a save only when it is genuinely
 * newer than what this device had - otherwise null, and the local save stands.
 * Opening the write gate is the caller's job (`releaseCloudWrites`), so a slow
 * or missing response cannot silently discard the cloud copy.
 */
export async function pullCloudSave(now: number): Promise<LoadResult | null> {
  if (!cloudAvailable()) return null

  const raw = await cloudGet(CLOUD_SAVE_KEY)
  const input = raw ? parseSave(raw) : null
  if (!input) return null

  const save = migrate(input, freshSave(now))
  // A second of slack: the same device round-tripping its own save is not news.
  if (save.lastVisit <= localSavedAt + 1000) return null

  const awayMs = Math.max(0, now - save.lastVisit)
  save.stats = applyDrift(save.stats, awayMs)
  save.lastVisit = now
  save.visits += 1
  localSavedAt = now

  return { save, awayMs, fresh: false }
}

/** Lets queued cloud writes through. Call once the initial pull has settled. */
export function releaseCloudWrites(): void {
  if (cloudGateOpen) return
  cloudGateOpen = true
  if (pendingCloud) queueCloudWrite(pendingCloud, true)
}
