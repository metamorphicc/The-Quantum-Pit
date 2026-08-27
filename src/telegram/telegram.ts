export type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
export type HapticNotification = 'error' | 'success' | 'warning'

interface SafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  viewportHeight: number
  viewportStableHeight: number
  isExpanded: boolean
  safeAreaInset?: SafeAreaInset
  contentSafeAreaInset?: SafeAreaInset
  ready: () => void
  expand: () => void
  close: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  openInvoice?: (url: string, cb?: (status: string) => void) => void
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
  enableClosingConfirmation?: () => void
  disableVerticalSwipes?: () => void
  onEvent: (event: string, cb: (...args: unknown[]) => void) => void
  offEvent: (event: string, cb: (...args: unknown[]) => void) => void
  BackButton?: {
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void
    notificationOccurred: (type: HapticNotification) => void
    selectionChanged: () => void
  }
  /** Per-account key/value store, Bot API 6.9+. Values are capped at 4096 chars. */
  CloudStorage?: {
    setItem: (key: string, value: string, cb?: (err: string | null, ok?: boolean) => void) => void
    getItem: (key: string, cb: (err: string | null, value?: string) => void) => void
    removeItem: (key: string, cb?: (err: string | null, ok?: boolean) => void) => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

function wa(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp
}

export const isTelegram = (): boolean => Boolean(wa()?.initData !== undefined && wa()?.platform !== undefined)

export function tgInitData(): string | null {
  return wa()?.initData ?? null
}

export function tgUserName(): string | null {
  return wa()?.initDataUnsafe?.user?.first_name ?? null
}

/** Numeric Telegram account id, or null outside Telegram. Namespaces the save. */
export function tgUserId(): number | null {
  const id = wa()?.initDataUnsafe?.user?.id
  return typeof id === 'number' && Number.isFinite(id) ? id : null
}

export function tgUsername(): string | null {
  return wa()?.initDataUnsafe?.user?.username ?? null
}

/** Compare "7.7" style versions. */
function versionAtLeast(target: string): boolean {
  const cur = wa()?.version
  if (!cur) return false
  const a = cur.split('.').map(Number)
  const b = target.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return true
}

const BG = '#120c08'
function applyViewport(): void {
  const app = wa()
  const root = document.documentElement
  const h = app?.viewportStableHeight
  if (h && h > 0) {
    root.style.setProperty('--app-h', `${Math.round(h)}px`)
  } else {
    root.style.setProperty('--app-h', '100dvh')
  }

  // Telegram 8.0+ reports device + content safe areas. Take the larger of the
  // two for the top (that is where the drag handle / status bar sits).
  const sa = app?.safeAreaInset
  const csa = app?.contentSafeAreaInset
  if (sa || csa) {
    const top = Math.max(sa?.top ?? 0, csa?.top ?? 0)
    const bottom = Math.max(sa?.bottom ?? 0, csa?.bottom ?? 0)
    const left = Math.max(sa?.left ?? 0, csa?.left ?? 0)
    const right = Math.max(sa?.right ?? 0, csa?.right ?? 0)
    root.style.setProperty('--sa-top', `${top}px`)
    root.style.setProperty('--sa-bottom', `${bottom}px`)
    root.style.setProperty('--sa-left', `${left}px`)
    root.style.setProperty('--sa-right', `${right}px`)
  }
}

let initialised = false

export function initTelegram(): void {
  if (initialised) return
  initialised = true

  const app = wa()

  // Always apply the fallback viewport height, Telegram or not.
  applyViewport()
  window.addEventListener('resize', applyViewport)
  window.addEventListener('orientationchange', applyViewport)

  if (!app) return

  try {
    app.ready()
    app.expand()
    // Colour setters landed in Bot API 6.1; the bottom bar only in 7.10. The
    // SDK logs a warning if you call them on an older client, so gate them.
    if (versionAtLeast('6.1')) {
      app.setHeaderColor?.(BG)
      app.setBackgroundColor?.(BG)
    }
    if (versionAtLeast('7.10')) app.setBottomBarColor?.(BG)
    // Stops the "pull down to close" gesture from fighting with taps on the
    // character. Available from Bot API 7.7.
    if (versionAtLeast('7.7')) app.disableVerticalSwipes?.()

    app.onEvent('viewportChanged', applyViewport)
    app.onEvent('safeAreaChanged', applyViewport)
    app.onEvent('contentSafeAreaChanged', applyViewport)
  } catch {
    /* older client - degrade quietly */
  }
}
let backHandler: (() => void) | null = null

export function setBackButton(handler: (() => void) | null): void {
  const bb = wa()?.BackButton
  if (!bb || !versionAtLeast('6.1')) return
  if (backHandler) {
    bb.offClick(backHandler)
    backHandler = null
  }
  if (handler) {
    backHandler = handler
    bb.onClick(backHandler)
    bb.show()
  } else {
    bb.hide()
  }
}
/** The SDK warns on every call in older clients, so check the version first. */
function haptics(): TelegramWebApp['HapticFeedback'] | undefined {
  if (!versionAtLeast('6.1')) return undefined
  return wa()?.HapticFeedback
}

export function haptic(style: HapticStyle = 'light'): void {
  try {
    haptics()?.impactOccurred(style)
  } catch {
    /* ignore */
  }
}

export function hapticNotify(type: HapticNotification): void {
  try {
    haptics()?.notificationOccurred(type)
  } catch {
    /* ignore */
  }
}

export function hapticSelect(): void {
  try {
    haptics()?.selectionChanged()
  } catch {
    /* ignore */
  }
}

export function closeApp(): void {
  try {
    wa()?.close()
  } catch {
    /* ignore */
  }
}

export function telegramInfo(): { platform: string; version: string } | null {
  const app = wa()
  if (!app) return null
  return { platform: app.platform, version: app.version }
}

export function openTelegramInvoice(url: string): Promise<string> {
  const app = wa()
  if (!app?.openInvoice || !versionAtLeast('6.1')) {
    return Promise.reject(new Error('Telegram invoice is not available in this client.'))
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (status: string) => {
      if (settled) return
      settled = true
      resolve(status)
    }
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Telegram invoice timed out.'))
    }, 120_000)
    try {
      app.openInvoice?.(url, (status) => {
        window.clearTimeout(timer)
        done(status)
      })
    } catch (error) {
      window.clearTimeout(timer)
      reject(error instanceof Error ? error : new Error('Could not open Telegram invoice.'))
    }
  })
}

