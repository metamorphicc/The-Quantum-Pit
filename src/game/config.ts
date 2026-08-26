import type {
  ActionResult,
  CosmeticDef,
  MarketDef,
  RigDef,
  SaveData,
  StatKey,
  StatMeta,
  SupplyDef,
  TraderClassDef,
  TraderClassId,
} from './types'
import { P } from '../styles/palette'
import type { IconName } from '../components/PixelIcon'
import { freshTasks } from './tasks'

/* ==========================================================================
   World

   A paper-trading sim. Wallets can identify a profile, but never place real
   orders here. One room, one desk, one beginner trying to become a quant trader.
   ========================================================================== */

export const GAME_VERSION = '2.0.0'

/**
 * Save keys are namespaced per Telegram account, so two people sharing a
 * device (or the same browser) get their own trader. `SAVE_KEY_LEGACY` is the
 * flat key used before namespacing; it is adopted once, then left alone.
 */
export const SAVE_KEY_PREFIX = 'ktw.save.v1:'
export const SAVE_KEY_LEGACY = 'ktw.save.v1'
export const CLOUD_SAVE_KEY = 'ktw_save_v1'
export const SAVE_VERSION = 11

/** Longest name the player may give him. */
export const NAME_MAX = 18

/**
 * Names are player-typed, so they are also drawn into the HUD and stored in the
 * cloud. Keep letters (any alphabet), digits and the punctuation a name can
 * legitimately contain; drop everything else. An empty result falls back to the
 * default rather than leaving him nameless.
 */
