import { PixelIcon } from './PixelIcon'
import { openQuests } from '../game/actions'
import { useGameState } from '../game/store'
import { claimableCount, trackedTasks } from '../game/tasks'

/* ==========================================================================
   The desk quest tracker: a small, non-blocking HUD pinned to the right of
   the room. Shows the few most relevant quests (claimable first) and taps
   through to the full quest window. Hidden during onboarding and when there
   is nothing to track.
   ========================================================================== */

export function QuestTracker() {
  const s = useGameState()
  const tracked = trackedTasks(s, 3)
  if (tracked.length === 0) return null
  const claimable = claimableCount(s)

  return (
    <button type="button" className="quest-tracker" onClick={openQuests} aria-label="Open quests">
      <div className="quest-tracker__head">
        <PixelIcon name="check" size={12} />
        <span>Quests</span>
        {claimable > 0 ? <span className="quest-tracker__badge">{claimable}</span> : null}
      </div>
      {tracked.map((v) => (
        <div key={v.def.id} className={`quest-track ${v.done ? 'is-claimable' : ''}`}>
          <PixelIcon name={v.done ? 'coin' : v.def.icon} size={12} />
          <span className="quest-track__label">{v.def.name}</span>
          <span className="quest-track__pct">{v.done ? 'Claim' : `${Math.round(v.pct)}%`}</span>
        </div>
      ))}
    </button>
  )
}
