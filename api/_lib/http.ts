/** Minimal shape of the Vercel Node request/response - avoids a dependency. */
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

export function rejectUnsupportedMethod(req: Req, res: Res): boolean {
  if (req.method === 'GET' || req.method === 'POST') return false
  res.status(405).json({ error: 'Method not allowed.' })
  return true
}

export function rejectUnsafeJson(req: Req, res: Res, maxBytes = 4096): boolean {
  const rawLength = Number(header(req, 'content-length') || 0)
  if (Number.isFinite(rawLength) && rawLength > maxBytes) {
    res.status(413).json({ error: 'Request body is too large.' })
    return true
  }

  const contentType = header(req, 'content-type').toLowerCase()
  if (contentType && !contentType.includes('application/json')) {
    res.status(415).json({ error: 'Expected application/json.' })
    return true
  }

  if (typeof req.body === 'string' && req.body.length > maxBytes) {
    res.status(413).json({ error: 'Request body is too large.' })
    return true
  }

  return false
}
