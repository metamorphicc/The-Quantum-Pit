import type { IconName } from '../components/PixelIcon'

/* ==========================================================================
   Trader stats

   Four 0..100 gauges. Bankroll is deliberately NOT one of them — it is real
   (simulated) money, unbounded, and it only moves on fills, fees and events.
   The HUD still shows five bars: the fifth is bankroll health, derived from
   the drawdown off the peak.
   ========================================================================== */

export type StatKey = 'edge' | 'focus' | 'heat' | 'rep'

export type Stats = Record<StatKey, number>

export interface StatMeta {
  key: StatKey
  label: string
  icon: IconName
  /** bar fill colour (hex) */
  color: string
  /** darker shade used for the bar's bottom row */
  colorDark: string
  /**
   * Points lost per real hour. Negative means the gauge drifts *up* while the
   * app is closed — nothing does that yet, but Heat is the obvious candidate
   * if the tuning ever wants a slow burn instead of a slow cool.
   */
  driftPerHour: number
  /** true when a HIGH value is the dangerous one (Heat) */
  inverted?: boolean
  /** line shown when this stat goes critical */
  warn: string
}

/* ==========================================================================
   Screens / navigation
   ========================================================================== */

export type ScreenId =
  | 'boot'
  /** the trading hall — the one main screen */
  | 'room'
  | 'research'
  | 'scan'
  | 'bet'
  | 'rig'
  | 'shop'
  | 'profile'
  | 'tasks'
  | 'settings'

/* ==========================================================================
   Character activity (drives the sprite animation)
   ========================================================================== */

export type ActivityKind =
  | 'idle'
  /** tapped: he shows you the book */
  | 'pnl'
  | 'research'
  | 'recover'
  | 'hedge'
  | 'sidejob'
  | 'scan'
  | 'bet'
  | 'refuse'

export interface Activity {
  kind: ActivityKind
  startedAt: number
  duration: number
}

/* ==========================================================================
   Money

   `bankroll` is the simulated cash line. `credits` are the slower currency —
   earned from good books, spent on the things bankroll should not buy.
   ========================================================================== */

export type Currency = 'bankroll' | 'credits'

/* ==========================================================================
   Login / identity
   ========================================================================== */

export type LoginMethod = 'base' | 'telegram' | 'guest'

/* ==========================================================================
   Trader class
   ========================================================================== */

export type MarketCategory = 'crypto' | 'sports' | 'perps' | 'politics' | 'culture'

export type TraderClassId = 'crypto' | 'sports' | 'perps' | 'politics' | 'general'

export interface TraderClassDef {
  id: TraderClassId
  name: string
  short: string
  icon: IconName
  marketBias: MarketCategory
  statBoost: Partial<Stats>
  winBonus: number
  desc: string
}

/* ==========================================================================
   Achievements / onchain badge prep
   ========================================================================== */

export type AchievementId =
  | 'first-desk'
  | 'base-linked'
  | 'first-scan'
  | 'first-ticket'
  | 'first-win'
  | 'zero-recovery'
  | 'ten-wins'
  | 'hundred-tickets'
  | 'level-5'
  | 'level-10'
  | 'level-15'
  | 'level-20'
  | 'level-25'
  | 'level-30'

export type AchievementClaimStatus = 'unclaimed' | 'claimed'

export interface AchievementDef {
  id: AchievementId
  tokenId: number
  name: string
  desc: string
  icon: IconName
  rarity: 'common' | 'rare' | 'epic'
}

export interface AchievementRecord {
  unlockedAt: number
  claimStatus: AchievementClaimStatus
  claimedAt: number
  txHash: string | null
}

/* ==========================================================================
   Cosmetic ownership / donations
   ========================================================================== */

export type CosmeticCategory = 'outfit' | 'desk' | 'monitor' | 'room' | 'tool'

export type DonationPaymentProvider = 'base' | 'telegram-stars'

export interface CosmeticDef {
  id: string
  name: string
  category: CosmeticCategory
  icon: IconName
  priceUsd: number
  priceStars: number
  rarity: 'standard' | 'rare' | 'founder'
  desc: string
}

