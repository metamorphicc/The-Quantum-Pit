import { P } from '../styles/palette'
import { px, pxa, pxLine, type Ctx } from './draw'
import type { ActivityKind, EquippedLook, Stats } from '../game/types'
export const HERO_H = 60
export const HERO_W = 36

export interface Pose {
  /** whole-body vertical offset (breathing, hops) */
  bob: number
  /** whole-body horizontal offset (walking to the mat, lunging) */
  shift: number
  /** torso lean, positive = forward/right */
  lean: number
  /** folds the legs and drops the torso (sleeping) */
  sit: number
  headTilt: number
  headDrop: number
  eyes: 'open' | 'closed' | 'tired' | 'angry' | 'wide'
  mouth: 'flat' | 'open' | 'grin'
  /** hand positions relative to the shoulder */
  armL: { x: number; y: number }
  armR: { x: number; y: number }
  /** tool angles in radians, measured from the hand */
  swordL: number
  swordR: number
  swordLen: number
  bladesUp: boolean
  capeSway: number
  /** 0..1 strength of the edge aura */
  aura: number
  /** 0..2 grime - sweat and printer soot, i.e. Heat */
  dirt: number
  /** prop held in the left hand */
  prop: 'none' | 'ledger' | 'slate' | 'chips'
  /** walking legs (0 = still) */
  step: number
  /** flash frame on held tools */
  flash: number
}

const D = Math.PI / 180

function basePose(): Pose {
  return {
    bob: 0,
    shift: 0,
    lean: 0,
    sit: 0,
    headTilt: 0,
    headDrop: 0,
    eyes: 'open',
    mouth: 'flat',
    armL: { x: -6, y: 14 },
    armR: { x: 6, y: 14 },
    swordL: 118 * D,
    swordR: 62 * D,
    swordLen: 0,
    bladesUp: false,
    capeSway: 0,
    aura: 0.5,
    dirt: 0,
    prop: 'none',
    step: 0,
    flash: 0,
  }
}
export interface PoseInput {
  activity: ActivityKind
  /** 0..1 through the current activity */
  phase: number
  t: number
  stats: Stats
}

export function poseFor({ activity, phase, stats }: PoseInput): Pose {
  const p = basePose()

  p.aura = Math.max(0.08, stats.edge / 100)
  p.dirt = stats.heat > 82 ? 2 : stats.heat > 58 ? 1 : 0

  if (stats.focus < 26) {
    p.eyes = 'tired'
  }
  if (stats.heat > 74) {
    p.eyes = 'angry'
    p.mouth = 'flat'
  }

  if (activity === 'recover') {
    const restIn = Math.min(1, phase / 0.18)
    const restOut = phase > 0.82 ? (phase - 0.82) / 0.18 : 0
    const rest = Math.max(0, restIn - restOut)
    p.sit = rest
    p.eyes = 'closed'
    p.mouth = 'flat'
    p.headDrop = Math.round(rest * 2)
    p.armL = { x: -6, y: 15 }
    p.armR = { x: 6, y: 15 }
    p.aura = Math.max(0.08, p.aura * 0.45)
  }

  return p
}
interface OutfitLayer {
  body: string
  shade: string
  light: string
  tee: string
  accent: string
  pants: string
  pantsShade: string
  shoes: string
}

interface ToolLayer {
  accent: string
  kind: 'keyboard' | 'calc' | 'chart' | 'pad' | 'risk'
}

interface Kit {
  outfit: OutfitLayer
  tool: ToolLayer
  head: 'hair' | 'visor' | 'antenna' | 'cap'
}

