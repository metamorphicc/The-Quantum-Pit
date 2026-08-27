import { P } from '../styles/palette'
import { px, pxa, type Ctx } from './draw'
import type { ParticleKind } from '../game/fx'
interface Particle {
  alive: boolean
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  /** ms remaining */
  life: number
  maxLife: number
  size: number
  grav: number
  drag: number
  spin: number
  color: string
  color2: string
}

interface KindDef {
  life: [number, number]
  speed: [number, number]
  /** launch cone, degrees: centre + spread */
  angle: [number, number]
  size: [number, number]
  grav: number
  drag: number
  colors: readonly string[]
  colors2?: readonly string[]
}

const KINDS: Record<ParticleKind, KindDef> = {
  spark: {
    life: [340, 620],
    speed: [0.035, 0.09],
    angle: [90, 160],
    size: [1, 2],
    grav: -0.00004,
    drag: 0.9985,
    colors: [P.spiritLit, P.spiritPale, P.spirit, P.white],
  },
  ember: {
    life: [500, 950],
    speed: [0.015, 0.05],
    angle: [90, 70],
    size: [1, 2],
    grav: -0.00007,
    drag: 0.999,
    colors: [P.ember, P.emberLit, P.emberPale],
  },
  dust: {
    life: [340, 640],
    speed: [0.02, 0.06],
    angle: [90, 180],
    size: [1, 3],
    grav: 0.00006,
    drag: 0.994,
    colors: ['#6a5842', '#54452f', '#7d6a4f'],
  },
  suds: {
    life: [520, 980],
    speed: [0.015, 0.055],
    angle: [90, 150],
    size: [2, 3],
    grav: -0.00003,
    drag: 0.996,
    colors: [P.tealLit, P.bone, P.white],
    colors2: [P.tealDeep, P.boneDim, P.tealLit],
  },
  crumb: {
    life: [420, 760],
    speed: [0.03, 0.075],
    angle: [90, 130],
    size: [1, 2],
    grav: 0.00028,
    drag: 0.998,
    colors: ['#8a5a2c', '#a97a3c', P.strawDark, '#6b4420'],
  },
  zzz: {
    life: [900, 1300],
    speed: [0.012, 0.024],
    angle: [72, 24],
    size: [3, 5],
    grav: -0.00002,
    drag: 0.999,
    colors: [P.bone, P.boneDim],
  },
  straw: {
    life: [520, 900],
    speed: [0.02, 0.06],
    angle: [90, 170],
    size: [1, 3],
    grav: 0.00012,
    drag: 0.993,
    colors: [P.straw, P.strawLit, P.strawDark],
  },
  coin: {
    life: [620, 820],
    speed: [0.05, 0.085],
    angle: [90, 45],
    size: [3, 4],
    grav: 0.00026,
    drag: 0.999,
    colors: [P.gold, P.goldLit],
    colors2: [P.goldDark, P.gold],
  },
}

