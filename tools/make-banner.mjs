
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const W = 160
const H = 90
const SCALE = 4
const OUT = resolve(ROOT, 'public/start-banner.png')


class Surface {
  constructor(w, h, fill = '#000000') {
    this.w = w
    this.h = h
    this.data = new Uint8Array(w * h * 3)
    const [r, g, b] = parseColor(fill)
    for (let i = 0; i < this.data.length; i += 3) {
      this.data[i] = r
      this.data[i + 1] = g
      this.data[i + 2] = b
    }
  }
}

const colorCache = new Map()

/** Accepts #rgb, #rrggbb and rgba(r,g,b,a). Returns [r,g,b,a]. */
function parseColor(input) {
  const cached = colorCache.get(input)
  if (cached) return cached
  let out = [255, 0, 255, 1]
  const s = String(input).trim()
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3) {
      out = [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        1,
      ]
    } else if (hex.length >= 6) {
      out = [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      ]
    }
  } else {
    const m = s.match(/^rgba?\(([^)]+)\)$/i)
    if (m) {
      const parts = m[1].split(',').map((p) => Number(p.trim()))
      out = [parts[0] | 0, parts[1] | 0, parts[2] | 0, parts.length > 3 ? parts[3] : 1]
    }
  }
  colorCache.set(input, out)
  return out
}

class Ctx2D {
  constructor(surface) {
    this.s = surface
    this.fillStyle = '#000000'
    this.globalAlpha = 1
    this.imageSmoothingEnabled = false
    this._stack = []
  }

  save() {
    this._stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha })
  }

  restore() {
    const prev = this._stack.pop()
    if (prev) Object.assign(this, prev)
  }

  fillRect(x, y, w, h) {
    const [r, g, b, ca] = parseColor(this.fillStyle)
    const a = Math.max(0, Math.min(1, this.globalAlpha * ca))
    if (a <= 0) return

    const x0 = Math.max(0, Math.round(x))
    const y0 = Math.max(0, Math.round(y))
    const x1 = Math.min(this.s.w, Math.round(x) + Math.round(w))
    const y1 = Math.min(this.s.h, Math.round(y) + Math.round(h))
    const buf = this.s.data

    for (let py = y0; py < y1; py++) {
      let i = (py * this.s.w + x0) * 3
      for (let pxx = x0; pxx < x1; pxx++, i += 3) {
        if (a >= 1) {
          buf[i] = r
          buf[i + 1] = g
          buf[i + 2] = b
        } else {
          buf[i] += (r - buf[i]) * a
          buf[i + 1] += (g - buf[i + 1]) * a
          buf[i + 2] += (b - buf[i + 2]) * a
        }
      }
    }
  }
}

/* ==========================================================================
   PNG encoder (RGB, filter 0). zlib is in the standard library.
   ========================================================================== */

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0 // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(
      raw,
      y * (w * 3 + 1) + 1,
    )
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function upscale(surface, factor) {
  const w = surface.w * factor
  const h = surface.h * factor
  const out = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    const sy = (y / factor) | 0
    for (let x = 0; x < w; x++) {
      const sx = (x / factor) | 0
      const si = (sy * surface.w + sx) * 3
      const di = (y * w + x) * 3
      out[di] = surface.data[si]
      out[di + 1] = surface.data[si + 1]
      out[di + 2] = surface.data[si + 2]
    }
  }
  return { w, h, data: out }
}

/* ==========================================================================
   A 5×7 pixel font — the only art in this file that is not shared with the
   game, because the game draws its text with DOM elements, not canvas.
   ========================================================================== */

const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#..##', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '·': ['.....', '.....', '..##.', '..##.', '.....', '.....', '.....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
}

const GLYPH_ADVANCE = 6
const SPACE_ADVANCE = 4

function measureText(text) {
  let w = 0
  for (const ch of text.toUpperCase()) w += ch === ' ' ? SPACE_ADVANCE : GLYPH_ADVANCE
  return w - 1
}

function drawText(ctx, text, x, y, color) {
  let cx = Math.round(x)
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') {
      cx += SPACE_ADVANCE
      continue
    }
    const rows = GLYPHS[ch]
    if (rows) {
      ctx.fillStyle = color
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '#') ctx.fillRect(cx + i, y + j, 1, 1)
        }
      })
    }
    cx += GLYPH_ADVANCE
  }
}

/** Same text twice: hard shadow underneath, then the real colour. */
function drawTextShadowed(ctx, text, x, y, color, shadow) {
  drawText(ctx, text, x + 1, y + 1, shadow)
  drawText(ctx, text, x, y, color)
}

/* ==========================================================================
   The backdrop: a wider, landscape crop of the same hall the game draws.
   ========================================================================== */