function progressionOutfit(tier: number): OutfitLayer {
  if (tier >= 6) {
    return {
      body: '#101820',
      shade: '#070a0f',
      light: '#2f8b91',
      tee: '#f4ead6',
      accent: P.goldLit,
      pants: '#0d1420',
      pantsShade: '#05080d',
      shoes: P.plateLit,
    }
  }
  if (tier >= 5) {
    return {
      body: '#1d2935',
      shade: '#101820',
      light: '#40536a',
      tee: '#e8dfc8',
      accent: P.tealLit,
      pants: '#17263a',
      pantsShade: '#0c1625',
      shoes: P.bone,
    }
  }
  if (tier >= 4) {
    return {
      body: '#203746',
      shade: '#10222d',
      light: '#4d6072',
      tee: '#dce9e7',
      accent: P.spiritLit,
      pants: '#17263a',
      pantsShade: '#0c1625',
      shoes: P.boneDim,
    }
  }
  if (tier >= 3) {
    return {
      body: '#273746',
      shade: '#152231',
      light: '#4d6072',
      tee: '#e8dfc8',
      accent: P.spiritLit,
      pants: '#17263a',
      pantsShade: '#0c1625',
      shoes: P.boneDim,
    }
  }
  if (tier >= 2) {
    return {
      body: '#26313b',
      shade: '#151d26',
      light: '#3d4b59',
      tee: '#cfc7ad',
      accent: P.tealLit,
      pants: '#182438',
      pantsShade: '#0b1320',
      shoes: '#8c846f',
    }
  }
  return {
    body: '#3b342b',
    shade: '#211b17',
    light: '#66523b',
    tee: '#b9ae94',
    accent: P.goldDark,
    pants: '#26313b',
    pantsShade: '#111820',
    shoes: '#6f6758',
  }
}

function kitFor(look: EquippedLook, tier: number): Kit {
  const outfit =
    look.cloak === 'cloak_watch'
      ? {
          body: '#24515d',
          shade: '#132c37',
          light: '#4c8790',
          tee: '#dce9e7',
          accent: P.tealLit,
          pants: '#172a3d',
          pantsShade: '#0d1827',
          shoes: P.boneDim,
        }
      : look.cloak === 'cloak_pelt'
        ? {
            body: '#4d5568',
            shade: '#242833',
            light: '#8490a0',
            tee: '#e8dfc8',
            accent: P.bone,
            pants: '#1b2530',
            pantsShade: '#101820',
            shoes: P.stoneHi,
          }
        : look.cloak === 'cloak_ember'
          ? {
              body: '#7d211d',
              shade: '#3f1513',
              light: '#d84a3a',
              tee: '#f0e2cf',
              accent: P.emberLit,
              pants: '#182235',
              pantsShade: '#0d1420',
              shoes: P.emberDeep,
            }
          : progressionOutfit(tier)

  const tool =
    look.blade === 'blade_calc'
      ? { accent: P.goldLit, kind: 'calc' as const }
      : look.blade === 'blade_spirit'
        ? { accent: P.spiritLit, kind: 'chart' as const }
        : look.blade === 'blade_macropad'
          ? { accent: P.tealLit, kind: 'keyboard' as const }
          : look.blade === 'blade_depth'
            ? { accent: P.spiritPale, kind: 'pad' as const }
            : look.blade === 'blade_ember'
              ? { accent: P.emberLit, kind: 'risk' as const }
              : { accent: P.stoneHi, kind: 'keyboard' as const }

  const head =
    look.head === 'head_circlet'
      ? 'visor'
      : look.head === 'head_antler'
        ? 'antenna'
        : look.head === 'head_crown'
          ? 'cap'
          : 'hair'

  return { outfit, tool, head }
}

function bodyTop(groundY: number, pose: Pose): number {
  return groundY - 43 + pose.bob + Math.round(pose.sit * 12)
}

