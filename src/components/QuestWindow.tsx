import { useEffect, useState } from 'react'
import { PixelBar } from './PixelBar'
import { PixelButton } from './PixelButton'
import { PixelIcon } from './PixelIcon'
import { PixelPanel } from './PixelPanel'
import { claimTask, closeQuests } from '../game/actions'
import { useGameState } from '../game/store'
import {
  PERIOD_LABEL,
  buildBucketViews,
  buildMilestoneViews,
  periodEndsAt,
  rewardChips,
} from '../game/tasks'
import type { TaskPeriod, TaskView } from '../game/types'
import { formatAway } from '../game/util'

/* ==========================================================================
   The quest window: a dim-and-dismiss overlay over the desk. Same three
   resetting buckets plus milestones as before, but folded into one tabbed
   panel so the desk stays visible behind it. Closes on scrim / ✕ / Esc /
   Telegram back (the last wired up by openQuests).
   ========================================================================== */

type QuestTab = TaskPeriod | 'milestone'

const TABS: { id: QuestTab; label: string }[] = [
  { id: 'daily', label: PERIOD_LABEL.daily },
  { id: 'weekly', label: PERIOD_LABEL.weekly },
  { id: 'monthly', label: PERIOD_LABEL.monthly },
  { id: 'milestone', label: 'Milestones' },
]

export function QuestWindow() {
  const s = useGameState()
  const open = s.questOpen
  const [tab, setTab] = useState<QuestTab>('daily')

  // land on the first tab each time the window opens
  useEffect(() => {
    if (open) setTab('daily')
  }, [open])

  // Esc closes, matching the scrim and ✕ paths
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQuests()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const now = Date.now()
  const views = tab === 'milestone' ? buildMilestoneViews(s) : buildBucketViews(s, tab)

  const meta = (() => {
    if (tab === 'milestone') {
      const reached = views.filter((v) => v.claimed).length
      return `${reached}/${views.length} reached`
    }
    const ready = views.filter((v) => v.done && !v.claimed).length
    if (ready > 0) return `${ready} ready to claim`
    return `resets ${formatAway(Math.max(0, periodEndsAt(tab, now) - now))}`
  })()

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Quests">
      <div className="modal__scrim" onClick={closeQuests} aria-hidden="true" />
      <PixelPanel
        variant="darkwood"
        title="Quests"
        titleIcon="check"
        rivets
        pad="sm"
        className="questwin__panel anim-pop"
        titleRight={
          <button
            type="button"
            className="questwin__x"
            aria-label="Close quests"
            onClick={closeQuests}
          >
            <PixelIcon name="close" size={14} />
          </button>
        }
      >
        <div className="tabs tabs--quest">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'is-on' : ''}`}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
            >
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="questwin__meta t-label t-dim">{meta}</div>

        <div className="questwin__list">
          {views.map((view) => (
            <TaskCard key={view.def.id} view={view} />
          ))}
          {tab === 'milestone' ? (
            <p className="questwin__note t-label t-dim">
              Career steps. Each one pays out once, the moment you reach it.
            </p>
          ) : null}
        </div>
      </PixelPanel>
    </div>
  )
}

function TaskCard({ view }: { view: TaskView }) {
  const { def, progress, target, done, claimed, pct } = view
  const chips = rewardChips(def.reward)
  const state = claimed ? 'is-claimed' : done ? 'is-done' : 'is-open'

  return (
    <div className={`taskcard ${state}`}>
      <div className="taskcard__icon">
        <PixelIcon name={claimed ? 'check' : def.icon} size={18} />
      </div>
      <div className="taskcard__body">
        <b>{def.name}</b>
        <span>{def.desc}</span>
        <PixelBar
          value={pct}
          color={done ? '#7bd88f' : '#f2b53c'}
          colorDark={done ? '#2f6b41' : '#8a5f18'}
          valueText={done ? 'Done' : `${Math.floor(progress)}/${target}`}
          size="sm"
          showValue
        />
        <div className="taskcard__rewards">
          {chips.map((chip, i) => (
            <span key={i} className="task-chip">
              <PixelIcon name={chip.icon} size={11} />
              {chip.text}
            </span>
          ))}
        </div>
      </div>
      <PixelButton
        label={claimed ? 'Claimed' : 'Claim'}
        icon={claimed ? 'check' : 'coin'}
        variant={claimed ? 'ghost' : done ? 'teal' : 'ghost'}
        size="sm"
        disabled={!done || claimed}
        onClick={() => claimTask(def.id)}
      />
    </div>
  )
}
