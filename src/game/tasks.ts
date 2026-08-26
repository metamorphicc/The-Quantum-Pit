import type { IconName } from '../components/PixelIcon'
import type {
  SaveData,
  TaskBucketState,
  TaskDef,
  TaskMetric,
  TaskPeriod,
  TaskReward,
  TasksState,
  TaskView,
} from './types'
import { levelFromXp } from './config'

/* ==========================================================================
   Tasks

   Four buckets. Daily/weekly/monthly are periodic — they roll on a fixed
   rolling window and their progress is measured against a baseline captured
   when the window opened. Milestones are the career ladder: permanent,
   one-time, measured against absolute cumulative totals.

   Nothing here instruments the game loop. Progress is derived from the same
   monotonic counters the tally already keeps (bets, wins, scans, …) plus XP,
   so the whole system is a read over existing state plus a small persisted
   record of what has been claimed.
   ========================================================================== */

export const PERIODS: TaskPeriod[] = ['daily', 'weekly', 'monthly']

/** Rolling window lengths. Timezone-free on purpose: a window is just a slice
    of wall-clock time, floored, so there is no calendar maths to get wrong. */
export const PERIOD_MS: Record<TaskPeriod, number> = {
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30 * 86_400_000,
}

export const PERIOD_LABEL: Record<TaskPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

/** Which slice of time `now` falls in. A change of index means the bucket rolls. */
export function periodIndex(period: TaskPeriod, now: number): number {
  return Math.floor(now / PERIOD_MS[period])
}

/** Epoch ms at which the current window closes and the next one opens. */
export function periodEndsAt(period: TaskPeriod, now: number): number {
  return (periodIndex(period, now) + 1) * PERIOD_MS[period]
}

/* --------------------------------------------------------------------------
   Metrics — every one is monotonic (only ever goes up), which is what lets a
   periodic task measure "this window's activity" as current minus baseline.
   -------------------------------------------------------------------------- */

/** Counters that periodic baselines snapshot. Milestones read absolute totals. */
export const PERIODIC_METRICS: TaskMetric[] = [
  'bets',
  'wins',
  'scans',
  'researches',
  'hedges',
  'recovers',
  'taps',
  'xp',
]

export function metricValue(state: Pick<SaveData, 'xp' | 'tally'>, metric: TaskMetric): number {
  switch (metric) {
    case 'xp':
      return Math.max(0, Math.floor(state.xp))
    case 'level':
      return levelFromXp(state.xp)
    case 'bets':
      return state.tally.bets
    case 'wins':
      return state.tally.wins
    case 'losses':
      return state.tally.losses
    case 'scans':
      return state.tally.scans
    case 'researches':
      return state.tally.researches
    case 'hedges':
      return state.tally.hedges
    case 'recovers':
      return state.tally.recovers
    case 'taps':
      return state.tally.taps
    case 'bestStreak':
      return state.tally.bestStreak
    default:
      return 0
  }
}

/** The zero point for a freshly opened periodic window. */
export function snapshotBaseline(
  state: Pick<SaveData, 'xp' | 'tally'>,
): Partial<Record<TaskMetric, number>> {
  const out: Partial<Record<TaskMetric, number>> = {}
  for (const metric of PERIODIC_METRICS) out[metric] = metricValue(state, metric)
  return out
}

/** A fresh set of buckets, anchored to `now`. Used by freshSave and migration. */
export function freshTasks(now: number): TasksState {
  const bucket = (period: TaskPeriod): TaskBucketState => ({
    period: periodIndex(period, now),
    // A brand-new save has zero counters, so an empty baseline is already the
    // right zero point. Migration replaces this with a real snapshot.
    baseline: {},
    claimed: [],
  })
  return {
    daily: bucket('daily'),
    weekly: bucket('weekly'),
    monthly: bucket('monthly'),
    milestones: [],
  }
}

