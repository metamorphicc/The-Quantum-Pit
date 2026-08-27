import { useEffect, useRef, useState } from 'react'
import { PixelButton } from '../components/PixelButton'
import { PixelIcon } from '../components/PixelIcon'
import { Ribbon } from '../components/Ribbon'
import { enterHall, setLoginIdentity } from '../game/actions'
import { GAME_VERSION, WORLD, traderClassById } from '../game/config'
import { bootLine } from '../game/copy'
import { useGame } from '../game/store'
import { unlockAudio } from '../game/sound'
import { formatAway } from '../game/util'
import { isTelegram, tgUserName, tgUsername } from '../telegram/telegram'
import { baseAccountAvailable, connectBaseAccount, shortAddress } from '../web3/baseAccount'
import { P } from '../styles/palette'
import { dither, px, pxa, pxLine, type Ctx } from '../render/draw'
import { drawWardenPortrait } from '../render/warden'
const TITLE_W = 132
const TITLE_H = 116

export function BootScreen() {
  const {
    look,
    stats,
    awayMs,
    visits,
    onboarded,
    traderClass,
    loginMethod,
    walletAddress,
  } = useGame((s) => ({
    look: s.look,
    stats: s.stats,
    awayMs: s.awayMs,
    visits: s.visits,
    onboarded: s.onboarded,
    traderClass: s.traderClass,
    loginMethod: s.loginMethod,
    walletAddress: s.walletAddress,
  }))
  const [line] = useState(() => bootLine())
  const [connecting, setConnecting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = TITLE_W
    canvas.height = TITLE_H
    ctx.imageSmoothingEnabled = false

    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      drawStarterDesk(ctx, now)
      drawWardenPortrait(ctx, TITLE_W / 2, TITLE_H - 12, look, now, stats)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [look, stats])

  const begin = () => {
    unlockAudio()
    enterHall()
  }

  useEffect(() => {
    if (!onboarded && loginMethod !== null) enterHall()
  }, [loginMethod, onboarded])

  const currentClass = traderClassById(traderClass)
  const telegramLabel = isTelegram() ? 'Continue with Telegram' : 'Continue as Guest'
  const telegramName = (() => {
    const first = tgUserName()
    const handle = tgUsername()
    if (first && handle) return `${first} (@${handle})`
    if (first) return first
    if (handle) return `@${handle}`
    return isTelegram() ? 'Telegram account' : 'Local browser'
  })()
  const identityLine =
    loginMethod === 'base'
      ? `Base Account ${shortAddress(walletAddress)}`
      : loginMethod === 'telegram'
        ? `Telegram ${telegramName}`
        : loginMethod === 'guest'
          ? 'Guest browser session'
          : 'Choose how to enter.'

  const chooseBase = async () => {
    unlockAudio()
    setAuthError(null)
    setConnecting(true)
    try {
      const wallet = await connectBaseAccount()
      setLoginIdentity('base', wallet)
      setConnecting(false)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not connect wallet.')
      setConnecting(false)
    }
  }

  const chooseLocal = () => {
    unlockAudio()
    setAuthError(null)
    setLoginIdentity(isTelegram() ? 'telegram' : 'guest')
  }

  return (
    <div className="boot">
      <div className="boot__vignette" aria-hidden="true" />

      <div className="boot__top">
        <p className="t-label t-dim boot__eyebrow">{WORLD.subtitle}</p>
        <h1 className="boot__title t-shadow">
          <span>Quantum</span>
          <span className="boot__title-small">- sim -</span>
          <span>Pit</span>
        </h1>
        <div className="boot__rule">
          <span />
          <PixelIcon name="terminal" size={14} />
          <span />
        </div>
      </div>

      <canvas ref={canvasRef} className="boot__art" aria-hidden="true" />

      <div className={`boot__bottom ${onboarded ? 'boot__bottom--resume' : 'boot__bottom--auth'}`}>
        {onboarded ? (
          <>
            <div className="boot__intro">
              <p>
                {currentClass
                  ? `${currentClass.name}: ${currentClass.desc}`
                  : 'Max is back at the desk. The book remembers the work.'}
              </p>
              <ul>
                <li>Research builds Edge.</li>
                <li>Break restores Focus and cools Heat.</li>
                <li>Rep lives in Profile for future social progression.</li>
              </ul>
            </div>

            <p className="t-body t-center boot__line">{line}</p>

            <PixelButton
              label={visits > 1 ? 'Back to the Desk' : 'Start at the Desk'}
              icon="terminal"
              variant="gold"
              size="lg"
              full
              onClick={begin}
            />

            {visits > 1 && awayMs > 60_000 ? (
              <div className="boot__away">
                <Ribbon tone="dark" size="sm">{`Away ${formatAway(awayMs)}`}</Ribbon>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="boot__intro boot__intro--welcome">
              <p>Max is 18. He has a tiny simulated bankroll and one desk in a rented room.</p>
              <ul>
                <li>You are trading paper prediction markets.</li>
                <li>The goal is to survive, level up, and grow the room around him.</li>
                <li>Wallet identity only. No real money, no real orders.</li>
              </ul>
            </div>

            <div className="boot__auth">
              <div className="boot__auth-head">
                <PixelIcon name={loginMethod === 'base' ? 'coin' : 'warden'} size={16} />
                <span>{identityLine}</span>
              </div>
              <div className="boot__auth-actions">
                <PixelButton
                  label={connecting ? 'Connecting...' : 'Connect Base Account'}
                  icon="coin"
                  variant={loginMethod === 'base' ? 'gold' : 'wood'}
                  size="sm"
                  full
                  disabled={connecting || !baseAccountAvailable()}
                  sublabel={baseAccountAvailable() ? 'wallet identity' : 'open in wallet browser'}
                  onClick={chooseBase}
                />
                <PixelButton
                  label={telegramLabel}
                  icon={isTelegram() ? 'warden' : 'terminal'}
                  variant={loginMethod === 'telegram' || loginMethod === 'guest' ? 'teal' : 'ghost'}
                  size="sm"
                  full
                  disabled={connecting}
                  sublabel={telegramName}
                  onClick={chooseLocal}
                />
              </div>
              {authError ? <p className="boot__auth-error">{authError}</p> : null}
            </div>

          </>
        )}

        <p className="t-label boot__version">
          v{GAME_VERSION} - {WORLD.disclaimer}
        </p>
      </div>
    </div>
  )
}

function drawStarterDesk(ctx: Ctx, t: number): void {
  px(ctx, 0, 0, TITLE_W, TITLE_H, '#070a0f')

  // apartment wall and city window
  px(ctx, 0, 0, TITLE_W, TITLE_H - 14, '#111820')
  for (let x = 0; x < TITLE_W; x += 14) {
    px(ctx, x, 0, 1, TITLE_H - 14, '#0b1017')
    pxa(ctx, x + 1, 0, 1, TITLE_H - 14, '#ffffff', 0.035)
  }
  px(ctx, 32, 8, 68, 43, '#07111f')
  px(ctx, 32, 8, 68, 2, P.plateLit)
  px(ctx, 64, 8, 2, 43, P.plateDark)
  px(ctx, 32, 29, 68, 2, P.plateDark)
  for (let i = 0; i < 7; i++) {
    const bx = 36 + i * 8
    const bh = 10 + ((i * 7) % 18)
    px(ctx, bx, 48 - bh, 5, bh, '#0d2132')
    if (i % 2 === 0) px(ctx, bx + 1, 45 - bh / 2, 3, 1, P.spiritLit)
  }

  // floor
  px(ctx, 0, TITLE_H - 14, TITLE_W, 14, P.stoneDark)
  px(ctx, 0, TITLE_H - 14, TITLE_W, 2, P.stoneLit)
  for (let x = 0; x < TITLE_W; x += 22) px(ctx, x, TITLE_H - 12, 1, 12, P.stoneDeep)

  // starter desk and monitors
  px(ctx, 18, 62, 96, 9, P.wood)
  px(ctx, 18, 62, 96, 2, P.woodHi)
  px(ctx, 18, 70, 96, 2, P.woodDeep)
  drawMiniMonitor(ctx, 33, 44, 25, 18, t, 0)
  drawMiniMonitor(ctx, 72, 40, 28, 21, t, 1)
  px(ctx, 56, 62, 22, 4, P.plateDeep)
  px(ctx, 87, 66, 12, 3, P.bone)
  pxLine(ctx, 49, 72, 31, 92, P.plateDeep, 1)
  pxLine(ctx, 82, 72, 104, 92, P.plateDeep, 1)

  dither(ctx, 0, 0, TITLE_W, 10, '#000000', 1, 0.35)
  dither(ctx, 0, TITLE_H - 6, TITLE_W, 6, '#000000', 1, 0.25)
}

function drawMiniMonitor(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, seed: number): void {
  px(ctx, x, y, w, h, P.plateDark)
  px(ctx, x, y, w, 1, P.plateLit)
  px(ctx, x + 2, y + 3, w - 4, h - 7, '#061018')
  const scan = Math.floor(t / 260 + seed * 3) % 6
  px(ctx, x + 5, y + 8, 6 + scan, 1, seed ? P.spiritLit : P.tealLit)
  pxLine(ctx, x + 4, y + h - 6, x + w - 5, y + 5 + scan, seed ? P.spiritLit : P.tealLit, 1)
  px(ctx, x + Math.floor(w / 2) - 1, y + h, 3, 5, P.plateDark)
}