function drawLegs(ctx: Ctx, cx: number, groundY: number, pose: Pose, kit: Kit): void {
  const { outfit } = kit
  if (pose.sit > 0.5) {
    const y = groundY - 9
    px(ctx, cx - 10, y, 9, 5, outfit.pants)
    px(ctx, cx + 1, y, 9, 5, outfit.pants)
    px(ctx, cx - 10, y, 9, 1, outfit.light)
    px(ctx, cx + 1, y, 9, 1, outfit.light)
    px(ctx, cx - 11, y + 3, 5, 3, outfit.shoes)
    px(ctx, cx + 6, y + 3, 5, 3, outfit.shoes)
    return
  }

  const stepOff = pose.step ? 2 : 0
  for (const side of [-1, 1] as const) {
    const lx = cx + (side < 0 ? -6 : 1)
    const lift = pose.step && side < 0 ? stepOff : 0
    px(ctx, lx, groundY - 25 - lift, 5, 19, outfit.pants)
    px(ctx, lx, groundY - 25 - lift, 1, 19, outfit.pantsShade)
    px(ctx, lx + 4, groundY - 25 - lift, 1, 19, '#233754')
    px(ctx, lx + 1, groundY - 15 - lift, 2, 9, outfit.pantsShade)
    px(ctx, lx - 1, groundY - 6 - lift, 7, 4, outfit.shoes)
    px(ctx, lx - 1, groundY - 3 - lift, 7, 1, P.ink)
  }
}

function drawTorso(ctx: Ctx, cx: number, groundY: number, pose: Pose, kit: Kit): void {
  const lean = pose.lean
  const top = bodyTop(groundY, pose)
  const sitTrim = Math.round(pose.sit * 5)
  const { outfit, tool } = kit
  const x = cx - 7 + lean

  px(ctx, x, top, 14, 20 - sitTrim, outfit.body)
  px(ctx, x, top, 14, 2, outfit.light)
  px(ctx, x, top + 2, 1, 16 - sitTrim, outfit.light)
  px(ctx, x + 13, top + 2, 1, 17 - sitTrim, outfit.shade)
  px(ctx, x + 1, top + 18 - sitTrim, 12, 3, outfit.shade)

  px(ctx, cx - 3 + lean, top + 4, 6, 16 - sitTrim, outfit.tee)
  px(ctx, cx - 1 + lean, top + 4, 2, 17 - sitTrim, P.ink)
  px(ctx, cx - 2 + lean, top + 7, 4, 8, tool.accent)
  px(ctx, cx - 1 + lean, top + 7, 2, 8, P.spiritPale)

  px(ctx, cx - 12 + lean, top + 1, 5, 5, outfit.body)
  px(ctx, cx + 7 + lean, top + 1, 5, 5, outfit.body)
  px(ctx, cx - 12 + lean, top + 1, 5, 1, outfit.light)
  px(ctx, cx + 7 + lean, top + 1, 5, 1, outfit.light)

  drawToolBadge(ctx, cx + 8 + lean, top + 15 - sitTrim, kit)
}

function drawArm(
  ctx: Ctx,
  shoulderX: number,
  shoulderY: number,
  hand: { x: number; y: number },
  kit: Kit,
): { hx: number; hy: number } {
  const hx = shoulderX + hand.x
  const hy = shoulderY + hand.y
  const ex = shoulderX + Math.round(hand.x * 0.58)
  const ey = shoulderY + Math.round(hand.y * 0.5)
  const { outfit } = kit

  pxLine(ctx, shoulderX, shoulderY, ex, ey, outfit.body, 2)
  pxLine(ctx, ex, ey, hx, hy, outfit.body, 2)
  pxLine(ctx, shoulderX, shoulderY, ex, ey, outfit.light, 1)
  px(ctx, hx - 1, hy - 1, 3, 3, P.skin)
  px(ctx, hx - 1, hy - 1, 3, 1, P.skinLit)
  return { hx, hy }
}

