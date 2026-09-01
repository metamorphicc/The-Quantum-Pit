import type { AchievementDef, AchievementId, GameState } from './types'
import { levelFromXp } from './config'

export interface AchievementContext {
  zeroRecovered?: boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-desk',
    tokenId: 1,
    name: 'First Desk',
    desc: 'Picked a trader class and sat down at the simulated desk.',
    icon: 'terminal',
    rarity: 'common',
  },
  {
    id: 'base-linked',
    tokenId: 2,
    name: 'Base Identity',
    desc: 'Entered the room with a Base Account wallet identity.',
    icon: 'coin',
    rarity: 'common',
    onchainClaimable: true,
  },
  {
    id: 'first-scan',
    tokenId: 3,
    name: 'Board Reader',
    desc: 'Scanned the board for the first batch of fake markets.',
    icon: 'dice',
    rarity: 'common',
  },
  {
    id: 'first-ticket',
    tokenId: 4,
    name: 'First Ticket',
    desc: 'Settled the first simulated trade.',
    icon: 'terminal',
    rarity: 'common',
  },
  {
    id: 'first-win',
    tokenId: 5,
    name: 'First Green',
    desc: 'Closed the first profitable simulated ticket.',
    icon: 'check',
    rarity: 'common',
  },
  {
    id: 'zero-recovery',
    tokenId: 6,
    name: 'Back From Zero',
    desc: 'Recovered from an empty bankroll with a side job.',
    icon: 'bag',
    rarity: 'rare',
  },
  {
    id: 'ten-wins',
    tokenId: 7,
    name: 'Ten Clean Wins',
    desc: 'Built a record with ten profitable simulated fills.',
    icon: 'star',
    rarity: 'rare',
  },
  {
    id: 'hundred-tickets',
    tokenId: 8,
    name: 'Hundred Tickets',
    desc: 'Settled one hundred simulated trades.',
    icon: 'stew',
    rarity: 'epic',
  },
  {
    id: 'level-5',
    tokenId: 105,
    name: 'Level 5',
    desc: 'Made it through the first career stretch.',
    icon: 'bolt',
    rarity: 'common',
  },
  {
    id: 'level-10',
    tokenId: 110,
    name: 'Level 10',
    desc: 'Stopped looking completely new at the desk.',
    icon: 'bolt',
    rarity: 'common',
  },
  {
    id: 'level-15',
    tokenId: 115,
    name: 'Level 15',
    desc: 'Turned the starter routine into a real grind.',
    icon: 'star',
    rarity: 'rare',
  },
  {
    id: 'level-20',
    tokenId: 120,
    name: 'Level 20',
    desc: 'Reached the serious workstation era.',
    icon: 'star',
    rarity: 'rare',
  },
  {
    id: 'level-25',
    tokenId: 125,
    name: 'Level 25',
    desc: 'Started looking like he belongs in the pit.',
    icon: 'shard',
    rarity: 'epic',
  },
  {
    id: 'level-30',
    tokenId: 130,
    name: 'Level 30',
    desc: 'Capped the current career path.',
    icon: 'crown',
    rarity: 'epic',
  },
]

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
) as Record<AchievementId, AchievementDef>

const LEVEL_BADGES: { id: AchievementId; level: number }[] = [
  { id: 'level-5', level: 5 },
  { id: 'level-10', level: 10 },
  { id: 'level-15', level: 15 },
  { id: 'level-20', level: 20 },
  { id: 'level-25', level: 25 },
  { id: 'level-30', level: 30 },
]

export function eligibleAchievementIds(
  state: GameState,
  context: AchievementContext = {},
): AchievementId[] {
  const ids: AchievementId[] = []
  const level = levelFromXp(state.xp)

  if (state.onboarded && state.traderClass) ids.push('first-desk')
  if (state.loginMethod === 'base' && state.walletAddress) ids.push('base-linked')
  if (state.tally.scans >= 1) ids.push('first-scan')
  if (state.tally.bets >= 1) ids.push('first-ticket')
  if (state.tally.wins >= 1) ids.push('first-win')
  if (context.zeroRecovered) ids.push('zero-recovery')
  if (state.tally.wins >= 10) ids.push('ten-wins')
  if (state.tally.bets >= 100) ids.push('hundred-tickets')

  for (const badge of LEVEL_BADGES) {
    if (level >= badge.level) ids.push(badge.id)
  }

  return ids.filter((id) => !state.achievements[id])
}
