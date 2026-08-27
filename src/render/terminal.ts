import { P } from '../styles/palette'
import { dither, drawMatrix, lightPool, noise2, outline, px, pxa, pxLine, type Ctx } from './draw'
export const DESK = {
  w: 160,
  h: 176,
  floorY: 118,
  /** the table top */
  topY: 132,
} as const

/** The cathode case, in scene coords. */
const CASE = { x: 38, y: 44, w: 84, h: 84 } as const
/** The lit phosphor area inside it. */
const GLASS = { x: 46, y: 52, w: 68, h: 58 } as const

/** Generous tap area over the glass - the whole terminal answers to a tap. */
export function screenHitTest(x: number, y: number): boolean {
  return x >= CASE.x && x <= CASE.x + CASE.w && y >= CASE.y && y <= CASE.y + CASE.h
}

const FIRE_CHARS: Record<string, string> = {
  a: P.emberDeep,
  b: P.ember,
  c: P.emberLit,
  d: P.emberPale,
}

const BRAZIER_FLAME: readonly string[][] = [
  ['..d..', '.dcd.', '.ccb.', 'bcccb', 'abbba', '.aaa.'],
  ['.d...', '.dcd.', 'dccb.', 'bcccb', 'abbba', '.aaa.'],
  ['...d.', '.dcd.', '.bccd', 'bcccb', 'abbba', '.aaa.'],
]
function drawBackWall(ctx: Ctx): void {
  px(ctx, 0, 0, DESK.w, DESK.floorY, P.stoneDeep)
  // stone blocks
  for (let row = 0; row * 14 < DESK.floorY; row++) {
    const y = row * 14
    const off = row % 2 ? 13 : 0
    for (let x = -off; x < DESK.w; x += 26) {
      const n = noise2(x + row * 17, row * 5)
      px(ctx, x + 1, y + 1, 24, 12, n > 0.62 ? P.stoneDark : n > 0.28 ? '#302b26' : '#28241f')
      px(ctx, x + 1, y + 1, 24, 1, n > 0.5 ? P.stone : '#3b352e')
      px(ctx, x + 1, y + 12, 24, 1, '#131110')
      if (n > 0.86) px(ctx, x + 5, y + 6, 6, 1, P.stoneDeep)
      if (n < 0.1) px(ctx, x + 16, y + 4, 3, 2, P.stoneDeep)
    }
  }
  // top gloom
  for (let y = 0; y < 34; y++) {
    pxa(ctx, 0, y, DESK.w, 1, '#000000', 0.55 * (1 - y / 34))
  }
  // hanging chains
  for (const cx of [22, 138]) {
    for (let y = 0; y < 30; y += 4) {
      px(ctx, cx, y, 3, 3, y % 8 === 0 ? P.stoneLit : P.stoneDark)
    }
    px(ctx, cx - 2, 30, 7, 3, P.plateDark)
  }
  // the running tally he keeps in chalk, because he does not trust the machine
  for (let i = 0; i < 7; i++) px(ctx, 108 + i * 3, 30, 1, 9, P.stoneLit)
  pxLine(ctx, 106, 40, 128, 26, P.stoneLit, 1)
}

function drawFloor(ctx: Ctx): void {
  px(ctx, 0, DESK.floorY, DESK.w, DESK.h - DESK.floorY, '#3a2c1e')
  // boards edge
  px(ctx, 0, DESK.floorY, DESK.w, 3, P.woodDeep)
  px(ctx, 0, DESK.floorY, DESK.w, 1, P.woodDark)
  // plank seams
  for (let x = 0; x < DESK.w; x += 19) {
    px(ctx, x, DESK.floorY + 3, 1, DESK.h - DESK.floorY - 3, '#241a12')
  }
  // grit and dropped paper
  for (let i = 0; i < 130; i++) {
    const n = noise2(i * 2.3, 13)
    const m = noise2(41, i * 1.7)
    const x = Math.floor(n * DESK.w)
    const y = DESK.floorY + 4 + Math.floor(m * (DESK.h - DESK.floorY - 6))
    px(ctx, x, y, n > 0.9 ? 2 : 1, 1, n > 0.72 ? '#4a3927' : '#2e2317')
  }
  for (let i = 0; i < 9; i++) {
    const n = noise2(i * 5.1, 77)
    const m = noise2(77, i * 3.3)
    px(
      ctx,
      Math.floor(n * DESK.w),
      DESK.floorY + 8 + Math.floor(m * (DESK.h - DESK.floorY - 10)),
      n > 0.5 ? 4 : 3,
      2,
      n > 0.6 ? P.boneDeep : '#5a5346',
    )
  }
}