export function sanitizeName(input: string): string {
  const cleaned = input
    .replace(/[^\p{L}\p{N} '\-.]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim()
  return cleaned.length > 0 ? cleaned : WORLD.hero
}

/** Original world naming. Prediction markets as a mood, not as a data feed. */
export const WORLD = {
  title: 'Quantum Pit',
  subtitle: 'Polymarket trader simulator',
  /** the main room */
  hall: 'The Desk',
  /** the settings screen */
  keep: 'The Back Office',
  hero: 'Max',
  cashName: 'Bankroll',
  creditName: 'Credits',
  /** printed anywhere the player might forget */
  disclaimer: 'Simulated only. No real money, no real orders.',
} as const

/* ==========================================================================
   Stats
   ========================================================================== */

export const STAT_ORDER: StatKey[] = ['edge', 'focus', 'heat', 'rep']
export const DESK_STAT_ORDER: StatKey[] = ['edge', 'focus', 'heat']

export const STATS: Record<StatKey, StatMeta> = {
  edge: {
    key: 'edge',
    label: 'Edge',
    icon: 'swordBlue',
    color: P.spiritLit,
    colorDark: P.spiritDeep,
    driftPerHour: 4,
    warn: 'No thesis. You are gambling, not trading.',
  },
  focus: {
    key: 'focus',
    label: 'Focus',
    icon: 'bolt',
    color: P.gold,
    colorDark: P.goldDark,
    driftPerHour: 6,
    warn: 'He is reading the same line four times. Let him sit down.',
  },
  heat: {
    key: 'heat',
    label: 'Heat',
    icon: 'flame',
    color: P.ember,
    colorDark: P.emberDeep,
    /** heat bleeds off slowly on its own — the gauge cools, it does not decay */
    driftPerHour: 5,
    inverted: true,
    warn: 'Heat is high. Hedge or blow the account.',
  },
  rep: {
    key: 'rep',
    label: 'Rep',
    icon: 'star',
    color: P.tealLit,
    colorDark: P.tealDeep,
    driftPerHour: 0,
    warn: 'His name is still nobody. Win cleanly before asking for respect.',
  },
}

/** Below this a normal gauge is "low" and its HUD bar starts blinking. */
export const STAT_LOW = 30
export const STAT_CRIT = 15
/** Above these, Heat is the problem. */
export const STAT_HIGH = 68
export const STAT_HOT = 85

/** The fifth HUD bar is derived: bankroll against its own high-water mark. */
export const BANKROLL_BAR = {
  label: 'Bankroll',
  icon: 'coin' as IconName,
  color: P.greenLit,
  colorDark: P.green,
}

/** Cap offline drift so a two-week absence is not an instant funeral. */
export const MAX_OFFLINE_HOURS = 36

/**
 * Offline drift never pushes an eroding gauge below this. Coming back after a
 * week should find a cold, dull desk — not a locked one; the floor sits a little
 * above the steepest action requirement (Sim Bet, focus 12) so the live clock
 * cannot immediately erode a returning player out of his own game. Heat is
 * exempt: cooling all the way down while away is the reward for leaving.
 */
export const OFFLINE_FLOOR = 18

/* ==========================================================================
   Trader classes
   ========================================================================== */

export const TRADER_CLASSES: TraderClassDef[] = [
  {
    id: 'crypto',
    name: 'Crypto Trader',
    short: 'Crypto',
    icon: 'coin',
    marketBias: 'crypto',
    statBoost: { edge: 4, focus: 2, heat: 4 },
    winBonus: 0.035,
    desc: 'Better at spot coins, ETFs and chain narratives. Runs a little hotter.',
  },
  {
    id: 'sports',
    name: 'Sports Trader',
    short: 'Sports',
    icon: 'star',
    marketBias: 'sports',
    statBoost: { edge: 3, focus: 7 },
    winBonus: 0.035,
    desc: 'Reads schedules and public overreaction. Strong focus, cleaner sports fills.',
  },
  {
    id: 'perps',
    name: 'Perp Trader',
    short: 'Perps',
    icon: 'bolt',
    marketBias: 'perps',
    statBoost: { edge: 5, focus: -2, heat: 8 },
    winBonus: 0.04,
    desc: 'Built for liquidations, funding and leverage. More edge, more heat.',
  },
  {
    id: 'politics',
    name: 'Politics Trader',
    short: 'Politics',
    icon: 'gear',
    marketBias: 'politics',
    statBoost: { edge: 6, focus: 1, heat: 2 },
    winBonus: 0.035,
    desc: 'Polls, timelines and procedural weirdness. Starts with the best raw Edge.',
  },
  {
    id: 'general',
    name: 'General Trader',
    short: 'General',
    icon: 'dice',
    marketBias: 'culture',
    statBoost: { edge: 2, focus: 5, heat: -3 },
    winBonus: 0.03,
    desc: 'Normie markets: awards, media, public events. Calm, flexible, less spiky.',
  },
]

export const TRADER_CLASS_BY_ID: Record<TraderClassId, TraderClassDef> = Object.fromEntries(
  TRADER_CLASSES.map((c) => [c.id, c]),
) as Record<TraderClassId, TraderClassDef>

export function traderClassById(id: TraderClassId | null | undefined): TraderClassDef | null {
  return id ? (TRADER_CLASS_BY_ID[id] ?? null) : null
}

/* ==========================================================================
   Actions
   ========================================================================== */

export interface ActionDef {
  id: string
  label: string
  icon: IconName
  /** navigates to a screen instead of resolving immediately */
  opens?: 'research' | 'scan' | 'bet' | 'rig' | 'shop' | 'settings'
  /** stat deltas on success */
  gain?: Partial<Record<StatKey, number>>
  /** simulated cash awarded (or charged, if negative) */
  cash?: number
  /** credits awarded */
  credits?: number
  /** ms before the button can be used again */
  cooldown?: number
  /** ms the character animation runs for */
  duration?: number
  /** refuses unless the stat sits inside the window */
  requires?: { stat: StatKey; min?: number; max?: number; refuse: string }
}

export const ACTIONS: Record<string, ActionDef> = {
  research: {
    id: 'research',
    label: 'Research',
    icon: 'stew',
    opens: 'research',
  },
  recover: {
    id: 'recover',
    label: 'Break',
    icon: 'bed',
    gain: { focus: 36, heat: -22, edge: -3 },
    cooldown: 40_000,
    duration: 2800,
  },
  hedge: {
    id: 'hedge',
    label: 'Hedge',
    icon: 'brush',
    gain: { heat: -26, focus: -4 },
    /** the hedge costs a little simulated cash to put on */
    cash: -2,
    cooldown: 26_000,
    duration: 1900,
    requires: {
      stat: 'focus',
      min: 8,
      refuse: 'Too fried to work the other leg. The hedge stays theoretical.',
    },
  },
  sidejob: {
    id: 'sidejob',
    label: 'Side Job',
    icon: 'bag',
    gain: { focus: -18, edge: -4, heat: 6 },
    cash: 28,
    cooldown: 120_000,
    duration: 2200,
    requires: {
      stat: 'focus',
      min: 22,
      refuse: 'Too fried to freelance. He would bill the wrong person.',
    },
  },
  scan: {
    id: 'scan',
    label: 'Board',
    icon: 'dice',
    opens: 'scan',
    requires: {
      stat: 'focus',
      min: 6,
      refuse: 'The board is a smear of numbers. Nothing is being read today.',
    },
  },
  bet: {
    id: 'bet',
    label: 'Ticket',
    icon: 'terminal',
    opens: 'bet',
    requires: {
      stat: 'focus',
      min: 12,
      refuse: 'Sizing anything now would be a donation. His words.',
    },
  },
}

/** Order of the big action buttons at the desk. */
export const ACTION_BAR: string[] = ['research', 'hedge', 'recover', 'sidejob', 'scan', 'bet']

/**
 * The free read, offered on the research screen when the stash is empty. Slow
 * and small on purpose — a broke desk still has a way back to an edge, it just
 * has to sit there and earn it.
 */
export const DESK_READ = {
  gain: { edge: 11, focus: -8 } as Partial<Record<StatKey, number>>,
  cooldown: 45_000,
  duration: 1700,
}

/** Past this, more reading does nothing and he says so. */
export const EDGE_SOFT_CAP = 92

/* ==========================================================================
   Tapping him = Check PnL
   ========================================================================== */

export const TAP = {
  focusPerTap: 0.3,
  /** soft cap: max PnL checking per window */
  windowMs: 60_000,
  windowCap: 12,
  /** chance a check shakes a credit loose (a rebate, a referral, who knows) */
  creditChance: 0.06,
  duration: 620,
}

/* ==========================================================================
   The board — mock questions only. Nothing is fetched, ever.
   ========================================================================== */

export const MARKETS: MarketDef[] = [
  {
    id: 'btc120',
    question: 'Will BTC close above 120k this month?',
    category: 'crypto',
    tag: 'BTC',
    icon: 'coin',
    base: 0.42,
    drift: 0.14,
    focusCost: 4,
    heatCost: 3,
    blurb: 'Round number, round crowd. The book leans long and knows it.',
  },
  {
    id: 'ethbtc',
    question: 'Will ETH outperform BTC this week?',
    category: 'crypto',
    tag: 'ETH',
    icon: 'shard',
    base: 0.47,
    drift: 0.1,
    focusCost: 3,
    heatCost: 2,
    blurb: 'A coin flip with a newsletter attached.',
  },
  {
    id: 'fedhike',
    question: 'Fed hike before October?',
    category: 'politics',
    tag: 'MACRO',
    icon: 'gear',
    base: 0.23,
    drift: 0.09,
    focusCost: 5,
    heatCost: 4,
    blurb: 'Everyone has read the same dot plot and drawn a different line.',
  },
  {
    id: 'soletf',
    question: 'Solana ETF approved this year?',
    category: 'crypto',
    tag: 'ETF',
    icon: 'star',
    base: 0.31,
    drift: 0.13,
    focusCost: 5,
    heatCost: 4,
    blurb: 'Priced on hope and one anonymous filing screenshot.',
  },
  {
    id: 'gasunder',
    question: 'Gas under 5 gwei for a full day?',
    category: 'crypto',
    tag: 'CHAIN',
    icon: 'bolt',
    base: 0.56,
    drift: 0.16,
    focusCost: 3,
    heatCost: 2,
    blurb: 'Quiet chains are cheap chains. Chains are rarely quiet.',
  },
  {
    id: 'rugweek',
    question: 'Another top-50 token down 40% this week?',
    category: 'perps',
    tag: 'RISK',
    icon: 'skull',
    base: 0.61,
    drift: 0.12,
    focusCost: 4,
    heatCost: 5,
    blurb: 'The house always has a favourite in this one.',
  },
  {
    id: 'fundingflip',
    question: 'Will BTC perp funding flip negative today?',
    category: 'perps',
    tag: 'FUNDING',
    icon: 'bolt',
    base: 0.38,
    drift: 0.17,
    focusCost: 4,
    heatCost: 5,
    blurb: 'The crowd is one wick away from discovering humility.',
  },
  {
    id: 'liqcascade',
    question: 'Will total liquidations clear $500M in 24h?',
    category: 'perps',
    tag: 'LIQS',
    icon: 'flame',
    base: 0.34,
    drift: 0.18,
    focusCost: 5,
    heatCost: 6,
    blurb: 'Leverage does not leave quietly. It leaves in screenshots.',
  },
  {
    id: 'openinterest',
    question: 'Will open interest hit a monthly high this week?',
    category: 'perps',
    tag: 'OI',
    icon: 'terminal',
    base: 0.49,
    drift: 0.12,
    focusCost: 4,
    heatCost: 4,
    blurb: 'The room gets crowded before anyone admits it is crowded.',
  },
  {
    id: 'finalsover',
    question: 'Will the finals game go over the closing total?',
    category: 'sports',
    tag: 'NBA',
    icon: 'star',
    base: 0.5,
    drift: 0.09,
    focusCost: 3,
    heatCost: 3,
    blurb: 'Public money loves points. Points sometimes love overtime.',
  },
  {
    id: 'underdogwin',
    question: 'Will a top underdog win outright this weekend?',
    category: 'sports',
    tag: 'DOG',
    icon: 'skull',
    base: 0.29,
    drift: 0.12,
    focusCost: 4,
    heatCost: 4,
    blurb: 'The upset price is mostly fear with a box score attached.',
  },
  {
    id: 'strikergoal',
    question: 'Will the star striker score before halftime?',
    category: 'sports',
    tag: 'GOAL',
    icon: 'bolt',
    base: 0.36,
    drift: 0.11,
    focusCost: 3,
    heatCost: 3,
    blurb: 'One hamstring rumor moves the whole room by five cents.',
  },
  {
    id: 'electionpoll',
    question: 'Will the next national poll show a lead change?',
    category: 'politics',
    tag: 'POLL',
    icon: 'gear',
    base: 0.44,
    drift: 0.1,
    focusCost: 4,
    heatCost: 3,
    blurb: 'The crosstabs are boring until they are suddenly the trade.',
  },
  {
    id: 'billvote',
    question: 'Will the bill pass committee this week?',
    category: 'politics',
    tag: 'VOTE',
    icon: 'mask',
    base: 0.58,
    drift: 0.11,
    focusCost: 5,
    heatCost: 4,
    blurb: 'Procedure is a market inefficiency wearing a suit.',
  },
  {
    id: 'debatebump',
    question: 'Will the debate winner gain in markets overnight?',
    category: 'politics',
    tag: 'DEBATE',
    icon: 'torch',
    base: 0.52,
    drift: 0.14,
    focusCost: 4,
    heatCost: 4,
    blurb: 'Everyone says vibes do not matter. Everyone prices them anyway.',
  },
  {
    id: 'oscars',
    question: 'Will the favorite win Best Picture?',
    category: 'culture',
    tag: 'OSCAR',
    icon: 'crown',
    base: 0.63,
    drift: 0.08,
    focusCost: 3,
    heatCost: 2,
    blurb: 'A normal market, somehow full of very abnormal certainty.',
  },
  {
    id: 'streaminghit',
    question: 'Will the new series hit #1 this weekend?',
    category: 'culture',
    tag: 'MEDIA',
    icon: 'terminal',
    base: 0.46,
    drift: 0.1,
    focusCost: 3,
    heatCost: 2,
    blurb: 'The trailer numbers are fake until they pay.',
  },
  {
    id: 'weatherdelay',
    question: 'Will bad weather delay the big live event?',
    category: 'culture',
    tag: 'EVENT',
    icon: 'ale',
    base: 0.27,
    drift: 0.13,
    focusCost: 4,
    heatCost: 3,
    blurb: 'Rain is not alpha. Knowing who priced it wrong might be.',
  },
]

export const MARKET_BY_ID: Record<string, MarketDef> = Object.fromEntries(
  MARKETS.map((m) => [m.id, m]),
)

export const MARKET = {
  /** a scan re-quotes the whole board */
  focusCost: 7,
  heatCost: 2,
  cooldown: 9_000,
  /** after this, quotes are stale and fills get worse */
  quoteTtlMs: 10 * 60_000,
  /** extra slippage taken when filling against a stale quote */
  staleSlip: 0.04,
  /** quotes never sit at the extremes — nothing is ever certain here */
  minProb: 0.06,
  maxProb: 0.94,
}

/* ==========================================================================
   Simulated fills

   Polymarket-style: the quote IS the price of one YES share, so a stake of
   $25 at 40c buys 62.5 shares that pay $1 each if it resolves your way.
   ========================================================================== */

export const BET = {
  sizes: [10, 25, 50],
  /** taken off the stake on every fill */
  fee: 0.02,
  /** how far full Edge tilts the real coin toward your side, in probability */
  edgeSwing: 0.08,
  /** above this Heat, fills start slipping against you */
  heatSlipAt: 60,
  /** worst-case slippage at Heat 100 */
  slipMax: 0.06,
  /** how long the "resolving" beat lasts */
  resolveDelayMs: 1700,
  win: { heat: 7, focus: -4, edge: -2 },
  loss: { heat: 12, focus: -10, edge: -2 },
  /** the hedge dampens the next fill in both directions */
  hedgeWindowMs: 100_000,
  hedgeWinMult: 0.7,
  hedgeLossMult: 0.55,
  /** below this, the game nudges him toward paid work instead of free money */
  bailout: { floor: 10 },
}

/* ==========================================================================
   Career progression
   ========================================================================== */

export const LEVEL_MAX = 30
export const XP = {
  win: 100,
  loss: 20,
}

export const CAREER_MILESTONES = [
  { min: 1, title: 'Beginner' },
  { min: 6, title: 'Amateur' },
  { min: 11, title: 'Research Intern' },
  { min: 16, title: 'Junior Quant' },
  { min: 21, title: 'Desk Trader' },
  { min: 26, title: 'Quant Trader' },
] as const

export const PROGRESSION_TIERS = [
  { tier: 1, min: 1, status: 'Bare Desk', room: 'Starter closet desk' },
  { tier: 2, min: 6, status: 'First Routine', room: 'Cleaner desk corner' },
  { tier: 3, min: 11, status: 'Research Setup', room: 'Monitor nook' },
  { tier: 4, min: 16, status: 'Junior Seat', room: 'Serious workstation' },
  { tier: 5, min: 21, status: 'Desk Seat', room: 'Pro apartment desk' },
  { tier: 6, min: 26, status: 'Quant Pit', room: 'City trading room' },
] as const

export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  if (level > LEVEL_MAX) return xpForLevel(LEVEL_MAX)
  return Math.floor(70 * Math.pow(level - 1, 1.45))
}

export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp))
  for (let level = LEVEL_MAX; level >= 1; level--) {
    if (safeXp >= xpForLevel(level)) return level
  }
  return 1
}