/* --------------------------------------------------------------------------
   The catalogue

   Periodic pools are larger than what shows at once; the active few rotate by
   window index, so the set is stable within a window and shifts across them.
   Rewards climb with the cadence: a daily is a nudge, a milestone is a payday.
   -------------------------------------------------------------------------- */

export const DAILY_TASKS: TaskDef[] = [
  {
    id: 'd_taps',
    category: 'daily',
    name: 'Check the tape',
    desc: 'Tap him for the PnL ten times.',
    icon: 'star',
    metric: 'taps',
    target: 10,
    reward: { credits: 1 },
  },
  {
    id: 'd_scan',
    category: 'daily',
    name: 'Read the board',
    desc: 'Scan the markets three times.',
    icon: 'dice',
    metric: 'scans',
    target: 3,
    reward: { credits: 1 },
  },
  {
    id: 'd_read',
    category: 'daily',
    name: 'Do the reading',
    desc: 'Work through two notes.',
    icon: 'stew',
    metric: 'researches',
    target: 2,
    reward: { xp: 60 },
  },
  {
    id: 'd_ticket',
    category: 'daily',
    name: 'Print tickets',
    desc: 'Settle three simulated tickets.',
    icon: 'terminal',
    metric: 'bets',
    target: 3,
    reward: { credits: 1 },
  },
  {
    id: 'd_win',
    category: 'daily',
    name: 'Two green',
    desc: 'Close two winning tickets.',
    icon: 'check',
    metric: 'wins',
    target: 2,
    reward: { credits: 2 },
  },
  {
    id: 'd_hedge',
    category: 'daily',
    name: 'Cover the leg',
    desc: 'Put on two hedges.',
    icon: 'brush',
    metric: 'hedges',
    target: 2,
    reward: { bankroll: 20 },
  },
  {
    id: 'd_break',
    category: 'daily',
    name: 'Cool the desk',
    desc: 'Take two breaks.',
    icon: 'bed',
    metric: 'recovers',
    target: 2,
    reward: { bankroll: 15 },
  },
  {
    id: 'd_xp',
    category: 'daily',
    name: 'Earn your keep',
    desc: 'Bank 150 XP today.',
    icon: 'bolt',
    metric: 'xp',
    target: 150,
    reward: { credits: 1 },
  },
]

export const WEEKLY_TASKS: TaskDef[] = [
  {
    id: 'w_tickets',
    category: 'weekly',
    name: 'Twenty-five tickets',
    desc: 'Settle twenty-five tickets this week.',
    icon: 'terminal',
    metric: 'bets',
    target: 25,
    reward: { credits: 4, xp: 200 },
  },
  {
    id: 'w_wins',
    category: 'weekly',
    name: 'A green week',
    desc: 'Close twelve winning tickets.',
    icon: 'check',
    metric: 'wins',
    target: 12,
    reward: { credits: 5, xp: 250 },
  },
  {
    id: 'w_scans',
    category: 'weekly',
    name: 'Watch the board',
    desc: 'Scan the markets twenty-five times.',
    icon: 'dice',
    metric: 'scans',
    target: 25,
    reward: { credits: 3 },
  },
  {
    id: 'w_reads',
    category: 'weekly',
    name: 'Build an edge',
    desc: 'Work through fifteen notes.',
    icon: 'stew',
    metric: 'researches',
    target: 15,
    reward: { credits: 3, xp: 150 },
  },
  {
    id: 'w_hedges',
    category: 'weekly',
    name: 'Stay covered',
    desc: 'Put on ten hedges.',
    icon: 'brush',
    metric: 'hedges',
    target: 10,
    reward: { credits: 3 },
  },
  {
    id: 'w_xp',
    category: 'weekly',
    name: 'Grind the ladder',
    desc: 'Bank 1,500 XP this week.',
    icon: 'bolt',
    metric: 'xp',
    target: 1500,
    reward: { credits: 6 },
  },
]