function drawBrazier(ctx: Ctx, x: number, y: number): void {
  px(ctx, x + 2, y + 12, 3, 12, P.plateDark)
  px(ctx, x + 15, y + 12, 3, 12, P.plateDark)
  px(ctx, x + 8, y + 14, 3, 10, P.plateDark)
  px(ctx, x, y + 22, 20, 3, P.plateDeep)
  px(ctx, x, y + 4, 20, 9, P.plateDark)
  px(ctx, x + 2, y + 13, 16, 3, P.plateDeep)
  px(ctx, x, y + 4, 20, 2, P.plateLit)
  outline(ctx, x, y + 4, 20, 9, P.ink, 1)
  px(ctx, x + 3, y + 2, 14, 3, P.emberDeep)
  px(ctx, x + 6, y + 2, 8, 1, P.ember)
}

/** The table the terminal sits on, plus the mess on it. */
function drawTable(ctx: Ctx): void {
  const y = DESK.topY
  // legs first, so the top overlaps them
  for (const lx of [24, 128]) {
    px(ctx, lx, y + 6, 8, DESK.h - y - 6, P.woodDeep)
    px(ctx, lx, y + 6, 2, DESK.h - y - 6, P.woodDark)
    outline(ctx, lx, y + 6, 8, DESK.h - y - 6, P.ink, 1)
  }
  // cross brace
  px(ctx, 30, y + 26, 100, 4, P.woodDeep)
  px(ctx, 30, y + 26, 100, 1, P.woodDark)

  // top
  px(ctx, 14, y, 132, 8, P.wood)
  px(ctx, 14, y, 132, 2, P.woodHi)
  px(ctx, 14, y + 6, 132, 2, P.woodDeep)
  outline(ctx, 14, y, 132, 8, P.ink, 1)
  for (let x = 20; x < 144; x += 21) px(ctx, x, y + 2, 1, 4, P.woodDark)

  // stacked paper, left
  px(ctx, 18, y - 6, 18, 6, P.boneDeep)
  px(ctx, 18, y - 6, 18, 1, P.boneDim)
  px(ctx, 20, y - 9, 15, 4, '#6f6857')
  px(ctx, 20, y - 9, 15, 1, P.boneDim)
  for (let i = 0; i < 3; i++) px(ctx, 22, y - 8 + i * 2, 9, 1, P.stoneDeep)

  // candle, right - the one light he actually trusts
  px(ctx, 128, y - 13, 5, 13, P.boneDim)
  px(ctx, 128, y - 13, 5, 1, P.bone)
  px(ctx, 126, y - 1, 9, 2, P.woodDark)
  outline(ctx, 126, y - 1, 9, 2, P.ink, 1)
}

let deskStatic: HTMLCanvasElement | null = null

function getDeskStatic(): HTMLCanvasElement {
  if (deskStatic) return deskStatic
  const cv = document.createElement('canvas')
  cv.width = DESK.w
  cv.height = DESK.h
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  drawBackWall(ctx)
  drawFloor(ctx)
  drawBrazier(ctx, 4, 92)
  drawBrazier(ctx, 136, 92)
  drawTable(ctx)
  deskStatic = cv
  return deskStatic
}
let caseStatic: HTMLCanvasElement | null = null