export function careerStatusForLevel(level: number): string {
  const safeLevel = Math.max(1, Math.min(LEVEL_MAX, Math.floor(level)))
  let status: string = CAREER_MILESTONES[0].title
  for (const milestone of CAREER_MILESTONES) {
    if (safeLevel >= milestone.min) status = milestone.title
  }
  return status
}

export function progressionTierForLevel(level: number): (typeof PROGRESSION_TIERS)[number] {
  const safeLevel = Math.max(1, Math.min(LEVEL_MAX, Math.floor(level)))
  let tier: (typeof PROGRESSION_TIERS)[number] = PROGRESSION_TIERS[0]
  for (const item of PROGRESSION_TIERS) {
    if (safeLevel >= item.min) tier = item
  }
  return tier
}

export function nextProgressionTier(level: number): (typeof PROGRESSION_TIERS)[number] | null {
  const safeLevel = Math.max(1, Math.min(LEVEL_MAX, Math.floor(level)))
  return PROGRESSION_TIERS.find((item) => item.min > safeLevel) ?? null
}

export function xpProgress(xp: number): { level: number; current: number; needed: number; pct: number } {
  const level = levelFromXp(xp)
  const floor = xpForLevel(level)
  const next = level >= LEVEL_MAX ? floor : xpForLevel(level + 1)
  const span = Math.max(1, next - floor)
  const current = level >= LEVEL_MAX ? span : Math.max(0, Math.floor(xp) - floor)
  const needed = level >= LEVEL_MAX ? span : span
  return {
    level,
    current,
    needed,
    pct: level >= LEVEL_MAX ? 100 : Math.min(100, Math.round((current / needed) * 100)),
  }
}

