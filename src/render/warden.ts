import { P } from '../styles/palette'
import { noise2, px, pxa, pxLine, type Ctx } from './draw'
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

export function poseFor({ activity, phase, t, stats }: PoseInput): Pose {
  const p = basePose()

  const breathe = Math.sin(t / 620)
  p.bob = breathe > 0.5 ? -1 : 0
  p.capeSway = Math.sin(t / 900) * 1.5
  // A sharp thesis glows. A cooked one sweats.
  p.aura = Math.max(0.08, stats.edge / 100)
  p.dirt = stats.heat > 82 ? 2 : stats.heat > 58 ? 1 : 0

  // baseline demeanour from the stats
  if (stats.focus < 26) {
    p.eyes = 'tired'
    p.headDrop = 2
    p.bob = breathe > 0.5 ? 0 : 1
  }
  if (stats.heat > 74) {
    p.eyes = 'angry'
    p.mouth = 'flat'
    p.headTilt = -1
  }
  if (stats.edge < 26) {
    p.lean = -1
  }
  // blink
  if (p.eyes === 'open' && (t / 1000) % 5.4 < 0.16) p.eyes = 'closed'

  switch (activity) {
    case 'pnl': {
      // quick desk check: phone/tablet up, one calm glance at the numbers
      const k = Math.sin(phase * Math.PI)
      p.prop = 'slate'
      p.armL = { x: -4 - k, y: 9 - k * 2 }
      p.armR = { x: 7 + k, y: 13 - k }
      p.headTilt = phase < 0.56 ? -1 : 0
      p.headDrop = phase < 0.72 ? 1 : 0
      p.eyes = phase > 0.34 && phase < 0.48 ? 'closed' : 'open'
      p.mouth = 'flat'
      p.flash = 0
      p.aura = Math.min(1, p.aura + 0.16 * k)
      break
    }

    case 'research': {
      const scan = Math.sin(phase * Math.PI * 3)
      p.prop = 'ledger'
      p.armL = { x: -10, y: 12 }
      p.armR = { x: 4, y: 6 + scan * 3 }
      p.swordR = 62 * D
      p.headDrop = 1 + (scan > 0 ? 1 : 0)
      p.mouth = scan > 0.3 ? 'open' : 'flat'
      p.eyes = 'open'
      break
    }

    case 'recover': {
      // shuffle over to the cot, fold up, snore
      const walkIn = Math.min(1, phase / 0.14)
      const walkOut = phase > 0.86 ? (phase - 0.86) / 0.14 : 0
      const settle = Math.min(1, Math.max(0, (phase - 0.14) / 0.1))
      const travel = -62
      p.shift = travel * (walkIn - walkOut)
      p.step = phase < 0.14 || phase > 0.86 ? Math.floor(t / 110) % 2 : 0
      p.sit = settle - walkOut
      p.eyes = 'closed'
      p.headDrop = 3 * p.sit
      p.headTilt = -2 * p.sit
      p.armL = { x: -7, y: 16 }
      p.armR = { x: 7, y: 16 }
      p.swordLen = 0
      p.bob = Math.sin(t / 700) > 0 ? 0 : 1
      p.aura = Math.max(0.1, p.aura * 0.55)
      break
    }

    case 'hedge': {
      const work = Math.sin(phase * Math.PI * 7)
      p.prop = 'slate'
      p.armL = { x: -4 + work * 4, y: 8 + Math.abs(work) * 2 }
      p.armR = { x: 9, y: 15 }
      p.swordLen = 0
      p.headDrop = 1
      p.eyes = 'closed'
      p.mouth = 'flat'
      break
    }

    case 'scan': {
      const hop = Math.sin(phase * Math.PI * 3)
      p.bob = -Math.round(Math.abs(hop) * 3)
      p.armL = { x: -8, y: 8 }
      p.armR = { x: 8, y: 8 }
      p.mouth = 'grin'
      p.eyes = 'open'
      p.flash = Math.floor(phase * 8) % 2
      break
    }

    case 'bet': {
      // wind up, then commit
      const k = phase < 0.4 ? -phase / 0.4 : (phase - 0.4) / 0.6
      p.lean = Math.round(k * 4)
      p.shift = Math.round(k * 3)
      p.prop = 'slate'
      p.armR = { x: 7 + k * 5, y: 12 - k * 3 }
      p.armL = { x: -7, y: 14 }
      p.eyes = 'angry'
      p.mouth = 'open'
      p.flash = k > 0.6 ? 1 : 0
      break
    }

    case 'refuse': {
      const shake = Math.sin(phase * Math.PI * 6)
      p.shift = Math.round(shake * 2)
      p.headTilt = Math.round(shake * 2)
      p.eyes = 'angry'
      p.mouth = 'flat'
      p.armL = { x: -11, y: 10 }
      p.armR = { x: 11, y: 10 }
      break
    }

    case 'idle':
    default: {
      // slow idle sway; occasionally shifts weight
      const cycle = (t / 3400) % 1
      if (cycle > 0.82) {
        p.lean = 1
        p.armR = { x: 9, y: 13 }
      }
      break
    }
  }

  return p
}
interface Kit {
  cloak: { dark: string; mid: string; lit: string; ragged: boolean; fur: boolean }
  blade: { core: string; edge: string; glow: string | null; glowMul: number }
  head: 'bare' | 'circlet' | 'antler' | 'crown'
}