function getCaseStatic(): HTMLCanvasElement {
  if (caseStatic) return caseStatic
  const cv = document.createElement('canvas')
  cv.width = DESK.w
  cv.height = DESK.h
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const { x, y, w, h } = CASE

  // cables, drawn behind the case so they vanish under it
  pxLine(ctx, x + 14, y + h - 2, x - 2, DESK.topY + 5, P.plateDeep, 3)
  pxLine(ctx, x + w - 14, y + h - 2, x + w + 6, DESK.topY + 5, P.plateDeep, 3)
  pxLine(ctx, x + w + 6, DESK.topY + 5, x + w + 14, DESK.h - 6, P.plateDeep, 2)

  // body: stone-grey plastic that yellowed thirty years ago
  px(ctx, x, y, w, h, P.stoneDark)
  px(ctx, x, y, w, 3, P.stoneLit)
  px(ctx, x + 2, y + h - 4, w - 4, 4, P.stoneDeep)
  px(ctx, x, y, 3, h, P.stone)
  px(ctx, x + w - 3, y, 3, h, P.stoneDeep)
  outline(ctx, x, y, w, h, P.ink, 2)

  // the bezel around the glass, sunk in
  outline(ctx, GLASS.x - 3, GLASS.y - 3, GLASS.w + 6, GLASS.h + 6, P.stoneDeep, 3)
  outline(ctx, GLASS.x - 1, GLASS.y - 1, GLASS.w + 2, GLASS.h + 2, P.ink, 1)

  // chin: two dials, a slot, and a brass plate nobody has polished
  const chinY = GLASS.y + GLASS.h + 5
  px(ctx, x + 6, chinY, 30, 3, P.stoneDeep)
  px(ctx, x + 6, chinY + 6, 20, 3, P.stoneDeep)
  for (const dx of [x + w - 26, x + w - 14]) {
    px(ctx, dx, chinY, 8, 8, P.plateDark)
    px(ctx, dx, chinY, 8, 2, P.plateLit)
    px(ctx, dx + 3, chinY + 1, 2, 4, P.stoneHi)
    outline(ctx, dx, chinY, 8, 8, P.ink, 1)
  }
  px(ctx, x + 6, chinY + 12, 22, 4, P.ink)
  px(ctx, x + 7, chinY + 13, 20, 1, P.stoneDeep)

  // vent slots along the top
  for (let i = 0; i < 7; i++) px(ctx, x + 12 + i * 9, y + 5, 6, 2, P.stoneDeep)

  caseStatic = cv
  return caseStatic
}
/** A blocky 5x7 glyph set - just enough for YES, NO and the verdicts. */
const GLYPHS: Record<string, readonly string[]> = {
  Y: ['x...x', 'x...x', '.x.x.', '..x..', '..x..', '..x..', '..x..'],
  E: ['xxxxx', 'x....', 'x....', 'xxxx.', 'x....', 'x....', 'xxxxx'],
  S: ['.xxxx', 'x....', 'x....', '.xxx.', '....x', '....x', 'xxxx.'],
  N: ['x...x', 'xx..x', 'xx..x', 'x.x.x', 'x..xx', 'x..xx', 'x...x'],
  O: ['.xxx.', 'x...x', 'x...x', 'x...x', 'x...x', 'x...x', '.xxx.'],
  P: ['xxxx.', 'x...x', 'x...x', 'xxxx.', 'x....', 'x....', 'x....'],
  A: ['.xxx.', 'x...x', 'x...x', 'xxxxx', 'x...x', 'x...x', 'x...x'],
  I: ['xxxxx', '..x..', '..x..', '..x..', '..x..', '..x..', 'xxxxx'],
  D: ['xxxx.', 'x...x', 'x...x', 'x...x', 'x...x', 'x...x', 'xxxx.'],
  C: ['.xxxx', 'x....', 'x....', 'x....', 'x....', 'x....', '.xxxx'],
  U: ['x...x', 'x...x', 'x...x', 'x...x', 'x...x', 'x...x', '.xxx.'],
  T: ['xxxxx', '..x..', '..x..', '..x..', '..x..', '..x..', '..x..'],
  '?': ['.xxx.', 'x...x', '....x', '..xx.', '..x..', '.....', '..x..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
}

/** Draws a word in phosphor, centred on `cx`, at `scale` pixels per cell. */
function glyphText(
  ctx: Ctx,
  text: string,
  cx: number,
  y: number,
  color: string,
  scale = 1,
  alpha = 1,
): void {
  const cell = 5 * scale + scale
  const width = text.length * cell - scale
  let x = Math.round(cx - width / 2)
  for (const ch of text) {
    const rows = GLYPHS[ch] ?? GLYPHS['?']!
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== 'x') continue
        pxa(ctx, x + i * scale, y + j * scale, scale, scale, color, alpha)
      }
    })
    x += cell
  }
}

