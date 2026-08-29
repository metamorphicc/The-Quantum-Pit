import { useEffect, useRef } from 'react'
import { checkPnl, doAction, openQuests, propLine, say, setScreen } from '../game/actions'
import { burst, onFx } from '../game/fx'
import { play } from '../game/sound'
import { getState } from '../game/store'
import { ParticleSystem } from '../render/particles'
import { HOTSPOTS, SCENE, drawRoom, drawRoomOverlay, hitTest } from '../render/room'
import { drawWarden, poseFor } from '../render/warden'
import { px, pxa } from '../render/draw'
import { clamp } from '../game/util'
import { levelFromXp, progressionTierForLevel } from '../game/config'
/** Where particles appear when an fx event does not name a position. */
const CHEST_X = SCENE.heroX
const CHEST_Y = SCENE.heroY - 34

function drawBreakStatus(ctx: CanvasRenderingContext2D, phase: number): void {
  const fade = Math.min(1, Math.sin(clamp(phase * 2.6, 0, 1) * Math.PI * 0.5))
  pxa(ctx, 0, 0, SCENE.w, SCENE.h, '#02050a', 0.22 * fade)
  px(ctx, 49, 18, 94, 18, '#070a0f')
  px(ctx, 51, 20, 90, 14, '#101820')
  px(ctx, 51, 20, 90, 2, '#263747')
  px(ctx, 51, 32, 90, 2, '#02050a')
  ctx.save()
  ctx.globalAlpha *= fade
  ctx.fillStyle = '#e8dfc8'
  ctx.font = '8px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TAKING BREAK', SCENE.w / 2, 28)
  ctx.restore()
}

export function RoomCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scaleRef = useRef(2)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    canvas.width = SCENE.w
    canvas.height = SCENE.h
    ctx.imageSmoothingEnabled = false

    const particles = new ParticleSystem(SCENE.heroY + 14)
const resize = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (!w || !h) return
      const byWidth = Math.floor(w / SCENE.w)
      // never smaller than 2x - we crop the ceiling instead of shrinking him
      const scale = Math.max(2, Math.min(byWidth, Math.ceil(h / SCENE.h) + 1))
      scaleRef.current = scale
      canvas.style.width = `${SCENE.w * scale}px`
      canvas.style.height = `${SCENE.h * scale}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
let shake = 0
    const offFx = onFx((e) => {
      if (e.type === 'burst') {
        particles.spawn(e.kind, e.x ?? CHEST_X, e.y ?? CHEST_Y, e.count ?? 8, e.power ?? 1)
      } else if (e.type === 'shake') {
        shake = Math.max(shake, e.power ?? 1)
      }
    })
let raf = 0
    let last = performance.now()
    let ambient = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(64, now - last)
      last = now

      const s = getState()
      const reduce = s.settings.reduceMotion
      const act = s.activity
      const elapsed = Date.now() - act.startedAt
      const phase = act.duration > 0 ? clamp(elapsed / act.duration, 0, 1) : 1
      const kind = phase >= 1 ? 'idle' : act.kind

      // the desk goes to seed when he runs hot and stops looking after it
      const grime = s.stats.heat > 82 ? 2 : s.stats.heat > 58 ? 1 : 0
      // the room darkens while he is out cold in the chair
      const dim = kind === 'recover' ? Math.sin(clamp(phase * 2.4, 0, 1) * Math.PI * 0.5) * 0.55 : 0
      const edge = s.stats.edge / 100
      const tier = progressionTierForLevel(levelFromXp(s.xp)).tier

      const pose = poseFor({ activity: kind, phase, t: reduce ? 1200 : now, stats: s.stats })

      const opts = {
        t: reduce ? 0 : now,
        grime,
        dim,
        edge,
        tier,
        cosmetics: s.activeCosmetics,
        // his shadow walks to the mat with him and thins as he folds up
        heroShift: pose.shift,
        heroShadow: 1 - pose.sit * 0.72,
      }

      drawRoom(ctx, opts)
      drawWarden(ctx, SCENE.heroX, SCENE.heroY, pose, s.look, reduce ? 1200 : now)

      // ambient motes and tiny monitor static in the late-session air
      ambient += dt
      if (!reduce && ambient > 420) {
        ambient = 0
        particles.spawn(
          'dust',
          30 + Math.random() * 132,
          SCENE.heroY - 62 + Math.random() * 60,
          1,
          0.4,
        )
        if (Math.random() < 0.45) particles.spawn('spark', 62, HOTSPOTS.terminal.y + 12, 1, 0.45)
        if (Math.random() < 0.45) particles.spawn('spark', 132, HOTSPOTS.terminal.y + 10, 1, 0.45)
      }
      // steady sleep marks
      if (kind === 'recover' && phase > 0.2 && phase < 0.85 && Math.random() < dt / 900) {
        particles.spawn('zzz', SCENE.heroX - 48, SCENE.heroY - 40, 1, 0.8)
      }

      if (!reduce) particles.update(dt)
      particles.draw(ctx)

      drawRoomOverlay(ctx, opts)
      if (kind === 'recover') drawBreakStatus(ctx, phase)

      // screen shake, applied to the wrapper so the canvas stays pixel-aligned
      if (shake > 0.01) {
        shake = Math.max(0, shake - dt / 260)
        const amp = Math.round(shake * 4)
        const ox = ((Math.random() * 2 - 1) * amp) | 0
        const oy = ((Math.random() * 2 - 1) * amp) | 0
        canvas.style.transform = reduce ? '' : `translate(${ox}px, ${oy}px)`
      } else if (canvas.style.transform) {
        canvas.style.transform = ''
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      offFx()
    }
  }, [])
const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scale = scaleRef.current
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    const hit = hitTest(x, y)
    switch (hit) {
      case 'hero':
        checkPnl(x, y)
        break
      case 'terminal':
        say(propLine('terminal'))
        setScreen('scan')
        break
      case 'board':
        openQuests()
        break
      case 'urn':
        say(propLine('urn'))
        setScreen('research')
        break
      case 'bed':
        say(propLine('bed'))
        doAction('recover')
        break
      case 'torchL':
      case 'torchR':
        say(propLine(hit))
        play('spark')
        screenSpark(hit)
        break
      case 'door':
        say(propLine('door'))
        play('deny')
        break
      default:
        // empty floor / wall: a small acknowledgement so taps never feel dead
        play('click')
        break
    }
  }

  return (
    <div className="stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="stage__canvas"
        onPointerDown={onPointerDown}
        aria-label="The Desk. Tap the trader to check the PnL."
        role="img"
      />
    </div>
  )
}

/** Kick a few blue pixels off the window lights and cable tray. */
function screenSpark(which: 'torchL' | 'torchR'): void {
  const h = HOTSPOTS[which]
  burst('spark', { x: h.x + h.w / 2, y: h.y + 10, count: 7, power: 1.1 })
}
