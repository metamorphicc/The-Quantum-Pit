import { useEffect, useRef, useState } from 'react'
import { FloatingTextLayer } from '../components/FloatingTextLayer'
import { PixelButton } from '../components/PixelButton'
import { PixelIcon } from '../components/PixelIcon'
import { PixelPanel } from '../components/PixelPanel'
import { ScreenHeader } from '../components/ScreenHeader'
import {
  isReady,
  isStale,
  effectiveFeeRate,
  marketCostWithRig,
  placeSimBet,
  previewFill,
  quoteFor,
  setScreen,
} from '../game/actions'
import { BET, MARKETS, MARKET_BY_ID, WORLD, traderClassById } from '../game/config'
import { getState, useGameState } from '../game/store'
import { formatCash, formatPrice, formatProb, formatSigned } from '../game/util'
import type { Side } from '../game/types'
import { DESK, drawDeskScene, type TerminalMode } from '../render/terminal'
export function BetScreen() {
  const s = useGameState()
  const [side, setSide] = useState<Side | null>(null)
  const [stake, setStake] = useState<number>(BET.sizes[0]!)

  const marketId = s.focusMarket ?? MARKETS[0]!.id
  const def = MARKET_BY_ID[marketId] ?? MARKETS[0]!
  const klass = traderClassById(s.traderClass)
  const favored = klass?.marketBias === def.category
  const quote = quoteFor(def.id)
  const stale = isStale(quote.quotedAt)

  const fill = previewFill(def.id, side ?? 'yes', stake)
  const cost = marketCostWithRig(def)
  const feeRate = effectiveFeeRate()
  const trade = s.lastTrade
  const resolving = s.activity.kind === 'bet'
  const hedged = Date.now() < s.hedgeUntil

  const affordable = stake <= s.bankroll
  const focused = s.stats.focus >= cost.focus
  const canFill = side !== null && affordable && focused && !resolving && isReady('fill')

  // whatever the machine should be showing right now
  const mode: TerminalMode = resolving
    ? 'resolving'
    : trade && trade.marketId === def.id
      ? trade.won
        ? 'won'
        : 'lost'
      : side
        ? 'armed'
        : 'idle'
const canvasRef = useRef<HTMLCanvasElement>(null)
  // read through a ref so the 60fps loop is never rebuilt by a re-render
  const view = useRef({ mode, prob: quote.prob, side })
  view.current = { mode, prob: quote.prob, side }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    canvas.width = DESK.w
    canvas.height = DESK.h
    ctx.imageSmoothingEnabled = false

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      // integer upscale, but never so tall that the ticket below is pushed off
      const byWidth = Math.floor(parent.clientWidth / DESK.w)
      const byHeight = Math.floor((window.innerHeight * 0.42) / DESK.h)
      const scale = Math.max(1, Math.min(byWidth, byHeight))
      canvas.style.width = `${DESK.w * scale}px`
      canvas.style.height = `${DESK.h * scale}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    // when the verdict landed, so the flash and the glow can decay
    let markedAt = performance.now()
    let markedMode: TerminalMode = view.current.mode

    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const live = getState()
      const v = view.current
      if (v.mode !== markedMode) {
        markedMode = v.mode
        markedAt = now
      }

      const act = live.activity
      const phase =
        v.mode === 'resolving' && act.duration > 0
          ? Math.min(1, (Date.now() - act.startedAt) / act.duration)
          : Math.min(1, (now - markedAt) / 900)

      drawDeskScene(ctx, {
        t: live.settings.reduceMotion ? 1200 : now,
        mode: v.mode,
        phase,
        prob: v.prob,
        side: v.side,
        heat: Math.max(0, (live.stats.heat - 40) / 60),
      })
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const submit = () => {
    if (!side) return
    placeSimBet(def.id, side, stake)
  }

  return (
    <div className="screen">
      <ScreenHeader title="Ticket" />

      <div className="screen__body train">
        <FloatingTextLayer />

        <div className="train__stage">
          <canvas
            ref={canvasRef}
            className="train__canvas"
            aria-label="A cathode terminal on a desk."
            role="img"
          />
        </div>

        <PixelPanel
          variant="darkwood"
          title={def.tag}
          titleIcon={def.icon}
          titleRight={
            <span className={`t-label ${stale ? 't-ember' : 't-dim'}`}>
              {stale ? 'stale' : formatProb(quote.prob)}
            </span>
          }
          pad="md"
          rivets
        >
          <p className="t-body detail__desc">{def.question}</p>

          <div className="ticket__sides">
            {(['yes', 'no'] as Side[]).map((k) => {
              const price = previewFill(def.id, k, stake).price
              return (
                <button
                  key={k}
                  type="button"
                  className={`sidebtn sidebtn--${k} ${side === k ? 'is-on' : ''}`}
                  onClick={() => setSide(k)}
                  aria-pressed={side === k}
                >
                  <span className="sidebtn__label">{k === 'yes' ? 'YES' : 'NO'}</span>
                  <span className="sidebtn__price">{formatPrice(price)}</span>
                </button>
              )
            })}
          </div>

          <div className="tabs tabs--tight">
            {BET.sizes.map((v) => (
              <button
                key={v}
                type="button"
                className={`tab ${stake === v ? 'is-on' : ''} ${v > s.bankroll ? 'is-off' : ''}`}
                onClick={() => setStake(v)}
              >
                <span>${v}</span>
              </button>
            ))}
          </div>

          <ul className="detail__gains ticket__preview">
            <li>
              <PixelIcon name="coin" size={12} />
              <span>Pays back</span>
              <b>{formatCash(Math.round(fill.payout))}</b>
            </li>
            <li className={side ? 'is-up' : ''}>
              <PixelIcon name="star" size={12} />
              <span>If it lands</span>
              <b>{formatSigned(Math.round(fill.profit - stake * feeRate))}</b>
            </li>
            <li className="is-down">
              <PixelIcon name="skull" size={12} />
              <span>If it does not</span>
              <b>{formatSigned(-stake)}</b>
            </li>
            {fill.slip > 0.005 ? (
              <li className="is-down">
                <PixelIcon name="flame" size={12} />
                <span>{stale ? 'Stale + heat slip' : 'Heat slip'}</span>
                <b>+{Math.round(fill.slip * 100)}c</b>
              </li>
            ) : null}
            {favored && klass ? (
              <li className="is-up">
                <PixelIcon name={klass.icon} size={12} />
                <span>{klass.short} class</span>
                <b>+{Math.round(klass.winBonus * 100)}%</b>
              </li>
            ) : null}
            {hedged ? (
              <li>
                <PixelIcon name="brush" size={12} />
                <span>Hedged</span>
                <b>dampened</b>
              </li>
            ) : null}
          </ul>

          <PixelButton
            label={
              resolving
                ? 'Printing...'
                : !side
                  ? 'Pick a side'
                  : !affordable
                    ? 'Not enough bankroll'
                    : !focused
                      ? 'Too fried to size it'
                      : `Send it - $${stake} ${side.toUpperCase()}`
            }
            icon="terminal"
            variant="ember"
            size="lg"
            full
            disabled={!canFill}
            sublabel={`Fee ${Math.round(feeRate * 1000) / 10}% - costs ${cost.focus} focus`}
            onClick={submit}
          />
        </PixelPanel>

        {trade ? (
          <PixelPanel
            variant="wood"
            title={trade.won ? 'Paid' : 'Cut'}
            titleIcon={trade.won ? 'coin' : 'skull'}
            pad="md"
            rivets
          >
            <p className="t-body detail__desc">{trade.question}</p>
            <ul className="detail__gains">
              <li className={trade.won ? 'is-up' : 'is-down'}>
                <PixelIcon name="coin" size={12} />
                <span>
                  {trade.stake} on {trade.side.toUpperCase()} at {formatPrice(trade.price)}
                </span>
                <b>{formatSigned(trade.pnl)}</b>
              </li>
              <li>
                <PixelIcon name="bag" size={12} />
                <span>{WORLD.cashName}</span>
                <b>{formatCash(s.bankroll)}</b>
              </li>
              <li className="is-up">
                <PixelIcon name="star" size={12} />
                <span>XP</span>
                <b>+{trade.xpGained}</b>
              </li>
              {trade.hedged ? (
                <li>
                  <PixelIcon name="brush" size={12} />
                  <span>Hedge dampened it</span>
                  <b>-</b>
                </li>
              ) : null}
            </ul>
          </PixelPanel>
        ) : null}

        <PixelButton
          label="Back to the board"
          icon="dice"
          variant="ghost"
          size="sm"
          full
          onClick={() => setScreen('scan')}
        />

        <p className="t-label t-dim t-center screen__foot">{WORLD.disclaimer}</p>
      </div>
    </div>
  )
}
