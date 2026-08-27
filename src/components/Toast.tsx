import { useEffect, useState } from 'react'
import { onToast, type ToastEvent } from '../game/fx'
const LIFE_MS = 2600
/** at most this many stacked at once - older ones fall off the top */
const MAX = 3

export function Toast() {
  const [items, setItems] = useState<ToastEvent[]>([])

  useEffect(() => {
    const off = onToast((t) => {
      setItems((prev) => [...prev, t].slice(-MAX))
      window.setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.id !== t.id))
      }, LIFE_MS)
    })
    return off
  }, [])

  if (items.length === 0) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((it) => (
        <div key={it.id} className={`toast toast--${it.tone}`}>
          <span className="toast__mark" aria-hidden="true" />
          <span className="toast__body">
            <span className="toast__text">{it.text}</span>
            {it.sub && <span className="toast__sub">{it.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