export type ActiveCosmetics = Partial<Record<CosmeticCategory, string | null>>

/* ==========================================================================
   Items
   ========================================================================== */

/** One-shot desk supplies: coffee, notes, a cooldown draught. */
export interface SupplyDef {
  id: string
  name: string
  icon: IconName
  price: number
  currency: Currency
  /** stat deltas applied on use */
  gain: Partial<Stats>
  /** side effect beyond the stat deltas */
  effect?: 'clearCooldowns' | 'freeScan'
  /** dry one-liner shown in the detail panel */
  desc: string
}

export type EquipSlot = 'head' | 'cloak' | 'blade'

export interface RigBonus {
  /** lowers Focus spent on scanning the board */
  scanFocusSave?: number
  /** lowers Heat gained from scanning the board */
  scanHeatSave?: number
  /** lowers Focus spent when sending a ticket */
  betFocusSave?: number
  /** lowers Heat gained when sending a ticket */
  betHeatSave?: number
  /** lowers Focus spent by the free rules read */
  readFocusSave?: number
  /** adds Focus restored by Break */
  recoverFocusAdd?: number
  /** adds extra Heat cleared by Break */
  recoverHeatClearAdd?: number
  /** adds extra Heat cleared by Hedge */
  hedgeHeatClearAdd?: number
  /** adds to the Edge probability swing, e.g. 0.01 = +1 point at full Edge */
  edgeSwingAdd?: number
  /** lowers ticket fee, e.g. 0.002 = 0.2 percentage points */
  feeDiscount?: number
  /** lowers stale quote penalty */
  staleSlipSave?: number
  /** lowers heat slip penalty */
  heatSlipSave?: number
  /** flat XP added to winning fills */
  winXpAdd?: number
  /** flat XP added to losing fills */
  lossXpAdd?: number
}

export interface RigDef {
  id: string
  name: string
  slot: EquipSlot
  icon: IconName
  price: number
  currency: Currency
  desc: string
  bonus?: RigBonus
  /** owned from the start */
  starter?: boolean
}

export type EquippedLook = Record<EquipSlot, string | null>

/* ==========================================================================
   Markets — mock only. No feed, no API, no real book.
   ========================================================================== */

export type Side = 'yes' | 'no'

/** The static question. Quotes are generated, never fetched. */
export interface MarketDef {
  id: string
  question: string
  category: MarketCategory
  /** short chip label */
  tag: string
  icon: IconName
  /** centre of the quoted YES probability, 0..1 */
  base: number
  /** how far the quote wanders each scan, in probability points */
  drift: number
  focusCost: number
  heatCost: number
  blurb: string
}

/** A quote on the board right now. Persisted, so the book survives a reload. */
export interface MarketState {
  id: string
  /** quoted YES probability, 0..1 */
  prob: number
  /** epoch ms the quote was taken */
  quotedAt: number
}

/** What a resolved simulated position did. Feeds the toast and the tally. */
export interface TradeResult {
  marketId: string
  question: string
  side: Side
  stake: number
  /** effective fill price after any heat slippage, 0..1 */
  price: number
  /** true probability the coin was weighted with, after Edge */
  trueProb: number
  won: boolean
  /** bankroll delta, already net of the fee */
  pnl: number
  fee: number
  slipped: boolean
  hedged: boolean
  xpGained: number
}

/* ==========================================================================
   Tasks

   Four buckets. Daily/weekly/monthly reset on rolling windows; milestones are
   permanent career steps. A task's progress is derived — never instrumented —
   from the cumulative counters below plus XP/level. See game/tasks.ts.
   ========================================================================== */

export type TaskPeriod = 'daily' | 'weekly' | 'monthly'

export type TaskCategory = TaskPeriod | 'milestone'

/** All monotonic — that is what lets a periodic task read as current-baseline. */
export type TaskMetric =
  | 'bets'
  | 'wins'
  | 'losses'
  | 'scans'
  | 'researches'
  | 'hedges'
  | 'recovers'
  | 'taps'
  | 'xp'
  | 'level'
  | 'bestStreak'

