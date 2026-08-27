import { useState } from 'react'
import { CurrencyBar } from '../components/CurrencyBar'
import { FloatingTextLayer } from '../components/FloatingTextLayer'
import { PixelBar } from '../components/PixelBar'
import { PixelButton } from '../components/PixelButton'
import { PixelIcon } from '../components/PixelIcon'
import { PixelPanel } from '../components/PixelPanel'
import { Ribbon } from '../components/Ribbon'
import { RoomCanvas } from '../components/RoomCanvas'
import { QuestTracker } from '../components/QuestTracker'
import { SpeechBox } from '../components/SpeechBox'
import {
  claimDailyLoginReward,
  completeOnboarding,
  cooldownLeft,
  doAction,
  isAlarming,
  openQuests,
  setScreen,
  statusLine,
} from '../game/actions'
import {
  ACTIONS,
  BANKROLL_BAR,
  DESK_STAT_ORDER,
  NAME_MAX,
  STAT_HIGH,
  STATS,
  TRADER_CLASSES,
  WORLD,
  careerStatusForLevel,
  levelFromXp,
  sanitizeName,
} from '../game/config'
import { nextDailyLogin, rewardLabel } from '../game/daily'
import { bankrollHealth, useGameState } from '../game/store'
import { claimableCount } from '../game/tasks'
import { formatCash, formatSeconds } from '../game/util'
import type { TraderClassId } from '../game/types'
type TutorialTarget = 'status' | 'stats' | 'ticket' | 'tools' | 'utilities' | 'class'

const TUTORIAL_STEPS: {
  target: TutorialTarget
  title: string
  body: string
}[] = [
  {
    target: 'status',
    title: 'This line is your next move.',
    body: 'When the desk is calm it says no open ticket. If Heat spikes, Focus crashes, or bankroll hits zero, this line tells you what to fix first.',
  },
  {
    target: 'stats',
    title: 'These bars are the run.',
    body: 'Edge improves your odds. Focus pays for actions. Heat makes fills worse when it gets high. Bankroll is your simulated cash.',
  },
  {
    target: 'ticket',
    title: 'Ticket is the main button.',
    body: 'A ticket is a simulated trade. Wins pay normal XP, losses still teach him, but much slower.',
  },
  {
    target: 'tools',
    title: 'Research, Hedge, Break.',
    body: 'Research builds Edge. Hedge dampens the next fill. Break restores Focus and cools Heat. Use these before forcing another ticket.',
  },
  {
    target: 'utilities',
    title: 'Board and Side Job stay nearby.',
    body: 'Board scans markets. Side Job earns a little cash if the book gets wiped out. It is ugly work, but it keeps the game recoverable.',
  },
  {
    target: 'class',
    title: 'Pick the trader he starts as.',
    body: 'Your class gives a small stat boost, better odds in one market category, and makes those markets appear more often on the board.',
  },
]

