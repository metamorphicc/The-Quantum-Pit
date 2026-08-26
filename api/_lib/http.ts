/* ==========================================================================
   Shared HTTP helpers for the Vercel Functions in api/.

   Files under api/_lib are NOT routed as endpoints (Vercel ignores the
   leading underscore); they are plain modules the handlers import.
   ========================================================================== */

/** Minimal shape of the Vercel Node request/response — avoids a dependency. */
export interface Req {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface Res {
  status: (code: number) => Res
  json: (body: unknown) => void
  end: (body?: string) => void
}

/** Parses a JSON body whether Vercel handed us a string or a parsed object. */
export function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

/** Case-insensitive single header read. */
export function header(req: Req, name: string): string {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()]
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