function drawHall(ctx, P, draw) {
  const { px, pxa, outline, pxLine, dither, lightPool, noise2 } = draw
  const FLOOR = 72

  px(ctx, 0, 0, W, H, P.ink)

  /* --- plank wall -------------------------------------------------------- */
  px(ctx, 0, 0, W, FLOOR, P.woodDeep)
  for (let x = 0; x < W; x += 16) {
    const shade = noise2(x, 7)
    px(ctx, x, 0, 15, FLOOR, shade > 0.55 ? P.woodDark : P.woodDeep)
    px(ctx, x + 15, 0, 1, FLOOR, P.ink2) // plank seam
    // knots and grain
    for (let y = 4; y < FLOOR; y += 9) {
      if (noise2(x, y) > 0.62) px(ctx, x + 3, y, 6, 1, P.woodDeep)
    }
  }
  // horizontal beams
  for (const by of [10, 44]) {
    px(ctx, 0, by, W, 5, P.wood)
    px(ctx, 0, by, W, 1, P.woodLit)
    px(ctx, 0, by + 4, W, 1, P.ink2)
    for (let x = 6; x < W; x += 24) px(ctx, x, by + 1, 2, 3, P.woodDark)
  }

  /* --- stone floor ------------------------------------------------------- */
  px(ctx, 0, FLOOR, W, H - FLOOR, P.stoneDark)
  px(ctx, 0, FLOOR, W, 2, P.stoneLit)
  px(ctx, 0, FLOOR + 2, W, 1, P.stoneDeep)
  for (let y = FLOOR + 4; y < H; y += 6) {
    px(ctx, 0, y, W, 1, P.stoneDeep)
    const off = ((y / 6) | 0) % 2 ? 12 : 0
    for (let x = off; x < W; x += 24) px(ctx, x, y, 1, 6, P.stoneDeep)
  }
  dither(ctx, 0, FLOOR + 3, W, H - FLOOR - 3, P.stone, 2, 0.5)
  dither(ctx, 0, FLOOR + 6, W, H - FLOOR - 6, P.stoneLit, 3, 0.3)

  /* --- the door nobody opens -------------------------------------------- */
  // Wide on purpose: the warden covers the middle, so the interesting carving
  // has to live in the margins either side of him.
  const DX = 42
  const DW = 76
  const DTOP = 18
  // stone frame
  px(ctx, DX - 5, DTOP - 4, DW + 10, FLOOR - DTOP + 4, P.stoneDark)
  px(ctx, DX - 5, DTOP - 4, DW + 10, 3, P.stoneLit)
  px(ctx, DX - 5, DTOP - 4, 3, FLOOR - DTOP + 4, P.stone)
  px(ctx, DX + DW + 2, DTOP - 4, 3, FLOOR - DTOP + 4, P.stoneDeep)
  // planks
  px(ctx, DX, DTOP, DW, FLOOR - DTOP, P.woodDark)
  for (let x = DX; x < DX + DW; x += 8) {
    px(ctx, x, DTOP, 7, FLOOR - DTOP, (x / 8) % 2 ? P.woodDark : P.woodDeep)
    px(ctx, x + 7, DTOP, 1, FLOOR - DTOP, P.ink)
  }
  // iron bands and rivets — one above his head, one behind his hips
  for (const by of [DTOP + 2, FLOOR - 18]) {
    px(ctx, DX - 2, by, DW + 4, 4, P.plateDark)
    px(ctx, DX - 2, by, DW + 4, 1, P.plateLit)
    for (let x = DX + 1; x < DX + DW; x += 9) px(ctx, x, by + 1, 2, 2, P.stoneHi)
  }
  // carved wards in the two strips of door that stay visible
  for (const sx of [DX + 8, DX + DW - 9]) {
    outline(ctx, sx - 4, DTOP + 12, 9, 11, P.goldDark, 1)
    px(ctx, sx, DTOP + 14, 1, 7, P.goldDark)
    px(ctx, sx - 2, DTOP + 17, 5, 1, P.goldDark)
    pxa(ctx, sx, DTOP + 14, 1, 7, P.spirit, 0.5)
    pxa(ctx, sx - 2, DTOP + 17, 5, 1, P.spirit, 0.5)
  }
  // cold light leaking around the seams
  for (let i = 0; i < 4; i++) {
    pxa(ctx, DX - 1 - i, DTOP, 1, FLOOR - DTOP, P.spirit, 0.13 - i * 0.03)
    pxa(ctx, DX + DW + i, DTOP, 1, FLOOR - DTOP, P.spirit, 0.13 - i * 0.03)
  }
  dither(ctx, DX - 8, FLOOR, DW + 16, 8, P.spirit, 2, 0.16)

  /* --- banners either side ---------------------------------------------- */
  for (const bx of [DX - 14, DX + DW + 6]) {
    px(ctx, bx, 16, 9, 30, P.bloodDeep)
    px(ctx, bx, 16, 9, 2, P.blood)
    px(ctx, bx, 16, 1, 30, P.bloodLit)
    px(ctx, bx + 3, 24, 3, 3, P.gold)
    px(ctx, bx + 4, 27, 1, 6, P.goldDark)
    // torn point at the bottom
    px(ctx, bx, 46, 4, 3, P.bloodDeep)
    px(ctx, bx + 5, 46, 4, 2, P.bloodDeep)
  }

  /* --- torches ----------------------------------------------------------- */
  for (const tx of [10, W - 17]) {
    px(ctx, tx + 2, 30, 3, 14, P.woodDark)
    px(ctx, tx, 26, 7, 5, P.plateDark)
    px(ctx, tx, 26, 7, 1, P.plateLit)
    px(ctx, tx + 1, 21, 5, 6, P.ember)
    px(ctx, tx + 2, 18, 3, 5, P.emberLit)
    px(ctx, tx + 3, 16, 1, 3, P.emberPale)
    lightPool(ctx, tx + 3, 28, 34, P.ember, 0.5)
    pxa(ctx, tx - 4, 22, 15, 16, P.emberLit, 0.08)
  }
  // warm bounce along the floor under each torch
  for (const tx of [10, W - 17]) dither(ctx, tx - 14, FLOOR, 34, 10, P.ember, 2, 0.2)

  /* --- dust, vignette ---------------------------------------------------- */
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(noise2(i, 1) * W)
    const y = Math.floor(noise2(i, 2) * FLOOR)
    pxa(ctx, x, y, 1, 1, P.boneDim, 0.05 + noise2(i, 3) * 0.1)
  }
  for (let i = 0; i < 10; i++) {
    const a = 0.3 - i * 0.03
    pxa(ctx, i, 0, 1, H, P.ink, a)
    pxa(ctx, W - 1 - i, 0, 1, H, P.ink, a)
    if (i < 5) {
      pxa(ctx, 0, i, W, 1, P.ink, a)
      // the bottom edge stays lighter, or his boots disappear into it
      pxa(ctx, 0, H - 1 - i, W, 1, P.ink, a * 0.45)
    }
  }
  pxLine(ctx, 0, 0, 0, H, P.ink, 1)
}