/** What completing a task pays out, drawn from the existing economy. Cosmetics
    are deliberately absent: those stay paid-only and carry no power. */
export interface TaskReward {
  credits?: number
  bankroll?: number
  xp?: number
}

export interface TaskDef {
  id: string
  category: TaskCategory
  name: string
  desc: string
  icon: IconName
  metric: TaskMetric
  /** progress needed within the window (periodic) or absolute total (milestone) */
  target: number
  reward: TaskReward
}

export interface TaskBucketState {
  /** the window index this bucket tracks; a change triggers a roll */
  period: number
  /** counter snapshot captured when the window opened; progress = now - baseline */
  baseline: Partial<Record<TaskMetric, number>>
  /** ids claimed within the current window */
  claimed: string[]
}

export interface TasksState {
  daily: TaskBucketState
  weekly: TaskBucketState
  monthly: TaskBucketState
  /** milestone ids claimed — permanent, never reset */
  milestones: string[]
}

/** A resolved task ready to render: definition plus live progress. */
export interface TaskView {
  def: TaskDef
  progress: number
  target: number
  done: boolean
  claimed: boolean
  /** 0..100 for the progress bar */
  pct: number
}

/* ==========================================================================
   Persisted save
   ========================================================================== */

export interface SaveData {
  version: number
  /** what the player calls him — renameable, defaults to WORLD.hero */
  name: string
  /** how the player chose to enter this local book */
  loginMethod: LoginMethod | null
  walletAddress: string | null
  walletChainId: string | null
  walletConnectedAt: number
  /** first-run guide + class choice */
  onboarded: boolean
  traderClass: TraderClassId | null
  /** achievement id -> unlock/claim state. Claim maps to future Base badges. */
  achievements: Partial<Record<AchievementId, AchievementRecord>>
  stats: Stats
  /** simulated cash. Not real money. Never was. */
  bankroll: number
  /** career progression, earned from settled simulated trades */
  xp: number
  /** high-water mark, so the HUD can show a drawdown */
  peakBankroll: number
  credits: number
  /** supplyId -> count on the desk */
  stash: Record<string, number>
  /** rigIds the player owns */
  owned: string[]
  look: EquippedLook
  /** paid cosmetic ids; pure presentation, never gameplay power */
  ownedCosmetics: string[]
  activeCosmetics: ActiveCosmetics
  /** daily/weekly/monthly + milestone progress; see game/tasks.ts */
  tasks: TasksState
  /** the board as last scanned */
  markets: MarketState[]
  /** epoch ms of the last scan */
  marketsAt: number
  /** epoch ms until which the hedge dampens the next fill */
  hedgeUntil: number
  /** epoch ms of the last time the game was open */
  lastVisit: number
  /** epoch ms of first boot, used for the day counter */
  firstVisit: number
  /** number of separate sessions */
  visits: number
  /** cumulative counters, for flavour text */
  tally: {
    taps: number
    researches: number
    recovers: number
    hedges: number
    scans: number
    bets: number
    wins: number
    losses: number
    streak: number
    bestStreak: number
    /** best single simulated win */
    bestWin: number
    /** worst single simulated loss (positive number) */
    worstLoss: number
  }
  settings: {
    sound: boolean
    haptics: boolean
    reduceMotion: boolean
  }
}

/* ==========================================================================
   Runtime state = save + ephemeral UI state
   ========================================================================== */

export interface GameState extends SaveData {
  screen: ScreenId
  activity: Activity
  /** actionId -> epoch ms when it becomes usable again */
  cooldowns: Record<string, number>
  /** ms the player was away on this boot (0 if fresh save) */
  awayMs: number
  /** his current line, shown in the speech ribbon */
  line: string
  /** bumped whenever a new line is set so the bubble can re-animate */
  lineId: number
  /** which market the bet screen is working on */
  focusMarket: string | null
  /** the last resolved position, for the bet screen's result panel */
  lastTrade: TradeResult | null
  /** PnL checks in the current anti-spam window */
  tapWindow: { since: number; gained: number }
}

export interface ActionResult {
  ok: boolean
  message: string
  gain?: Partial<Stats>
  bankroll?: number
  credits?: number
}