function kitFor(look: EquippedLook): Kit {
  const cloakId = look.cloak
  const cloak =
    cloakId === 'cloak_watch'
      ? { dark: P.tealDeep, mid: P.teal, lit: P.tealLit, ragged: false, fur: false }
      : cloakId === 'cloak_pelt'
        ? { dark: P.boneDeep, mid: P.boneDim, lit: P.bone, ragged: false, fur: true }
        : cloakId === 'cloak_ember'
          ? { dark: P.emberDeep, mid: P.ember, lit: P.emberLit, ragged: false, fur: false }
          : cloakId === 'cloak_rag'
            ? { dark: '#1d2935', mid: '#2e3d4c', lit: '#4d6072', ragged: false, fur: false }
            : { dark: '#241d18', mid: '#2e251d', lit: '#3a2e24', ragged: true, fur: false }

  const bladeId = look.blade
  const blade =
    bladeId === 'blade_spirit'
      ? { core: P.spiritLit, edge: P.spiritPale, glow: P.spirit, glowMul: 1 }
      : bladeId === 'blade_ember'
        ? { core: P.emberLit, edge: P.emberPale, glow: P.ember, glowMul: 1 }
        : // plain steel, but his own spirit still runs down the fullers
          { core: P.stoneHi, edge: P.bone, glow: P.spirit, glowMul: 0.42 }

  const head =
    look.head === 'head_circlet'
      ? 'circlet'
      : look.head === 'head_antler'
        ? 'antler'
        : look.head === 'head_crown'
          ? 'crown'
          : 'bare'

  return { cloak, blade, head }
}
function drawCape(ctx: Ctx, cx: number, groundY: number, pose: Pose, kit: Kit): void {
  const top = groundY - 44 + pose.bob + Math.round(pose.sit * 12)
  const bottom = groundY - 18 - Math.round(pose.sit * 7)
  const sway = pose.capeSway + pose.lean * -0.6
  const { dark, mid, lit, fur } = kit.cloak

  // hoodie back, visible behind the torso
  for (let y = top; y < bottom; y++) {
    const k = (y - top) / Math.max(1, bottom - top)
    const halfW = 7 + k * 2
    const off = Math.round(sway * k)
    const x0 = cx - halfW + off
    const w = halfW * 2
    px(ctx, x0, y, w, 1, k < 0.18 ? lit : k < 0.6 ? mid : dark)
    if (fur && y % 3 === 0) {
      px(ctx, x0 - 1, y, 2, 1, lit)
      px(ctx, x0 + w - 1, y, 2, 1, lit)
    }
  }

  // hood folded around the neck
  px(ctx, cx - 7 + pose.lean, top - 2, 14, 6, dark)
  px(ctx, cx - 5 + pose.lean, top - 1, 10, 2, lit)
  px(ctx, cx - 4 + pose.lean, top + 2, 8, 1, P.ink)
  px(ctx, cx - 8 + Math.round(sway), bottom, 16, 2, dark)
}