/** Dark plaque with a gold rule — the same frame language as the in-game HUD. */
function drawPlaque(ctx, P, draw, x, y, w, h) {
  const { px, pxa, outline } = draw
  pxa(ctx, x + 2, y + 2, w, h, P.ink, 0.55)
  px(ctx, x, y, w, h, P.ink2)
  outline(ctx, x, y, w, h, P.woodDark, 2)
  outline(ctx, x + 2, y + 2, w - 4, h - 4, P.goldDark, 1)
  for (const cx of [x + 3, x + w - 5]) {
    px(ctx, cx, y + 3, 2, 2, P.gold)
    px(ctx, cx, y + h - 5, 2, 2, P.gold)
  }
}

/* ==========================================================================
   Main
   ========================================================================== */

/** Bundles a TS module out of src/ and imports it without touching the disk. */
async function importFromSrc(entry) {
  const built = await esbuild.build({
    entryPoints: [resolve(ROOT, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2020',
  })
  const code = built.outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

const [warden, draw, palette] = await Promise.all([
  importFromSrc('src/render/warden.ts'),
  importFromSrc('src/render/draw.ts'),
  importFromSrc('src/styles/palette.ts'),
])
const P = palette.P

const surface = new Surface(W, H, P.ink)
const ctx = new Ctx2D(surface)

drawHall(ctx, P, draw)

// A fixed timestamp keeps the output byte-identical between runs: no blink
// (the blink window is (t/1000) % 5.4 < 0.16) and a settled breathing pose.
const T = 2000
const HERO_X = Math.round(W / 2)
const HERO_Y = 86

// Light the flagstones he stands on, then a contact shadow — without both, the
// dark boots and the dark floor merge into one shape.
draw.lightPool(ctx, HERO_X, HERO_Y - 2, 40, P.emberPale, 0.16)
for (let i = 0; i < 3; i++) {
  draw.pxa(ctx, HERO_X - 15 + i * 3, HERO_Y - 2 + i, 30 - i * 6, 2, P.ink, 0.3)
}

warden.drawWardenPortrait(
  ctx,
  HERO_X,
  HERO_Y,
  { head: 'head_circlet', cloak: 'cloak_watch', blade: 'blade_spirit' },
  T,
  { hunger: 82, energy: 78, mood: 74, clean: 90, spirit: 96 },
)

// Title, on its plaque, above his head.
const TITLE = 'KEEP THE WARDEN'
const tw = measureText(TITLE)
const tx = Math.round((W - tw) / 2)
drawPlaque(ctx, P, draw, tx - 7, 1, tw + 14, 15)
drawTextShadowed(ctx, TITLE, tx, 5, P.goldLit, P.ink)

// Small mark down in the corner.
const SUB = 'LOWER GATE'
drawTextShadowed(ctx, SUB, W - measureText(SUB) - 6, H - 12, P.boneDeep, P.ink)

const big = upscale(surface, SCALE)
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, encodePNG(big.w, big.h, big.data))
console.log(`wrote ${OUT} — ${big.w}×${big.h}`)