export function RoomScreen() {
  const s = useGameState()
  const [tutorialStep, setTutorialStep] = useState(0)
  const [pickedClass, setPickedClass] = useState<TraderClassId>('crypto')
  const [nameDraft, setNameDraft] = useState(s.name)
  const [dailyOpen, setDailyOpen] = useState(true)
  const now = Date.now()
  const day = Math.max(1, Math.floor((now - s.firstVisit) / 86_400_000) + 1)
  const stashCount = Object.values(s.stash).reduce((a, b) => a + b, 0)
  const level = levelFromXp(s.xp)
  const career = careerStatusForLevel(level)
  const broke = s.bankroll <= 0
  const claimableTasks = claimableCount(s)
  const inTicket = s.activity.kind === 'bet'
  const hedgeOn = now < s.hedgeUntil
  const heatHigh = s.stats.heat >= STAT_HIGH
  const focusLow = s.stats.focus < 28
  const primaryId = broke ? 'sidejob' : 'bet'
  const tutorialOpen = !s.onboarded
  const tutorial = TUTORIAL_STEPS[Math.min(tutorialStep, TUTORIAL_STEPS.length - 1)]!
  const daily = nextDailyLogin(s, now)
  const dailyVisible = s.onboarded && dailyOpen && daily.claimable

  const claimDaily = () => {
    claimDailyLoginReward()
    setDailyOpen(false)
  }

  const plainStatus = (() => {
    if (broke) return 'Bankroll is gone. Take a side job.'
    if (inTicket) return "You're in a ticket. Hedge or ride it."
    if (hedgeOn) return 'Hedge is on. Next ticket is dampened.'
    if (heatHigh) return 'Heat is high. Take a break.'
    if (focusLow) return 'Focus is low. Take a break.'
    return 'No open ticket.'
  })()

  const actionState = (id: string) => {
    const def = ACTIONS[id]!
    const left = cooldownLeft(id, now)
    const req = def.requires
    const value = req ? s.stats[req.stat] : 0
    const blocked = req
      ? (req.min !== undefined && value < req.min) ||
        (req.max !== undefined && value > req.max)
      : false
    return { def, left, blocked }
  }

  const actionSub = (id: string, blocked: boolean, left: number): string | undefined => {
    if (left > 0) return formatSeconds(left)
    if (blocked) return 'not ready'
    if (id === 'bet') return 'take a trade'
    if (id === 'research') return 'improve edge'
    if (id === 'hedge') return inTicket || hedgeOn ? 'reduce risk' : 'risk prep'
    if (id === 'recover') return 'recover focus'
    if (id === 'sidejob') return broke ? 'earn money' : 'extra cash'
    if (id === 'scan') return 'scan markets'
    return undefined
  }

  const renderAction = (
    id: string,
    opts: { primary?: boolean; utility?: boolean; secondary?: boolean } = {},
  ) => {
    const { def, left, blocked } = actionState(id)
    const isPrimary = opts.primary
    const visuallyMutedHedge = id === 'hedge' && !inTicket && !hedgeOn
    return (
      <PixelButton
        key={id}
        label={id === 'bet' ? 'Ticket' : def.label}
        icon={def.icon}
        variant={
          isPrimary
            ? id === 'sidejob'
              ? 'gold'
              : 'ember'
            : opts.utility || opts.secondary || visuallyMutedHedge
              ? 'ghost'
              : 'wood'
        }
        size={isPrimary ? 'lg' : opts.utility || opts.secondary ? 'sm' : 'md'}
        full={isPrimary || opts.secondary}
        disabled={left > 0}
        badge={id === 'research' && stashCount > 0 ? String(stashCount) : undefined}
        sublabel={actionSub(id, blocked, left)}
        className={[
          isPrimary ? 'room__action-primary' : '',
          opts.utility ? 'room__action-utility' : '',
          opts.secondary ? 'room__action-secondary' : '',
          visuallyMutedHedge ? 'room__action-muted' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => doAction(id)}
      />
    )
  }

  return (
    <div className={`screen room ${tutorialOpen ? 'is-tutorial' : ''}`}>
      <header className="room__bar">
        <Ribbon size="sm">{WORLD.hall}</Ribbon>
        <span className="t-label t-dim room__day">Day {day}</span>
        <CurrencyBar bankroll={s.bankroll} credits={s.credits} compact />
      </header>

      <div className="room__stage">
        <RoomCanvas />
        <FloatingTextLayer />

        <button
          type="button"
          className="room__hero-tag"
          onClick={() => setScreen('profile')}
          aria-label="Open the trading record"
        >
          <span className="t-label t-gold">{s.name}</span>
          <span className="t-label t-dim">
            Lv. {level} - {career}
          </span>
        </button>

        <div className="room__speech">
          <SpeechBox text={s.line || statusLine(s.stats)} animKey={s.lineId} />
        </div>
      </div>

      <div className="room__hud">
        <div
          className={`room__status ${broke ? 'is-broke' : ''} ${tutorial.target === 'status' ? 'is-tutorial-target' : ''}`}
        >
          <span className="room__status-text">{plainStatus}</span>
          {renderAction('scan', { utility: true })}
        </div>

        <PixelPanel
          variant="darkwood"
          pad="sm"
          rivets
          className={tutorial.target === 'stats' ? 'is-tutorial-target' : ''}
        >
          <div className="room__bars">
            <div className="room__bars-head" aria-hidden="true">
              <span>Stat</span>
              <span>Gauge</span>
              <span>Value</span>
            </div>
            {DESK_STAT_ORDER.map((key) => {
              const meta = STATS[key]
              const value = s.stats[key]
              return (
                <PixelBar
                  key={key}
                  label={meta.label}
                  value={value}
                  color={meta.color}
                  colorDark={meta.colorDark}
                  low={isAlarming(key, value)}
                  showValue
                  size="sm"
                />
              )
            })}
            {/* the money line: a gauge against its own high-water mark, but it
                prints the actual number - a percentage of a peak is not a P&L */}
            <PixelBar
              label={BANKROLL_BAR.label}
              value={bankrollHealth(s.bankroll, s.peakBankroll)}
              color={BANKROLL_BAR.color}
              colorDark={BANKROLL_BAR.colorDark}
              low={s.bankroll < 25}
              valueText={formatCash(s.bankroll)}
              showValue
              size="sm"
            />
          </div>
        </PixelPanel>

        <div className={`room__trade-actions ${broke ? 'is-broke' : ''}`}>
          <div className={tutorial.target === 'ticket' ? 'is-tutorial-target' : ''}>
            {renderAction(primaryId, { primary: true })}
          </div>
          {!broke ? (
            <div className={`room__support-actions ${tutorial.target === 'tools' ? 'is-tutorial-target' : ''}`}>
              {renderAction('research')}
              {renderAction('hedge')}
              {renderAction('recover')}
            </div>
          ) : (
            <div
              className={`room__support-actions room__support-actions--broke ${tutorial.target === 'tools' ? 'is-tutorial-target' : ''}`}
            >
              {renderAction('bet')}
              {renderAction('research')}
              {renderAction('hedge')}
              {renderAction('recover')}
            </div>
          )}
        </div>

        {!broke ? (
          <div className={`room__sidejob-row ${tutorial.target === 'utilities' ? 'is-tutorial-target' : ''}`}>
            {renderAction('sidejob', { secondary: true })}
          </div>
        ) : null}

        <nav className="room__nav">
          <button type="button" className="navbtn" onClick={() => setScreen('shop')}>
            <PixelIcon name="bag" size={14} />
            <span>Desk</span>
          </button>
          <button type="button" className="navbtn" onClick={() => setScreen('rig')}>
            <PixelIcon name="helm" size={14} />
            <span>Setup</span>
          </button>
          <button type="button" className="navbtn" onClick={() => setScreen('profile')}>
            <PixelIcon name="warden" size={14} />
            <span>Record</span>
          </button>
          <button type="button" className="navbtn" onClick={() => openQuests()}>
            <PixelIcon name="check" size={14} />
            <span>Tasks</span>
            {claimableTasks > 0 ? <span className="navbtn__badge">{claimableTasks}</span> : null}
          </button>
          <button
            type="button"
            className={`navbtn navbtn--daily ${daily.claimable ? 'is-ready' : ''}`}
            onClick={() => {
              if (daily.claimable) claimDaily()
              else setDailyOpen(true)
            }}
          >
            <PixelIcon name="star" size={14} />
            <span>Daily</span>
            <span className="navbtn__badge">{daily.claimable ? '!' : s.dailyLogin.streak}</span>
          </button>
          <button type="button" className="navbtn" onClick={() => setScreen('settings')}>
            <PixelIcon name="gear" size={14} />
            <span>Office</span>
          </button>
        </nav>
      </div>

      {!tutorialOpen ? <QuestTracker /> : null}

      {dailyVisible ? (
        <div className="daily-login" role="dialog" aria-modal="true" aria-label="Daily login reward">
          <div className="daily-login__scrim" onClick={() => setDailyOpen(false)} aria-hidden="true" />
          <PixelPanel variant="darkwood" pad="md" rivets className="daily-login__panel">
            <div className="daily-login__head">
              <div className="daily-login__icon">
                <PixelIcon name="star" size={24} />
              </div>
              <div>
                <p className="t-label t-dim">Daily login streak</p>
                <h2>Day {daily.streak}</h2>
              </div>
            </div>
            <p className="daily-login__copy">
              Show up every day. Miss a day and the streak starts over.
            </p>
            <div className="daily-login__reward">
              <span>Today's desk bonus</span>
              <b>{rewardLabel(daily.reward)}</b>
            </div>
            <div className="daily-login__track" aria-label="Weekly streak progress">
              {Array.from({ length: 7 }, (_, i) => {
                const day = i + 1
                const active = day <= daily.reward.day
                return (
                  <span key={day} className={active ? 'is-on' : ''}>
                    {day}
                  </span>
                )
              })}
            </div>
            <div className="daily-login__actions">
              <button type="button" className="daily-login__skip" onClick={() => setDailyOpen(false)}>
                Later
              </button>
              <PixelButton label="Claim" icon="coin" variant="gold" size="sm" onClick={claimDaily} />
            </div>
          </PixelPanel>
        </div>
      ) : null}

      {tutorialOpen ? (
        <div className={`tutorial tutorial--${tutorial.target}`} role="dialog" aria-modal="true">
          <div className="tutorial__scrim" aria-hidden="true" />
          {tutorial.target !== 'class' ? <div className="tutorial__arrow" aria-hidden="true" /> : null}
          <div className="tutorial__panel">
            <div className="tutorial__portrait" aria-hidden="true">
              <PixelIcon name="warden" size={28} />
            </div>
            <div className="tutorial__copy">
              <p className="tutorial__name">
                {tutorial.target === 'class' ? sanitizeName(nameDraft) : s.name}
              </p>
              <h2>{tutorial.title}</h2>
              <p>{tutorial.body}</p>
              {tutorial.target === 'class' ? (
                <>
                  <label className="classpick__name">
                    <span>Trader name</span>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      maxLength={NAME_MAX}
                      spellCheck={false}
                      autoComplete="off"
                      autoCapitalize="words"
                    />
                  </label>
                  <div className="classpick classpick--tutorial">
                    {TRADER_CLASSES.map((klass) => (
                      <button
                        key={klass.id}
                        type="button"
                        className={`classpick__item ${pickedClass === klass.id ? 'is-on' : ''}`}
                        onClick={() => setPickedClass(klass.id)}
                        aria-pressed={pickedClass === klass.id}
                      >
                        <PixelIcon name={klass.icon} size={20} />
                        <span>
                          <b>{klass.name}</b>
                          <small>{klass.desc}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div className="tutorial__actions">
              <span className="tutorial__count">
                {tutorialStep + 1}/{TUTORIAL_STEPS.length}
              </span>
              <PixelButton
                label={
                  tutorial.target === 'class'
                    ? `Start as ${TRADER_CLASSES.find((klass) => klass.id === pickedClass)?.short ?? 'Trader'}`
                    : 'Next'
                }
                icon={tutorial.target === 'class' ? 'check' : 'plus'}
                variant={tutorial.target === 'class' ? 'gold' : 'teal'}
                size="sm"
                onClick={() => {
                  if (tutorial.target === 'class') completeOnboarding(pickedClass, nameDraft)
                  else setTutorialStep((n) => Math.min(n + 1, TUTORIAL_STEPS.length - 1))
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