function drawLegs(ctx: Ctx, cx: number, groundY: number, pose: Pose): void {
  if (pose.sit > 0.5) {
    // folded, asleep in the chair
    const y = groundY - 8
    px(ctx, cx - 11, y, 10, 5, '#26364a')
    px(ctx, cx + 1, y, 10, 5, '#26364a')
    px(ctx, cx - 11, y, 10, 1, '#3c4d62')
    px(ctx, cx + 1, y, 10, 1, '#3c4d62')
    px(ctx, cx - 12, y + 2, 4, 3, P.boneDim)
    px(ctx, cx + 8, y + 2, 4, 3, P.boneDim)
    return
  }

  const stepOff = pose.step ? 2 : 0
  for (const side of [-1, 1] as const) {
    const lx = cx + (side < 0 ? -7 : 1)
    const lift = pose.step && side < 0 ? stepOff : 0
    // jeans
    px(ctx, lx, groundY - 21 - lift, 6, 14, '#203049')
    px(ctx, lx, groundY - 21 - lift, 6, 1, '#3b516d')
    px(ctx, lx + (side < 0 ? 0 : 5), groundY - 21 - lift, 1, 14, '#111b29')
    px(ctx, lx + 2, groundY - 15 - lift, 2, 8, '#172438')
    // socks / house shoes
    px(ctx, lx - 1, groundY - 8 - lift, 8, 7, P.boneDim)
    px(ctx, lx - 1, groundY - 8 - lift, 8, 1, P.bone)
    px(ctx, lx - 1, groundY - 2 - lift, 8, 1, P.ink)
  }
}

function drawTorso(ctx: Ctx, cx: number, groundY: number, pose: Pose, kit: Kit): void {
  const lean = pose.lean
  const drop = Math.round(pose.sit * 12)
  const top = groundY - 44 + pose.bob + drop
  const waist = groundY - 29 + drop
  const { dark, mid, lit } = kit.cloak

  // hoodie body
  px(ctx, cx - 8 + lean, top, 16, waist - top + 11 - Math.round(pose.sit * 4), mid)
  px(ctx, cx - 8 + lean, top, 16, 2, lit)
  px(ctx, cx - 8 + lean, top, 1, waist - top + 9, lit)
  px(ctx, cx + 7 + lean, top, 1, waist - top + 9, dark)
  px(ctx, cx - 8 + lean, waist + 8, 16, 2, dark)

  // tee peeking through the unzipped hoodie
  px(ctx, cx - 3 + lean, top + 5, 6, 17 - Math.round(pose.sit * 4), '#d7dccf')
  px(ctx, cx - 3 + lean, top + 5, 6, 1, P.white)
  px(ctx, cx - 1 + lean, top + 7, 2, 15, kit.blade.glow ?? P.spirit)

  // zipper and hoodie strings
  px(ctx, cx - 1 + lean, top + 3, 2, waist - top + 7, P.ink)

  // edge signal on the shirt
  const runeY = top + 5
  const glow = pose.aura
  pxa(ctx, cx - 3 + lean, runeY, 6, 6, P.spirit, 0.09 * glow)
  px(ctx, cx - 3 + lean, runeY + 5, 6, 1, kit.blade.glow ?? P.spirit)
  px(ctx, cx + 1 + lean, runeY + 2, 1, 3, kit.blade.glow ?? P.spirit)

  // soft shoulders
  for (const side of [-1, 1] as const) {
    const sx = side < 0 ? cx - 13 + lean : cx + 7 + lean
    px(ctx, sx, top, 6, 5, mid)
    px(ctx, sx, top, 6, 1, lit)
    px(ctx, sx + (side < 0 ? 0 : 5), top, 1, 5, dark)
  }
}

function drawArm(
  ctx: Ctx,
  shoulderX: number,
  shoulderY: number,
  hand: { x: number; y: number },
): { hx: number; hy: number } {
  const hx = shoulderX + hand.x
  const hy = shoulderY + hand.y
  const ex = shoulderX + Math.round(hand.x * 0.62)
  const ey = shoulderY + Math.round(hand.y * 0.55)
  // hoodie sleeve + hand
  pxLine(ctx, shoulderX, shoulderY, ex, ey, '#263646', 3)
  pxLine(ctx, ex, ey, hx, hy, '#263646', 2)
  pxLine(ctx, shoulderX, shoulderY, ex, ey, '#4d6072', 1)
  px(ctx, ex - 1, ey - 1, 3, 2, '#1d2935')
  px(ctx, hx - 1, hy - 2, 3, 4, P.skin)
  px(ctx, hx - 1, hy - 2, 3, 1, P.skinLit)
  px(ctx, hx - 1, hy + 1, 3, 1, P.skinShade)
  return { hx, hy }
}