export function openTelegramExternalLink(url: string): void {
  const app = wa()
  if (app?.openLink) {
    app.openLink(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
function cloud(): TelegramWebApp['CloudStorage'] | undefined {
  if (!versionAtLeast('6.9')) return undefined
  return wa()?.CloudStorage
}

export function cloudAvailable(): boolean {
  return Boolean(cloud())
}

/** Resolves to the stored string, or null if missing / unsupported / errored. */
export function cloudGet(key: string): Promise<string | null> {
  const cs = cloud()
  if (!cs) return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const done = (v: string | null) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    // Some clients simply never call back. Do not hang the boot on it.
    const timer = window.setTimeout(() => done(null), 4000)
    try {
      cs.getItem(key, (err, value) => {
        window.clearTimeout(timer)
        done(err || !value ? null : value)
      })
    } catch {
      window.clearTimeout(timer)
      done(null)
    }
  })
}

/** Resolves true if the value was stored. */
export function cloudSet(key: string, value: string): Promise<boolean> {
  const cs = cloud()
  // The documented ceiling is 4096 characters per value.
  if (!cs || value.length > 4096) return Promise.resolve(false)
  return new Promise((resolve) => {
    try {
      cs.setItem(key, value, (err, ok) => resolve(!err && ok !== false))
    } catch {
      resolve(false)
    }
  })
}

export function cloudRemove(key: string): Promise<boolean> {
  const cs = cloud()
  if (!cs) return Promise.resolve(false)
  return new Promise((resolve) => {
    try {
      cs.removeItem(key, (err, ok) => resolve(!err && ok !== false))
    } catch {
      resolve(false)
    }
  })
}
