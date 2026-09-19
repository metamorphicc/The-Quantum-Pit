import { checkPnl, doAction, openQuests, propLine, say, setScreen } from '../game/actions'
import { levelFromXp, progressionTierForLevel } from '../game/config'
import { play } from '../game/sound'
import { useGameState } from '../game/store'

function sayAndOpen(line: 'terminal' | 'urn' | 'bed' | 'door', screen?: 'scan' | 'research') {
  say(propLine(line))
  if (screen) setScreen(screen)
}

export function RoomCanvas() {
  const s = useGameState()
  const level = levelFromXp(s.xp)
  const tier = progressionTierForLevel(level).tier
  const heatTone = s.stats.heat > 82 ? 'hot' : s.stats.heat > 58 ? 'warm' : 'calm'
  const resting = s.activity.kind === 'recover'
  const className = [
    'stage',
    'stage--dom',
    'trader-room',
    `trader-room--tier-${tier}`,
    `trader-room--${heatTone}`,
    resting ? 'is-resting' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const openTerminal = () => {
    play('click')
    sayAndOpen('terminal', 'scan')
  }

  const openResearch = () => {
    play('click')
    sayAndOpen('urn', 'research')
  }

  const takeBreak = () => {
    play('click')
    say(propLine('bed'))
    doAction('recover')
  }

  return (
    <div className={className} aria-label="The Desk. Tap the trader to check the PnL.">
      <div className="trader-room__skyline" aria-hidden="true">
        <span className="trader-room__tower trader-room__tower--a" />
        <span className="trader-room__tower trader-room__tower--b" />
        <span className="trader-room__tower trader-room__tower--c" />
        <span className="trader-room__tower trader-room__tower--d" />
        <span className="trader-room__passer trader-room__passer--one" />
        <span className="trader-room__passer trader-room__passer--two" />
      </div>

      <button
        type="button"
        className="trader-room__hotspot trader-room__board"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={openQuests}
        aria-label="Open quests"
      >
        <span>QUESTS</span>
        <i />
        <i />
        <i />
      </button>

      <button
        type="button"
        className="trader-room__hotspot trader-room__screens"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={openTerminal}
        aria-label="Scan markets"
      >
        <span className="trader-room__monitor trader-room__monitor--left">
          <i />
          <i />
          <i />
        </span>
        <span className="trader-room__monitor trader-room__monitor--main">
          <i />
          <i />
          <i />
          <b />
        </span>
        <span className="trader-room__monitor trader-room__monitor--right">
          <i />
          <i />
        </span>
      </button>

      <button
        type="button"
        className="trader-room__hotspot trader-room__notes"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={openResearch}
        aria-label="Research notes"
      >
        <span />
        <i />
        <i />
      </button>

      <button
        type="button"
        className="trader-room__hotspot trader-room__chair"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={takeBreak}
        aria-label="Take a break"
      >
        <span />
      </button>

      <div className="trader-room__desk" aria-hidden="true">
        <span className="trader-room__cable trader-room__cable--one" />
        <span className="trader-room__cable trader-room__cable--two" />
        <span className="trader-room__keyboard" />
        <span className="trader-room__mug" />
      </div>

      <button
        type="button"
        className="trader-room__avatar"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => checkPnl(96, 160)}
        aria-label="Check PnL"
      >
        <span className="trader-room__shadow" />
        <span className="trader-room__legs">
          <i />
          <i />
        </span>
        <span className="trader-room__body">
          <i className="trader-room__tie" />
          <i className="trader-room__arm trader-room__arm--left" />
          <i className="trader-room__arm trader-room__arm--right" />
        </span>
        <span className="trader-room__head">
          <i className="trader-room__hair" />
          <i className="trader-room__eye trader-room__eye--left" />
          <i className="trader-room__eye trader-room__eye--right" />
        </span>
      </button>

      {resting ? (
        <div className="trader-room__rest" aria-hidden="true">
          <span>TAKING BREAK</span>
          <i>Z</i>
          <i>Z</i>
          <i>Z</i>
        </div>
      ) : null}

      <div className="trader-room__floor" aria-hidden="true" />
    </div>
  )
}
