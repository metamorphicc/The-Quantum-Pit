import type { SaveData, TaskMetric } from './types'
import { metricValue } from './tasks'

export type BadHabitId = 'no-thesis' | 'blind-clicking' | 'overtrading' | 'chasing-losses'

export interface BadHabitWarning {
  id: BadHabitId
  message: string
}

export interface BadHabitPenalty extends BadHabitWarning {
  focus: number
  heat: number
}

function sessionValue(state: SaveData, metric: TaskMetric): number {
  const base = state.tasks.session.baseline[metric] ?? 0
  return Math.max(0, metricValue(state, metric) - base)
}

export function badHabitWarning(state: SaveData): BadHabitWarning | null {
  const bets = sessionValue(state, 'bets')
  if (bets < 2) return null

  const scans = sessionValue(state, 'scans')
  const researches = sessionValue(state, 'researches')
  const losses = sessionValue(state, 'losses')
  const recovers = sessionValue(state, 'recovers')

  if (losses >= 2 && recovers === 0 && state.stats.heat >= 45) {
    return {
      id: 'chasing-losses',
      message: 'Chasing losses. Take a break before another ticket.',
    }
  }

  if (researches === 0) {
    return {
      id: 'no-thesis',
      message: 'No thesis. Research before forcing more tickets.',
    }
  }

  if (scans === 0) {
    return {
      id: 'blind-clicking',
      message: 'Blind clicking. Scan the board before the next ticket.',
    }
  }

  if (bets >= 4 && bets > scans + researches + 1) {
    return {
      id: 'overtrading',
      message: 'Overtrading. Slow down, read, or cool the desk.',
    }
  }

  return null
}

export function badHabitPenalty(state: SaveData): BadHabitPenalty | null {
  const warning = badHabitWarning(state)
  if (!warning) return null

  switch (warning.id) {
    case 'chasing-losses':
      return { ...warning, focus: 1, heat: 4 }
    case 'no-thesis':
      return { ...warning, focus: 2, heat: 1 }
    case 'blind-clicking':
      return { ...warning, focus: 2, heat: 2 }
    case 'overtrading':
      return { ...warning, focus: 1, heat: 3 }
  }
}