function drawHead(ctx: Ctx, cx: number, groundY: number, pose: Pose, kit: Kit): void {
  const drop = Math.round(pose.sit * 12) + pose.headDrop
  const tilt = pose.headTilt
  const top = groundY - 60 + pose.bob + drop
  const hx = cx + tilt + Math.round(pose.lean * 0.5)
  const hair = '#241812'
  const hairLit = '#3a271c'

  px(ctx, cx - 4 + pose.lean, top + 13, 8, 4, P.skinShade)

  // face
  px(ctx, hx - 7, top + 3, 14, 12, P.skin)
  px(ctx, hx - 7, top + 3, 14, 2, P.skinLit)
  px(ctx, hx - 7, top + 3, 2, 11, P.skinLit)
  px(ctx, hx + 5, top + 4, 2, 11, P.skinShade)

  // messy dark hair
  px(ctx, hx - 8, top, 16, 5, hair)
  px(ctx, hx - 7, top, 12, 1, hairLit)
  px(ctx, hx - 9, top + 3, 3, 6, hair)
  px(ctx, hx + 6, top + 3, 3, 5, hair)
  for (let i = 0; i < 5; i++) {
    const sx = hx - 7 + i * 3
    const h = 2 + Math.floor(noise2(i, top) * 4)
    px(ctx, sx, top - h + 2, 2, h, i % 2 ? hair : hairLit)
  }

  const browY = top + 6
  px(ctx, hx - 6, browY, 5, 1, hair)
  px(ctx, hx + 1, browY, 5, 1, hair)
  if (pose.eyes === 'angry') {
    px(ctx, hx - 6, browY + 1, 5, 1, hair)
    px(ctx, hx + 1, browY + 1, 5, 1, hair)
  }

  const eyeY = top + 8
  const drawEye = (ox: number) => {
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
      case 'angry':
        px(ctx, hx + ox, eyeY, 3, 2, P.bone)
        px(ctx, hx + ox + (ox < 0 ? 1 : 0), eyeY + 1, 2, 1, P.ink)
        break
      default:
        px(ctx, hx + ox, eyeY, 3, 2, P.bone)
        px(ctx, hx + ox + 1, eyeY, 1, 2, P.ink)
        pxa(ctx, hx + ox + 1, eyeY, 1, 1, P.spiritLit, 0.5)
    }
  }
  drawEye(-5)
  drawEye(3)

  px(ctx, hx - 1, eyeY + 2, 2, 3, P.skinShade)
  px(ctx, hx - 1, eyeY + 4, 3, 1, P.skinShade)

  if (pose.mouth === 'open') px(ctx, hx - 2, top + 15, 4, 2, '#3a1f16')
  else if (pose.mouth === 'grin') px(ctx, hx - 3, top + 15, 6, 1, '#3a1f16')
  else px(ctx, hx - 3, top + 15, 6, 1, P.skinShade)

  if (pose.eyes === 'tired') {
    pxa(ctx, hx - 6, eyeY + 3, 4, 1, P.spiritDeep, 0.32)
    pxa(ctx, hx + 2, eyeY + 3, 4, 1, P.spiritDeep, 0.32)
  }

  switch (kit.head) {
    case 'circlet':
      px(ctx, hx - 8, top + 4, 16, 3, P.plateDark)
      px(ctx, hx - 8, top + 4, 16, 1, P.plateLit)
      px(ctx, hx - 5, top + 5, 10, 1, P.spiritLit)
      break
    case 'antler':
      px(ctx, hx - 9, top + 5, 3, 9, P.plateDark)
      px(ctx, hx + 6, top + 5, 3, 9, P.plateDark)
      pxLine(ctx, hx - 7, top + 5, hx - 3, top + 2, P.plateLit, 1)
      pxLine(ctx, hx + 7, top + 5, hx + 3, top + 2, P.plateLit, 1)
      pxLine(ctx, hx + 7, top + 3, hx + 12, top - 4, P.tealLit, 1)
      px(ctx, hx + 11, top - 5, 2, 2, P.spiritPale)
      break
    case 'crown':
      px(ctx, hx - 8, top + 1, 16, 5, P.gold)
      px(ctx, hx - 8, top + 5, 16, 1, P.goldDark)
      px(ctx, hx + 4, top + 3, 7, 2, P.goldLit)
      px(ctx, hx - 2, top + 2, 4, 2, P.blood)
      break
    default:
      break
  }

  if (pose.dirt > 0) {
    pxa(ctx, hx + 2, top + 10, 3, 2, '#4a3520', 0.45)
    if (pose.dirt > 1) pxa(ctx, hx - 6, top + 9, 3, 2, '#4a3520', 0.45)
  }
}