function drawHead(ctx: Ctx, cx: number, groundY: number, pose: Pose, kit: Kit): void {
  const drop = Math.round(pose.sit * 12) + pose.headDrop
  const top = groundY - 59 + pose.bob + drop
  const hx = cx + pose.headTilt + Math.round(pose.lean * 0.5)
  const hair = '#241812'
  const hairLit = '#4a2a18'

  px(ctx, cx - 3 + pose.lean, top + 14, 6, 5, P.skinShade)
  px(ctx, hx - 7, top + 4, 14, 13, P.skin)
  px(ctx, hx - 7, top + 4, 14, 2, P.skinLit)
  px(ctx, hx - 8, top + 8, 1, 5, P.skinShade)
  px(ctx, hx + 7, top + 8, 1, 5, P.skinShade)
  px(ctx, hx + 5, top + 7, 2, 9, P.skinShade)

  px(ctx, hx - 8, top + 1, 16, 5, hair)
  px(ctx, hx - 7, top + 1, 11, 1, hairLit)
  px(ctx, hx - 9, top + 4, 3, 5, hair)
  px(ctx, hx + 6, top + 4, 3, 5, hair)
  px(ctx, hx - 7, top - 1, 2, 4, hairLit)
  px(ctx, hx - 3, top - 2, 2, 5, hair)
  px(ctx, hx + 1, top - 1, 2, 4, hairLit)
  px(ctx, hx + 5, top, 2, 3, hair)

  drawHeadwear(ctx, hx, top, kit)
  drawFace(ctx, hx, top, pose)

  if (pose.dirt > 0) {
    pxa(ctx, hx + 2, top + 12, 3, 2, '#4a3520', 0.42)
    if (pose.dirt > 1) pxa(ctx, hx - 6, top + 11, 3, 2, '#4a3520', 0.42)
  }
}

function drawHeadwear(ctx: Ctx, hx: number, top: number, kit: Kit): void {
  switch (kit.head) {
    case 'visor':
      px(ctx, hx - 8, top + 5, 16, 3, P.plateDark)
      px(ctx, hx - 5, top + 6, 10, 1, P.spiritLit)
      break
    case 'antenna':
      px(ctx, hx - 9, top + 7, 3, 5, P.plateDark)
      px(ctx, hx + 6, top + 7, 3, 5, P.plateDark)
      pxLine(ctx, hx + 8, top + 7, hx + 12, top + 2, P.tealLit, 1)
      px(ctx, hx + 12, top + 1, 2, 2, P.spiritPale)
      break
    case 'cap':
      px(ctx, hx - 8, top + 2, 16, 4, P.gold)
      px(ctx, hx - 8, top + 5, 19, 2, P.goldDark)
      px(ctx, hx - 2, top + 2, 5, 1, P.goldLit)
      break
    default:
      break
  }
}

function drawFace(ctx: Ctx, hx: number, top: number, pose: Pose): void {
  const browY = top + 8
  const eyeY = top + 10
  px(ctx, hx - 6, browY, 5, 1, '#241812')
  px(ctx, hx + 1, browY, 5, 1, '#241812')
  if (pose.eyes === 'angry') {
    px(ctx, hx - 6, browY + 1, 5, 1, '#241812')
    px(ctx, hx + 1, browY + 1, 5, 1, '#241812')
  }

  const eye = (ox: number) => {
    switch (pose.eyes) {
      case 'closed':
        px(ctx, hx + ox, eyeY + 1, 3, 1, P.skinShade)
        break
      case 'tired':
        px(ctx, hx + ox, eyeY, 3, 1, P.skinShade)
        px(ctx, hx + ox + 1, eyeY + 1, 1, 1, P.ink)
        break
      case 'wide':
        px(ctx, hx + ox - 1, eyeY - 1, 4, 4, P.bone)
        px(ctx, hx + ox, eyeY, 2, 2, P.spirit)
        break
      default:
        px(ctx, hx + ox, eyeY, 3, 2, P.bone)
        px(ctx, hx + ox + 1, eyeY, 1, 2, P.ink)
    }
  }
  eye(-5)
  eye(3)

  px(ctx, hx - 1, eyeY + 2, 2, 3, P.skinShade)
}

function drawToolBadge(ctx: Ctx, x: number, y: number, kit: Kit): void {
  px(ctx, x - 2, y - 1, 5, 6, P.plateDark)
  px(ctx, x - 1, y, 3, 3, '#061018')
  px(ctx, x, y + 1, 2, 1, kit.tool.accent)
}