/* ==========================================================================
   Notes and signals — the "research" stash. Consumed one at a time.
   ========================================================================== */

export const SUPPLIES: SupplyDef[] = [
  {
    id: 'orderflow',
    name: 'Order Flow Notes',
    icon: 'stew',
    price: 14,
    currency: 'bankroll',
    gain: { edge: 30, focus: -6 },
    desc: 'Someone else did the reading. Their handwriting is terrible.',
  },
  {
    id: 'primer',
    name: 'Base Rate Primer',
    icon: 'bread',
    price: 7,
    currency: 'bankroll',
    gain: { edge: 16 },
    desc: 'Dull, correct, and quietly worth more than any thread.',
  },
  {
    id: 'depthmap',
    name: 'Depth Map',
    icon: 'fish',
    price: 20,
    currency: 'bankroll',
    gain: { edge: 26, heat: -6, focus: -4 },
    desc: 'Where the size is hiding. Mostly it is hiding from you.',
  },
  {
    id: 'thread',
    name: 'Anon Thread',
    icon: 'mushroom',
    price: 4,
    currency: 'bankroll',
    gain: { edge: 12, heat: 9, focus: -3 },
    desc: 'Two lines are genuine alpha. Forty are not. Good luck.',
  },
  {
    id: 'dossier',
    name: 'Resolution Dossier',
    icon: 'meat',
    price: 34,
    currency: 'bankroll',
    gain: { edge: 44, focus: -10 },
    desc: 'The actual rules of the actual question. Almost nobody reads them.',
  },
  {
    id: 'coffee',
    name: 'Burnt Coffee',
    icon: 'ale',
    price: 6,
    currency: 'bankroll',
    gain: { focus: 24, heat: 6 },
    desc: 'Warm, flat, beloved. Do not drink it before sizing up.',
  },
  {
    id: 'coldbrew',
    name: 'Cold Brew Flask',
    icon: 'honey',
    price: 16,
    currency: 'bankroll',
    gain: { focus: 40, edge: 4, heat: 8 },
    desc: 'Three days of clarity, borrowed at a punitive rate.',
  },
  {
    id: 'clarity',
    name: 'Clarity Draught',
    icon: 'potion',
    price: 2,
    currency: 'credits',
    gain: { focus: 46, heat: -30 },
    effect: 'clearCooldowns',
    desc: 'Tastes like a cold hallway. Everything is usable again.',
  },
]