export type TerminalMode = 'idle' | 'armed' | 'resolving' | 'won' | 'lost'

export interface TerminalOpts {
  t: number
  mode: TerminalMode
  /** 0..1 through the current mode's beat */
  phase: number
  /** the quoted YES probability on the board, 0..1 */
  prob: number
  /** the staged side, or null when nothing is on the ticket */
  side: 'yes' | 'no' | null
  /** how hot he is running, 0..1 - the glass gets noisier */
  heat: number
}

/** The phosphor content. Bars, a price, and a verdict. Never a chart. */
function drawGlass(ctx: Ctx, o: TerminalOpts): void {
  const { x, y, w, h } = GLASS
  const won = o.mode === 'won'
  const lost = o.mode === 'lost'

  // the tube itself: near-black with a faint colour cast
  px(ctx, x, y, w, h, lost ? '#170808' : won ? '#08160b' : '#07100c')

  const phos = lost ? P.bloodLit : won ? P.greenLit : P.green
  const phosLit = lost ? '#ff8a72' : won ? '#b6e88a' : P.greenLit

  // the book: five rows of bar, the length keyed off the quote so the screen
  // and the number under it never disagree
  const rows = 5
  for (let r = 0; r < rows; r++) {
    const seed = noise2(r * 3.7, Math.floor(o.t / 520))
    const base = r === 2 ? o.prob : o.prob * 0.55 + seed * 0.5
    const bw = Math.max(3, Math.round(base * (w - 22)))
    const ry = y + 6 + r * 5
    pxa(ctx, x + 4, ry, bw, 2, phos, 0.5)
    pxa(ctx, x + 4, ry, Math.min(bw, 3), 2, phosLit, 0.8)
    // the ask on the right, a stub that twitches
    pxa(ctx, x + w - 8 - (seed > 0.5 ? 2 : 0), ry, 4, 2, phos, 0.35)
  }

  // the price line, centre
  const priceY = y + 34
  pxa(ctx, x + 3, priceY - 3, w - 6, 1, phos, 0.25)

  if (o.mode === 'resolving') {
    // a sweep going back and forth: it is thinking, or pretending to
    const k = Math.abs(Math.sin(o.phase * Math.PI * 2.6))
    const sx = x + 3 + Math.round(k * (w - 12))
    pxa(ctx, sx, y + 3, 3, h - 6, phosLit, 0.7)
    glyphText(ctx, 'PAID?', x + w / 2, priceY, phos, 2, 0.55)
  } else if (won || lost) {
    // the verdict, hard and centred, with a flash on the first beat
    const flash = Math.max(0, 1 - o.phase * 3)
    if (flash > 0.02) pxa(ctx, x, y, w, h, won ? P.greenLit : P.bloodLit, flash * 0.5)
    glyphText(ctx, won ? 'PAID' : 'CUT', x + w / 2, priceY - 2, phosLit, 3, 1)
  } else if (o.side) {
    glyphText(ctx, o.side === 'yes' ? 'YES' : 'NO', x + w / 2, priceY, phosLit, 3, 0.9)
  } else {
    glyphText(ctx, 'PICK A SIDE', x + w / 2, priceY + 3, phos, 1, 0.7)
  }

  // the ticker along the foot: cents marching left
  const march = Math.floor(o.t / 90) % 6
  for (let i = 0; i < 11; i++) {
    const bx = x + 3 + ((i * 6 + march) % (w - 6))
    const lit = (i + Math.floor(o.t / 300)) % 4 === 0
    pxa(ctx, bx, y + h - 6, 3, 2, lit ? phosLit : phos, lit ? 0.7 : 0.3)
  }

  // scanlines, then the interference his heat earns him
  for (let sy = y; sy < y + h; sy += 2) pxa(ctx, x, sy, w, 1, '#000000', 0.22)
  if (o.heat > 0.05) {
    const band = y + 4 + (Math.floor(o.t / 60) % (h - 10))
    pxa(ctx, x, band, w, 2, phosLit, 0.05 + o.heat * 0.14)
    for (let i = 0; i < Math.round(o.heat * 12); i++) {
      const n = noise2(i * 4.4, Math.floor(o.t / 70))
      const m = noise2(Math.floor(o.t / 70), i * 2.1)
      pxa(ctx, x + n * w, y + m * h, 2, 1, phosLit, 0.3)
    }
  }

  // the curve of the glass: corners dark, one hard specular streak
  for (let i = 0; i < 3; i++) {
    const a = 0.3 - i * 0.09
    dither(ctx, x, y, w, 2 + i * 2, '#000000', 1, a)
    dither(ctx, x, y + h - (2 + i * 2), w, 2 + i * 2, '#000000', 1, a)
    dither(ctx, x, y, 2 + i * 2, h, '#000000', 1, a)
    dither(ctx, x + w - (2 + i * 2), y, 2 + i * 2, h, '#000000', 1, a)
  }
  pxa(ctx, x + 5, y + 4, 12, 1, P.white, 0.12)
  pxa(ctx, x + 5, y + 5, 6, 1, P.white, 0.08)
}
export function drawDeskScene(ctx: Ctx, o: TerminalOpts): void {
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(getDeskStatic(), 0, 0)

  const flick = 0.85 + Math.sin(o.t / 120) * 0.09 + Math.sin(o.t / 61) * 0.06

  // brazier fire + light
  for (const [x, seed] of [
    [14, 0],
    [146, 1.5],
  ] as [number, number][]) {
    lightPool(ctx, x, 100, 40, P.ember, 0.15 * flick)
    const idx = Math.floor(o.t / 100 + seed * 2) % BRAZIER_FLAME.length
    drawMatrix(ctx, BRAZIER_FLAME[idx]!, x - 2, 88, FIRE_CHARS, seed > 1)
    lightPool(ctx, x, DESK.floorY + 22, 30, P.emberLit, 0.1 * flick)
  }

  // the candle on the table
  const ch = 3 + (Math.floor(o.t / 150) % 3)
  pxa(ctx, 129, DESK.topY - 13 - ch, 3, ch, P.emberLit, 0.95)
  lightPool(ctx, 130, DESK.topY - 12, 22, P.ember, 0.11 * flick)

  ctx.drawImage(getCaseStatic(), 0, 0)
  drawGlass(ctx, o)

  // the terminal throws its own light back into the room
  const won = o.mode === 'won'
  const lost = o.mode === 'lost'
  const glow = lost ? P.bloodLit : won ? P.greenLit : P.green
  const strength = won || lost ? 0.22 * Math.max(0.4, 1 - o.phase) : 0.1
  lightPool(ctx, GLASS.x + GLASS.w / 2, GLASS.y + GLASS.h + 16, 54, glow, strength)
  lightPool(ctx, GLASS.x + GLASS.w / 2, GLASS.y + 6, 44, glow, strength * 0.6)

  // vignette
  for (let i = 0; i < 4; i++) {
    const a = 0.13 - i * 0.026
    dither(ctx, 0, 0, DESK.w, 3 + i * 3, '#000000', 1, a)
    dither(ctx, 0, DESK.h - (3 + i * 3), DESK.w, 3 + i * 3, '#000000', 1, a)
    dither(ctx, 0, 0, 3 + i * 3, DESK.h, '#000000', 1, a)
    dither(ctx, DESK.w - (3 + i * 3), 0, 3 + i * 3, DESK.h, '#000000', 1, a)
  }
}