function drawProp(ctx: Ctx, hx: number, hy: number, pose: Pose): void {
  switch (pose.prop) {
    case 'ledger':
      // small notebook with a chart line
      px(ctx, hx - 5, hy - 3, 11, 7, P.bone)
      px(ctx, hx - 5, hy - 3, 11, 1, P.white)
      px(ctx, hx - 5, hy - 3, 1, 7, P.ink)
      pxLine(ctx, hx - 3, hy + 1, hx + 4, hy - 1, P.tealLit, 1)
      break
    case 'slate':
      // phone / small tablet for hedging
      px(ctx, hx - 4, hy - 5, 8, 10, P.plateDark)
      px(ctx, hx - 3, hy - 4, 6, 7, '#061018')
      px(ctx, hx - 2, hy - 2, 4, 1, P.tealLit)
      px(ctx, hx - 1, hy + 1, 2, 1, P.emberLit)
      break
    case 'chips':
      // two market tokens, pip up
      px(ctx, hx - 4, hy - 3, 4, 4, P.bone)
      px(ctx, hx - 3, hy - 2, 1, 1, P.ink)
      px(ctx, hx + 1, hy - 1, 4, 4, P.bone)
      px(ctx, hx + 2, hy, 1, 1, P.ink)
      break
    default:
      break
  }
}

function drawAura(ctx: Ctx, cx: number, groundY: number, pose: Pose, t: number): void {
  const level = pose.aura
  if (level <= 0.05) return
  const count = 3 + Math.round(level * 4)
  for (let i = 0; i < count; i++) {
    const ph = t / 900 + (i * Math.PI * 2) / count
    const r = 15 + Math.sin(ph * 1.7 + i) * 4
    const x = cx + Math.cos(ph) * r
    const y = groundY - 30 + Math.sin(ph * 1.3) * 14
    const a = (0.3 + 0.4 * Math.sin(ph * 2.1)) * level
    pxa(ctx, x, y, 2, 2, P.spiritLit, Math.max(0, a))
    if (a > 0.4) pxa(ctx, x, y, 1, 1, P.spiritPale, a)
  }
  // ground shimmer
  pxa(ctx, cx - 14, groundY - 3, 28, 2, P.spirit, 0.1 * level)
}
export function drawWarden(
  ctx: Ctx,
  originX: number,
  groundY: number,
  pose: Pose,
  look: EquippedLook,
  t: number,
): void {
  const kit = kitFor(look)
  const cx = Math.round(originX + pose.shift)
  const gy = Math.round(groundY + (pose.sit > 0.5 ? 2 : 0))

  drawAura(ctx, cx, gy, pose, t)
  drawCape(ctx, cx, gy, pose, kit)
  drawLegs(ctx, cx, gy, pose)
  drawTorso(ctx, cx, gy, pose, kit)

  const shoulderY = gy - 41 + pose.bob + Math.round(pose.sit * 12)

  // back arm first so props sit behind the head but ahead of the body
  const back = drawArm(ctx, cx - 6 + pose.lean, shoulderY, pose.armL)
  drawProp(ctx, back.hx, back.hy, pose)

  drawHead(ctx, cx, gy, pose, kit)

  // front arm on top
  drawArm(ctx, cx + 6 + pose.lean, shoulderY, pose.armR)

  // heat grime on the hoodie
  if (pose.dirt > 0) {
    const a = pose.dirt > 1 ? 0.5 : 0.3
    pxa(ctx, cx - 8, gy - 36, 5, 3, '#4a3520', a)
    pxa(ctx, cx + 2, gy - 24, 6, 2, '#4a3520', a)
    pxa(ctx, cx - 6, gy - 12, 4, 2, '#4a3520', a)
    if (pose.dirt > 1) {
      pxa(ctx, cx + 4, gy - 40, 4, 2, '#4a3520', a)
      pxa(ctx, cx - 12, gy - 20, 3, 3, '#4a3520', a)
    }
  }

  // sleep marks
  if (pose.eyes === 'closed' && pose.sit > 0.5) {
    const zt = (t / 700) % 3
    for (let i = 0; i < 3; i++) {
      const k = (zt + i) % 3
      const a = 1 - k / 3
      const size = 2 + i
      pxa(ctx, cx + 12 + k * 4, gy - 38 - k * 7, size, size, P.bone, a * 0.8)
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
): void {
  const pose = poseFor({ activity: 'idle', phase: 0, t, stats })
  pose.swordLen = 0
  drawWarden(ctx, cx, groundY, pose, look, t)
}