export const SUPPLY_BY_ID: Record<string, SupplyDef> = Object.fromEntries(
  SUPPLIES.map((s) => [s.id, s]),
)

/* ==========================================================================
   The rig — cosmetics. Same three slots the sprite has always had.
   ========================================================================== */

export const RIGS: RigDef[] = [
  // ---- headset ----
  {
    id: 'head_none',
    name: 'Messy Hair',
    slot: 'head',
    icon: 'mask',
    price: 0,
    currency: 'bankroll',
    desc: 'Eighteen, under-slept, and not yet pretending otherwise.',
    starter: true,
  },
  {
    id: 'head_circlet',
    name: 'Quant Visor',
    slot: 'head',
    icon: 'helm',
    price: 420,
    currency: 'bankroll',
    desc: 'Cheap blue-light visor. Mostly placebo, but he reads the board cleaner.',
    bonus: { scanFocusSave: 1, readFocusSave: 1 },
  },
  {
    id: 'head_antler',
    name: 'Antenna Rig',
    slot: 'head',
    icon: 'antler',
    price: 780,
    currency: 'bankroll',
    desc: 'A ridiculous signal crown for stale books and crowded questions.',
    bonus: { staleSlipSave: 0.01, edgeSwingAdd: 0.004 },
  },
  {
    id: 'head_crown',
    name: 'Whale Crown',
    slot: 'head',
    icon: 'crown',
    price: 14,
    currency: 'credits',
    desc: 'Worn by someone who exited at the top. Once. Makes wins travel further.',
    bonus: { winXpAdd: 12, edgeSwingAdd: 0.006 },
  },
  // ---- coat ----
  {
    id: 'cloak_rag',
    name: 'Home Hoodie',
    slot: 'cloak',
    icon: 'cloak',
    price: 0,
    currency: 'bankroll',
    desc: 'Soft, ordinary, and absolutely not professional. Starter uniform.',
    starter: true,
  },
  {
    id: 'cloak_watch',
    name: 'Nightdesk Coat',
    slot: 'cloak',
    icon: 'cloak',
    price: 460,
    currency: 'bankroll',
    desc: 'A warmer layer for long sessions. Breaks actually feel like breaks.',
    bonus: { recoverFocusAdd: 6, recoverHeatClearAdd: 4 },
  },
  {
    id: 'cloak_pelt',
    name: 'Drawdown Pelt',
    slot: 'cloak',
    icon: 'pelt',
    price: 860,
    currency: 'bankroll',
    desc: 'Ugly, heavy, useful. Keeps panic heat from eating every ticket.',
    bonus: { hedgeHeatClearAdd: 6, betHeatSave: 1 },
  },
  {
    id: 'cloak_ember',
    name: 'Liquidation Drape',
    slot: 'cloak',
    icon: 'cloak',
    price: 12,
    currency: 'credits',
    desc: 'Smoulders faintly. Somehow makes bad fills a little less educationally useless.',
    bonus: { lossXpAdd: 6, heatSlipSave: 0.008 },
  },
  // ---- desk tools ----
  {
    id: 'blade_steel',
    name: 'Old Keyboard',
    slot: 'blade',
    icon: 'sword',
    price: 0,
    currency: 'bankroll',
    desc: 'Sticky keys, taped cable, still better than guessing.',
    starter: true,
  },
  {
    id: 'blade_calc',
    name: 'Pocket Calculator',
    slot: 'blade',
    icon: 'gear',
    price: 360,
    currency: 'bankroll',
    desc: 'The first real tool after the old keyboard. Saves just enough brain to matter.',
    bonus: { betFocusSave: 1, readFocusSave: 1 },
  },
  {
    id: 'blade_spirit',
    name: 'Chart Pad',
    slot: 'blade',
    icon: 'swordBlue',
    price: 520,
    currency: 'bankroll',
    desc: 'A second surface for sketches, signals, and bad ideas made visible.',
    bonus: { scanFocusSave: 2, scanHeatSave: 1 },
  },
  {
    id: 'blade_macropad',
    name: 'Used Macro Pad',
    slot: 'blade',
    icon: 'terminal',
    price: 680,
    currency: 'bankroll',
    desc: 'Half the keys are custom, half are cursed. Tickets print with less friction.',
    bonus: { betFocusSave: 1, feeDiscount: 0.002 },
  },
  {
    id: 'blade_depth',
    name: 'Depth Screen',
    slot: 'blade',
    icon: 'dice',
    price: 940,
    currency: 'bankroll',
    desc: 'Tiny order-book theater. Helps heat slip stop pretending to be destiny.',
    bonus: { betHeatSave: 2, heatSlipSave: 0.012 },
  },
  {
    id: 'blade_ember',
    name: 'Risk Tablet',
    slot: 'blade',
    icon: 'swordRed',
    price: 10,
    currency: 'credits',
    desc: 'Warm to touch. Warmer after the third martingale. Good at saying no.',
    bonus: { betHeatSave: 2, hedgeHeatClearAdd: 5, feeDiscount: 0.003 },
  },
]