export const MONTHLY_TASKS: TaskDef[] = [
  {
    id: 'm_tickets',
    category: 'monthly',
    name: 'The hundred',
    desc: 'Settle one hundred tickets this month.',
    icon: 'terminal',
    metric: 'bets',
    target: 100,
    reward: { credits: 12, xp: 800 },
  },
  {
    id: 'm_wins',
    category: 'monthly',
    name: 'Fifty green',
    desc: 'Close fifty winning tickets.',
    icon: 'check',
    metric: 'wins',
    target: 50,
    reward: { credits: 15, xp: 1000 },
  },
  {
    id: 'm_scans',
    category: 'monthly',
    name: 'Eyes on the board',
    desc: 'Scan the markets one hundred times.',
    icon: 'dice',
    metric: 'scans',
    target: 100,
    reward: { credits: 10 },
  },
  {
    id: 'm_xp',
    category: 'monthly',
    name: 'A month of grind',
    desc: 'Bank 6,000 XP this month.',
    icon: 'bolt',
    metric: 'xp',
    target: 6000,
    reward: { credits: 14 },
  },
]

/** Career steps: permanent, one-time, measured against absolute totals. The
    level rungs mirror the career titles in CAREER_MILESTONES. */
export const MILESTONE_TASKS: TaskDef[] = [
  {
    id: 'ms_first_ticket',
    category: 'milestone',
    name: 'First ticket',
    desc: 'Settle your first simulated trade.',
    icon: 'terminal',
    metric: 'bets',
    target: 1,
    reward: { credits: 2 },
  },
  {
    id: 'ms_amateur',
    category: 'milestone',
    name: 'Make Amateur',
    desc: 'Reach level 6.',
    icon: 'bolt',
    metric: 'level',
    target: 6,
    reward: { credits: 5, bankroll: 100 },
  },
  {
    id: 'ms_intern',
    category: 'milestone',
    name: 'Research Intern',
    desc: 'Reach level 11.',
    icon: 'stew',
    metric: 'level',
    target: 11,
    reward: { credits: 8, bankroll: 150 },
  },
  {
    id: 'ms_junior',
    category: 'milestone',
    name: 'Junior Quant',
    desc: 'Reach level 16.',
    icon: 'star',
    metric: 'level',
    target: 16,
    reward: { credits: 12, bankroll: 250 },
  },
  {
    id: 'ms_desk',
    category: 'milestone',
    name: 'Desk Trader',
    desc: 'Reach level 21.',
    icon: 'crown',
    metric: 'level',
    target: 21,
    reward: { credits: 16, bankroll: 400 },
  },
  {
    id: 'ms_quant',
    category: 'milestone',
    name: 'Quant Trader',
    desc: 'Reach level 26.',
    icon: 'crown',
    metric: 'level',
    target: 26,
    reward: { credits: 24, bankroll: 600 },
  },
  {
    id: 'ms_tickets_50',
    category: 'milestone',
    name: 'Fifty tickets deep',
    desc: 'Settle fifty tickets in all.',
    icon: 'terminal',
    metric: 'bets',
    target: 50,
    reward: { credits: 6 },
  },
  {
    id: 'ms_tickets_250',
    category: 'milestone',
    name: 'Desk regular',
    desc: 'Settle two hundred and fifty tickets in all.',
    icon: 'terminal',
    metric: 'bets',
    target: 250,
    reward: { credits: 14 },
  },
  {
    id: 'ms_tickets_1000',
    category: 'milestone',
    name: 'Thousand tickets',
    desc: 'Settle one thousand tickets in all.',
    icon: 'shard',
    metric: 'bets',
    target: 1000,
    reward: { credits: 40, xp: 2000 },
  },
  {
    id: 'ms_wins_100',
    category: 'milestone',
    name: 'A hundred green',
    desc: 'Close one hundred winning tickets in all.',
    icon: 'check',
    metric: 'wins',
    target: 100,
    reward: { credits: 18 },
  },
  {
    id: 'ms_streak_5',
    category: 'milestone',
    name: 'Run of five',
    desc: 'Reach a five-win streak.',
    icon: 'flame',
    metric: 'bestStreak',
    target: 5,
    reward: { credits: 6 },
  },
  {
    id: 'ms_streak_10',
    category: 'milestone',
    name: 'Run of ten',
    desc: 'Reach a ten-win streak.',
    icon: 'torch',
    metric: 'bestStreak',
    target: 10,
    reward: { credits: 15 },
  },
]

