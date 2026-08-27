import type { DailyLoginReward, DailyLoginState, SaveData } from './types'

export const DAY_MS = 86_400_000

export const DAILY_LOGIN_REWARDS: DailyLoginReward[] = [
  { day: 1, bankroll: 20 },
  { day: 2, bankroll: 30 },
  { day: 3, bankroll: 40, credits: 1 },
  { day: 4, bankroll: 55, credits: 1 },
  { day: 5, bankroll: 70, credits: 2 },
  { day: 6, bankroll: 90, credits: 2, xp: 50 },
  { day: 7, bankroll: 120, credits: 3, xp: 120 },
]

export function dayIndex(now = Date.now()): number {
  return Math.floor(now / DAY_MS)
}

export function freshDailyLogin(now: number): DailyLoginState {
  return {
    streak: 0,
    bestStreak: 0,
    lastClaimDay: dayIndex(now) - 1,
  }
}

export function dailyRewardFor(streak: number): DailyLoginReward {
  const safeStreak = Math.max(1, Math.floor(streak))
  const cycleDay = ((safeStreak - 1) % DAILY_LOGIN_REWARDS.length) + 1
  const weekBonus = Math.floor((safeStreak - 1) / DAILY_LOGIN_REWARDS.length)
  const base = DAILY_LOGIN_REWARDS[cycleDay - 1]!

  return {
    day: cycleDay,
    bankroll: base.bankroll + weekBonus * 15,
    credits: (base.credits ?? 0) + (cycleDay === 7 ? weekBonus : 0),
    xp: (base.xp ?? 0) + weekBonus * 25,
  }
}

export function nextDailyLogin(state: Pick<SaveData, 'dailyLogin'>, now = Date.now()) {
  const today = dayIndex(now)
  const claimedToday = state.dailyLogin.lastClaimDay === today
  const continued = state.dailyLogin.lastClaimDay === today - 1
  const nextStreak = claimedToday ? state.dailyLogin.streak : continued ? state.dailyLogin.streak + 1 : 1

  return {
    today,
    claimable: !claimedToday,
    streak: nextStreak,
    reward: dailyRewardFor(nextStreak),
  }
}

export function rewardLabel(reward: DailyLoginReward): string {
  const parts = [`$${reward.bankroll}`]
  if (reward.credits) parts.push(`${reward.credits} Credits`)
  if (reward.xp) parts.push(`${reward.xp} XP`)
  return parts.join(' + ')
}