export const RIG_BY_ID: Record<string, RigDef> = Object.fromEntries(RIGS.map((r) => [r.id, r]))

export const SLOT_LABEL: Record<'head' | 'cloak' | 'blade', string> = {
  head: 'Headset',
  cloak: 'Coat',
  blade: 'Tools',
}

/* ==========================================================================
   Donation cosmetics

   Pure ownership/status. No stats, no edge swing, no bankroll, no XP.
   ========================================================================== */

export const DONATION_COSMETICS: CosmeticDef[] = [
  {
    id: 'cos_outfit_founder_hoodie',
    name: 'Founder Hoodie',
    category: 'outfit',
    icon: 'cloak',
    priceUsd: 2.99,
    priceStars: 149,
    rarity: 'standard',
    desc: 'A clean supporter hoodie for the profile. No better fills, just better taste.',
  },
  {
    id: 'cos_desk_carbon',
    name: 'Carbon Desk',
    category: 'desk',
    icon: 'terminal',
    priceUsd: 3.99,
    priceStars: 199,
    rarity: 'standard',
    desc: 'Dark desktop skin with a cold blue edge strip. Same desk, sharper mood.',
  },
  {
    id: 'cos_monitor_ultrawide',
    name: 'Ultrawide Monitor',
    category: 'monitor',
    icon: 'dice',
    priceUsd: 4.99,
    priceStars: 249,
    rarity: 'rare',
    desc: 'One absurd extra chart surface. It looks expensive and does absolutely no math.',
  },
  {
    id: 'cos_tool_founder_mug',
    name: 'Founder Mug',
    category: 'tool',
    icon: 'honey',
    priceUsd: 1.99,
    priceStars: 99,
    rarity: 'standard',
    desc: 'A tiny mug on the side table. Pure desk status. Still simulated coffee.',
  },
  {
    id: 'cos_room_city_loft',
    name: 'City Loft Skin',
    category: 'room',
    icon: 'torch',
    priceUsd: 6.99,
    priceStars: 349,
    rarity: 'rare',
    desc: 'Warmer skyline lighting and a cleaner apartment shell. Max still has to trade.',
  },
  {
    id: 'cos_room_neon_quant',
    name: 'Neon Quant Sign',
    category: 'room',
    icon: 'shard',
    priceUsd: 9.99,
    priceStars: 499,
    rarity: 'founder',
    desc: 'A rare neon room mark for early supporters. Loud status, zero advantage.',
  },
]