const MAX = 180
const D = Math.PI / 180

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export class ParticleSystem {
  private pool: Particle[] = []
  private cursor = 0
  /** where crumbs, coins and straw come to rest */
  private floorY: number

  constructor(floorY = 198) {
    this.floorY = floorY
    for (let i = 0; i < MAX; i++) {
      this.pool.push({
        alive: false,
        kind: 'spark',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        grav: 0,
        drag: 1,
        spin: 0,
        color: '#fff',
        color2: '#fff',
      })
    }
  }

  get live(): number {
    let n = 0
    for (const p of this.pool) if (p.alive) n++
    return n
  }

  clear(): void {
    for (const p of this.pool) p.alive = false
  }

  /**
   * @param power 1 = normal. Scales speed and life.
   */
  spawn(kind: ParticleKind, x: number, y: number, count: number, power = 1): void {
    const def = KINDS[kind]
    for (let i = 0; i < count; i++) {
      const p = this.next()
      const [centre, spread] = def.angle
      const a = (centre + rand(-spread / 2, spread / 2)) * D
      const speed = rand(def.speed[0], def.speed[1]) * power
      p.alive = true
      p.kind = kind
      p.x = x + rand(-2, 2)
      p.y = y + rand(-2, 2)
      p.vx = Math.cos(a) * speed
      p.vy = -Math.sin(a) * speed
      p.maxLife = rand(def.life[0], def.life[1]) * (0.7 + power * 0.3)
      p.life = p.maxLife
      p.size = Math.round(rand(def.size[0], def.size[1]))
      p.grav = def.grav
      p.drag = def.drag
      p.spin = rand(0, Math.PI * 2)
      p.color = pick(def.colors)
      p.color2 = def.colors2 ? pick(def.colors2) : p.color
    }
  }

  private next(): Particle {
    // reuse the oldest dead slot, else steal the next one round-robin
    for (let i = 0; i < MAX; i++) {
      const idx = (this.cursor + i) % MAX
      const p = this.pool[idx]!
      if (!p.alive) {
        this.cursor = (idx + 1) % MAX
        return p
      }
    }
    const p = this.pool[this.cursor]!
    this.cursor = (this.cursor + 1) % MAX
    return p
  }

  update(dt: number): void {
    const step = Math.min(dt, 48)
    for (const p of this.pool) {
      if (!p.alive) continue
      p.life -= step
      if (p.life <= 0) {
        p.alive = false
        continue
      }
      p.vy += p.grav * step
      p.vx *= p.drag
      p.x += p.vx * step
      p.y += p.vy * step
      p.spin += step * 0.012

      // crumbs, coins and straw settle on the floor instead of sinking through
      if (
        (p.kind === 'crumb' || p.kind === 'coin' || p.kind === 'straw') &&
        p.y > this.floorY
      ) {
        p.y = this.floorY
        p.vy *= -0.3
        p.vx *= 0.6
        if (Math.abs(p.vy) < 0.006) p.vy = 0
      }
    }
  }

  draw(ctx: Ctx): void {
    for (const p of this.pool) {
      if (!p.alive) continue
      const k = p.life / p.maxLife
      const x = Math.round(p.x)
      const y = Math.round(p.y)

      switch (p.kind) {
        case 'spark': {
          const a = k > 0.6 ? 1 : k / 0.6
          pxa(ctx, x, y, p.size, p.size, p.color, a)
          if (k > 0.75) pxa(ctx, x - 1, y - 1, p.size + 2, p.size + 2, p.color, 0.22)
          break
        }
        case 'ember': {
          const a = Math.min(1, k * 1.6)
          const flick = Math.sin(p.spin * 6) > -0.4
          if (flick) pxa(ctx, x, y, p.size, p.size, p.color, a)
          break
        }
        case 'suds': {
          const a = Math.min(1, k * 1.5)
          const s = k < 0.25 ? 1 : p.size
          pxa(ctx, x, y, s, s, p.color2, a * 0.8)
          pxa(ctx, x, y, 1, 1, p.color, a)
          break
        }
        case 'zzz': {
          const a = Math.min(1, k * 1.4)
          drawZ(ctx, x, y, p.size, p.color, a)
          break
        }
        case 'coin': {
          // 4-frame spin: wide, narrow, edge, narrow
          const frame = Math.floor(p.spin * 2.2) % 4
          const w = frame === 0 ? p.size : frame === 2 ? 1 : Math.max(1, p.size - 2)
          const a = k > 0.25 ? 1 : k / 0.25
          pxa(ctx, x - (w >> 1), y, w, p.size, p.color, a)
          pxa(ctx, x - (w >> 1), y, w, 1, P.goldLit, a)
          pxa(ctx, x - (w >> 1), y + p.size - 1, w, 1, P.goldDark, a)
          break
        }
        case 'crumb':
        case 'straw':
        case 'dust':
        default: {
          const a = Math.min(1, k * 1.7)
          pxa(ctx, x, y, p.size, p.size, p.color, a)
          break
        }
      }
    }
  }
}

/** Tiny pixel "Z" for the sleep marks. */
function drawZ(ctx: Ctx, x: number, y: number, size: number, color: string, alpha: number): void {
  const w = Math.max(3, size)
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * alpha
  px(ctx, x, y, w, 1, color)
  px(ctx, x, y + w - 1, w, 1, color)
  for (let i = 0; i < w - 2; i++) {
    px(ctx, x + w - 2 - i, y + 1 + i, 1, 1, color)
  }
  ctx.globalAlpha = prev
}
