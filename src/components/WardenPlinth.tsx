import { useEffect, useRef } from 'react'
import { levelFromXp, progressionTierForLevel } from '../game/config'
import { getState } from '../game/store'
import { dither, px, pxa, pxLine, type Ctx } from '../render/draw'
import { drawWardenPortrait } from '../render/warden'
import { P } from '../styles/palette'
export interface WardenPlinthProps {
  /** pixel width of the backing buffer */
  width?: number
  /** pixel height of the backing buffer */
  height?: number
  className?: string
}

export function WardenPlinth({
  width = 132,
  height = 96,
  className = 'plinth__canvas',
}: WardenPlinthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = width
    canvas.height = height
    ctx.imageSmoothingEnabled = false

    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      // read live so equipping a piece shows up on the very next frame
      const s = getState()
      const t = s.settings.reduceMotion ? 1200 : now
      const tier = progressionTierForLevel(levelFromXp(s.xp)).tier
      drawAlcove(ctx, width, height, t, tier)
      drawWardenPortrait(ctx, width / 2, height - 8, s.look, t, s.stats, tier)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [width, height])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

/** Wardrobe preview: mirror, clothes rail, shelves, boxes, and a clean step. */
function drawAlcove(ctx: Ctx, w: number, h: number, t: number, tier: number): void {
  px(ctx, 0, 0, w, h, '#070a0f')

  // matte closet wall, not wooden planks
  px(ctx, 4, 4, w - 8, h - 17, '#101821')
  px(ctx, 4, 4, w - 8, 2, P.plateLit)
  px(ctx, 4, 4, 2, h - 17, P.ink)
  px(ctx, w - 6, 4, 2, h - 17, P.ink)

  // side mirror
  px(ctx, 8, 12, 22, h - 33, '#081320')
  px(ctx, 8, 12, 2, h - 33, P.plateLit)
  px(ctx, 28, 12, 2, h - 33, P.plateDeep)
  pxa(ctx, 12, 18, 9, h - 45, P.spiritPale, 0.1)
  pxLine(ctx, 13, 19, 24, 36, P.spiritDeep, 1)
  pxLine(ctx, 11, 45, 21, 59, P.spiritDeep, 1)

  // open wardrobe rail and hanging starter clothes
  px(ctx, 37, 14, 74, 3, P.plateDeep)
  px(ctx, 37, 14, 74, 1, P.plateLit)
  px(ctx, 38, 17, 2, 50, '#0b1017')
  px(ctx, 109, 17, 2, 50, '#0b1017')
  const sway = Math.sin(t / 900) > 0 ? 1 : 0
  const clothes = [
    { x: 44, w: 11, c: '#253646', lit: '#40536a' },
    { x: 58, w: 10, c: '#1d2935', lit: '#344457' },
    { x: 83, w: 9, c: '#d7dccf', lit: P.white },
    { x: 95, w: 10, c: '#203049', lit: '#3b516d' },
    ...(tier >= 2 ? [{ x: 72, w: 8, c: '#314052', lit: P.plateLit }] : []),
    ...(tier >= 4 ? [{ x: 32, w: 8, c: '#111820', lit: P.tealDeep }] : []),
    ...(tier >= 5 ? [{ x: 112, w: 9, c: '#16273a', lit: P.spiritDeep }] : []),
  ]
  for (const item of clothes) {
    pxLine(ctx, item.x + Math.floor(item.w / 2), 17, item.x + Math.floor(item.w / 2) - 3, 21, P.plateLit, 1)
    px(ctx, item.x + sway, 21, item.w, 34, item.c)
    px(ctx, item.x + sway, 21, item.w, 1, item.lit)
    px(ctx, item.x + sway, 54, item.w, 2, '#0b1017')
  }

  // shelves and storage boxes for later outfits/upgrades
  px(ctx, 34, 64, 82, 3, P.plateDeep)
  px(ctx, 34, 64, 82, 1, P.plateLit)
  px(ctx, 35, 68, 19, 10, '#1b2630')
  px(ctx, 57, 68, 21, 10, '#17212b')
  px(ctx, 96, 67, 18, 11, '#1d2935')
  px(ctx, 38, 71, 8, 1, P.goldLit)
  px(ctx, 61, 71, 9, 1, P.tealLit)
  px(ctx, 100, 70, 8, 1, P.spiritLit)
  if (tier >= 3) {
    px(ctx, 80, 68, 12, 10, '#0c141d')
    px(ctx, 83, 70, 6, 1, P.greenLit)
    px(ctx, 83, 73, 5, 1, P.tealLit)
  }
  if (tier >= 5) {
    px(ctx, 18, 76, 13, 5, P.plateDark)
    px(ctx, 21, 74, 7, 2, P.goldLit)
  }
  if (tier >= 6) {
    pxa(ctx, 35, 18, 80, 50, P.spiritLit, 0.04 + Math.sin(t / 700) * 0.01)
    px(ctx, 40, 9, 68, 2, P.tealLit)
  }

  // floor step
  px(ctx, 0, h - 14, w, 14, P.stoneDark)
  px(ctx, 0, h - 14, w, 2, P.stoneLit)
  px(ctx, 0, h - 3, w, 3, '#111820')
  for (let x = 6; x < w; x += 26) px(ctx, x, h - 12, 1, 8, P.stoneDeep)

  dither(ctx, 0, 0, w, 12, '#000000', 1, 0.4)
  dither(ctx, 0, 0, 6, h, '#000000', 1, 0.2)
  dither(ctx, w - 6, 0, 6, h, '#000000', 1, 0.2)
}