export const DONATION_COSMETIC_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(
  DONATION_COSMETICS.map((c) => [c.id, c]),
)

/* ==========================================================================
   Fresh save
   ========================================================================== */

export const START_BANKROLL = 300

export function freshSave(now: number): SaveData {
  return {
    version: SAVE_VERSION,
    name: WORLD.hero,
    loginMethod: null,
    walletAddress: null,
    walletChainId: null,
    walletConnectedAt: 0,
    onboarded: false,
    traderClass: null,
    achievements: {},
    stats: { edge: 40, focus: 62, heat: 18, rep: 8 },
    bankroll: START_BANKROLL,
    xp: 0,
    peakBankroll: START_BANKROLL,
    credits: 2,
    stash: { primer: 2, coffee: 1 },
    owned: RIGS.filter((r) => r.starter).map((r) => r.id),
    look: { head: 'head_none', cloak: 'cloak_rag', blade: 'blade_steel' },
    ownedCosmetics: [],
    activeCosmetics: {},
    tasks: freshTasks(now),
    markets: [],
    marketsAt: 0,
    hedgeUntil: 0,
    lastVisit: now,
    firstVisit: now,
    visits: 1,
    tally: {
      taps: 0,
      researches: 0,
      recovers: 0,
      hedges: 0,
      scans: 0,
      bets: 0,
      wins: 0,
      losses: 0,
      streak: 0,
      bestStreak: 0,
      bestWin: 0,
      worstLoss: 0,
    },
    settings: { sound: true, haptics: true, reduceMotion: false },
  }
}

/** Convenience for the refuse paths, so callers never build this by hand. */
export function refusal(message: string): ActionResult {
  return { ok: false, message }
}
