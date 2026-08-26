import { useEffect } from 'react'
import { PixelBar } from '../components/PixelBar'
import { PixelButton } from '../components/PixelButton'
import { PixelIcon } from '../components/PixelIcon'
import { PixelPanel } from '../components/PixelPanel'
import { ScreenHeader } from '../components/ScreenHeader'
import { claimTask, refreshTasks, setScreen } from '../game/actions'
import { WORLD } from '../game/config'
import { useGameState } from '../game/store'
import {
  PERIOD_LABEL,
  PERIODS,
  buildBucketViews,
  buildMilestoneViews,
  periodEndsAt,
  rewardChips,
} from '../game/tasks'
import type { IconName } from '../components/PixelIcon'
import type { TaskPeriod, TaskView } from '../game/types'
import { formatAway } from '../game/util'

/* ==========================================================================
   Tasks: three resetting buckets plus the career-step milestones. Progress is
   read live off the same state the rest of the desk uses; the only thing to do
   here is claim what is done.
   ========================================================================== */

const PERIOD_ICON: Record<TaskPeriod, IconName> = {
  daily: 'star',
  weekly: 'flame',
  monthly: 'crown',
}

export function TasksScreen() {
  const s = useGameState()

  // Opening the screen is a natural moment to roll any window that expired while
  // the app was away — the 1s tick deliberately leaves this alone.
  useEffect(() => {
    refreshTasks()
  }, [])

  const now = Date.now()

  return (
    <div className="screen">
      <ScreenHeader title="Tasks" />

      <div className="screen__body">
        {PERIODS.map((period) => {
          const views = buildBucketViews(s, period)
          const ready = views.filter((v) => v.done && !v.claimed).length
          const msLeft = Math.max(0, periodEndsAt(period, now) - now)
          return (
            <PixelPanel
              key={period}
              variant="darkwood"
              title={PERIOD_LABEL[period]}
              titleIcon={PERIOD_ICON[period]}
              pad="md"
              rivets
              titleRight={
                <span className={`t-label ${ready > 0 ? 't-gold' : 't-dim'}`}>
                  {ready > 0 ? `${ready} to claim` : `resets ${formatAway(msLeft)}`}
                </span>
              }
            >
              <div className="tasks">
                {views.map((view) => (
                  <TaskCard key={view.def.id} view={view} />
                ))}
              </div>
            </PixelPanel>
          )
        })}

        {(() => {
          const views = buildMilestoneViews(s)
          const done = views.filter((v) => v.claimed).length
          return (
            <PixelPanel
              variant="wood"
              title="Milestones"
              titleIcon="warden"
              pad="md"
              rivets
              titleRight={
                <span className="t-label t-dim">
                  {done}/{views.length}
                </span>
              }
            >
              <div className="tasks">
                {views.map((view) => (
                  <TaskCard key={view.def.id} view={view} />
                ))}
              </div>
              <p className="t-label t-dim">
                Career steps. Each one pays out once, the moment you reach it.
              </p>
            </PixelPanel>
          )
        })()}

        <PixelButton
          label={`Back to ${WORLD.hall}`}
          icon="arrowLeft"
          variant="wood"
          size="sm"
          full
          onClick={() => setScreen('room')}
        />
      </div>
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