function drawProp(ctx: Ctx, hx: number, hy: number, pose: Pose, kit: Kit): void {
  switch (pose.prop) {
    case 'ledger':
      px(ctx, hx - 5, hy - 3, 11, 7, P.bone)
      px(ctx, hx - 5, hy - 3, 11, 1, P.white)
      px(ctx, hx - 5, hy - 3, 1, 7, P.ink)
      pxLine(ctx, hx - 3, hy + 1, hx + 4, hy - 1, kit.tool.accent, 1)
      break
    case 'slate':
      px(ctx, hx - 4, hy - 5, 8, 10, P.plateDark)
      px(ctx, hx - 3, hy - 4, 6, 7, '#061018')
      px(ctx, hx - 2, hy - 2, 4, 1, kit.tool.accent)
      px(ctx, hx - 1, hy + 1, 2, 1, P.emberLit)
      break
    case 'chips':
      px(ctx, hx - 4, hy - 3, 4, 4, P.bone)
      px(ctx, hx - 3, hy - 2, 1, 1, P.ink)
      px(ctx, hx + 1, hy - 1, 4, 4, P.bone)
      px(ctx, hx + 2, hy, 1, 1, P.ink)
      break
    default:
      break
  }
}

function drawAura(ctx: Ctx, cx: number, groundY: number, pose: Pose): void {
  const level = pose.aura
  if (level <= 0.08) return
  const count = 2 + Math.round(level * 3)
  for (let i = 0; i < count; i++) {
    const ph = (i * Math.PI * 2) / count
    const x = cx + Math.cos(ph) * (14 + i)
    const y = groundY - 31 + Math.sin(ph * 1.3) * 13
    pxa(ctx, x, y, 2, 2, P.spiritLit, 0.18 * level)
  }
  pxa(ctx, cx - 12, groundY - 3, 24, 2, P.spirit, 0.08 * level)
}

export function drawWarden(
  ctx: Ctx,
  originX: number,
  groundY: number,
  pose: Pose,
  look: EquippedLook,
  t: number,
  tier = 1,
): void {
  const kit = kitFor(look, tier)
  const cx = Math.round(originX + pose.shift)
  const gy = Math.round(groundY + (pose.sit > 0.5 ? 2 : 0))
  const shoulderY = bodyTop(gy, pose) + 4

  drawAura(ctx, cx, gy, pose)
  drawLegs(ctx, cx, gy, pose, kit)
  drawTorso(ctx, cx, gy, pose, kit)

  const back = drawArm(ctx, cx - 8 + pose.lean, shoulderY, pose.armL, kit)
  drawProp(ctx, back.hx, back.hy, pose, kit)
  drawHead(ctx, cx, gy, pose, kit)
  drawArm(ctx, cx + 8 + pose.lean, shoulderY, pose.armR, kit)

  if (pose.dirt > 0) {
    const a = pose.dirt > 1 ? 0.45 : 0.28
    pxa(ctx, cx - 7, gy - 34, 4, 2, '#4a3520', a)
    pxa(ctx, cx + 2, gy - 23, 5, 2, '#4a3520', a)
  }

  if (pose.eyes === 'closed' && pose.sit > 0.5) {
    const zt = (t / 700) % 3
    for (let i = 0; i < 3; i++) {
      const k = (zt + i) % 3
      pxa(ctx, cx + 12 + k * 4, gy - 38 - k * 7, 2 + i, 2 + i, P.bone, (1 - k / 3) * 0.8)
    }
  }
}

/** Portrait version for the rig preview: same sprite, static idle pose. */
export function drawWardenPortrait(
  ctx: Ctx,
  cx: number,
  groundY: number,
  look: EquippedLook,
  t: number,
  stats: Stats,
  tier = 1,
): void {
  const pose = poseFor({ activity: 'idle', phase: 0, t, stats })
  pose.swordLen = 0
  drawWarden(ctx, cx, groundY, pose, look, t, tier)
}
