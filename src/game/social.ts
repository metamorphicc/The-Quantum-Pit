import type { SocialState } from './types'

export const SOCIAL_POST_COOLDOWN = 20_000
export const SOCIAL_NOTE_COOLDOWN = 90_000

export const SOCIAL_TIERS = [
  { min: 0, title: 'Nobody' },
  { min: 15, title: 'Small Account' },
  { min: 35, title: 'Desk Poster' },
  { min: 60, title: 'Known Edge' },
  { min: 85, title: 'Timeline Signal' },
] as const

export function freshSocial(): SocialState {
  return {
    posts: 0,
    viralPosts: 0,
    backfires: 0,
    lastPostedTradeNo: 0,
    lastPostAt: 0,
  }
}

export function socialStatusForRep(rep: number): string {
  const safeRep = Math.max(0, Math.min(100, Math.floor(rep)))
  let status: string = SOCIAL_TIERS[0].title
  for (const tier of SOCIAL_TIERS) {
    if (safeRep >= tier.min) status = tier.title
  }
  return status
}
