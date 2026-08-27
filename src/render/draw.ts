export type Ctx = CanvasRenderingContext2D

export function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)))
}

export function pxa(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha: number,
): void {
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * alpha
  px(ctx, x, y, w, h, color)
  ctx.globalAlpha = prev
}

export function outline(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  t = 1,
): void {
  px(ctx, x, y, w, t, color)
  px(ctx, x, y + h - t, w, t, color)
  px(ctx, x, y, t, h, color)
  px(ctx, x + w - t, y, t, h, color)
}

/** Bresenham line with square caps for crisp pixel strokes. */
export function pxLine(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  thickness = 1,
): void {
  let x = Math.round(x0)
  let y = Math.round(y0)
  const ex = Math.round(x1)
  const ey = Math.round(y1)
  const dx = Math.abs(ex - x)
  const dy = Math.abs(ey - y)
  const sx = x < ex ? 1 : -1
  const sy = y < ey ? 1 : -1
  let err = dx - dy
  const o = Math.floor(thickness / 2)

  ctx.fillStyle = color
  // guard against pathological lengths
  for (let guard = 0; guard < 2048; guard++) {
    ctx.fillRect(x - o, y - o, thickness, thickness)
    if (x === ex && y === ey) break
    const e2 = err * 2
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
  }
}

/** Checkerboard fill - cheap pixel-art shading / soft light falloff. */
export function dither(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  /** 1 = every other pixel, 2 = every 4th, 3 = sparse */
  step = 1,
  alpha = 1,
): void {
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * alpha
  ctx.fillStyle = color
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  const period = step + 1
  for (let j = 0; j < h; j++) {
    for (let i = (j % period === 0 ? 0 : step); i < w; i += period) {
      if ((i + j) % period === 0) ctx.fillRect(x0 + i, y0 + j, 1, 1)
    }
  }
  ctx.globalAlpha = prev
}

/**
 * Concentric dithered rings for a pixel light pool without gradients.
 */
export function lightPool(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  strength = 0.5,
): void {
  const rings = 3
  for (let i = rings; i >= 1; i--) {
    const r = (radius * i) / rings
    const a = (strength * (rings - i + 1)) / (rings + 1)
    dither(ctx, cx - r, cy - r * 0.6, r * 2, r * 1.2, color, i === 1 ? 1 : i, a)
  }
}

/** Static value noise in [0,1) - same input always gives the same output. */
export function noise2(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return n - Math.floor(n)
}

/** Draws a character-matrix sprite. `chars` maps a letter to a colour. */
export function drawMatrix(
  ctx: Ctx,
  rows: readonly string[],
  x: number,
  y: number,
  chars: Record<string, string>,
  flip = false,
): void {
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]!
      const color = chars[ch]
      if (!color) continue
      const dx = flip ? row.length - 1 - i : i
      ctx.fillStyle = color
      ctx.fillRect(x0 + dx, y0 + j, 1, 1)
    }
  })
}