const POOLS: Record<TaskPeriod, TaskDef[]> = {
  daily: DAILY_TASKS,
  weekly: WEEKLY_TASKS,
  monthly: MONTHLY_TASKS,
}

/** How many of each pool are live in a window. */
const PICKS: Record<TaskPeriod, number> = { daily: 3, weekly: 3, monthly: 2 }

/** The tasks live in a given window. Deterministic in the window index, so a
    save reload shows the same set and no random source is needed. */
export function activeTasksFor(period: TaskPeriod, windowIndex: number): TaskDef[] {
  const pool = POOLS[period]
  const count = PICKS[period]
  if (pool.length <= count) return pool
  const offset = ((windowIndex % pool.length) + pool.length) % pool.length
  const out: TaskDef[] = []
  for (let i = 0; i < count; i++) out.push(pool[(offset + i) % pool.length])
  return out
}

const TASK_BY_ID: Record<string, TaskDef> = Object.fromEntries(
  [...DAILY_TASKS, ...WEEKLY_TASKS, ...MONTHLY_TASKS, ...MILESTONE_TASKS].map((t) => [t.id, t]),
)

export function taskById(id: string): TaskDef | undefined {
  return TASK_BY_ID[id]
}

/* --------------------------------------------------------------------------
   Views — everything a screen or the nav badge needs, derived from state.
   -------------------------------------------------------------------------- */

function toView(def: TaskDef, raw: number, claimed: boolean): TaskView {
  const progress = Math.max(0, Math.min(def.target, raw))
  return {
    def,
    progress,
    target: def.target,
    done: raw >= def.target,
    claimed,
    pct: def.target > 0 ? Math.min(100, Math.round((progress / def.target) * 100)) : 100,
  }
}

export function buildBucketViews(state: SaveData, period: TaskPeriod): TaskView[] {
  const bucket = state.tasks[period]
  return activeTasksFor(period, bucket.period).map((def) => {
    const base = bucket.baseline[def.metric] ?? 0
    return toView(def, metricValue(state, def.metric) - base, bucket.claimed.includes(def.id))
  })
}

export function buildMilestoneViews(state: SaveData): TaskView[] {
  return MILESTONE_TASKS.map((def) =>
    toView(def, metricValue(state, def.metric), state.tasks.milestones.includes(def.id)),
  )
}

export function findTaskView(state: SaveData, id: string): TaskView | null {
  const def = taskById(id)
  if (!def) return null
  if (def.category === 'milestone') {
    return buildMilestoneViews(state).find((v) => v.def.id === id) ?? null
  }
  return buildBucketViews(state, def.category).find((v) => v.def.id === id) ?? null
}

/** How many tasks are done and waiting to be claimed — drives the nav badge. */
export function claimableCount(state: SaveData): number {
  let n = 0
  for (const period of PERIODS) {
    for (const view of buildBucketViews(state, period)) {
      if (view.done && !view.claimed) n++
    }
  }
  for (const view of buildMilestoneViews(state)) {
    if (view.done && !view.claimed) n++
  }
  return n
}

/** Reward broken into display chips. Icons match the rest of the HUD:
    credits are shards, bankroll is a coin, XP is a star. */
export function rewardChips(reward: TaskReward): { icon: IconName; text: string }[] {
  const chips: { icon: IconName; text: string }[] = []
  if (reward.credits) chips.push({ icon: 'shard', text: `${reward.credits}` })
  if (reward.bankroll) chips.push({ icon: 'coin', text: `$${reward.bankroll}` })
  if (reward.xp) chips.push({ icon: 'star', text: `${reward.xp} XP` })
  return chips
}
