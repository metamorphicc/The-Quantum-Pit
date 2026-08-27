import { PixelIcon, type IconName } from './PixelIcon'
import type { Currency } from '../game/types'

export interface ItemSlotProps {
  icon?: IconName
  label?: string
  /** stock counter in the corner */
  count?: number
  /** chained + padlocked */
  locked?: boolean
  selected?: boolean
  /** gold check marker (currently worn) */
  equipped?: boolean
  price?: { amount: number; currency: Currency }
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  /** empty slot with a dashed carve, e.g. an unused equipment socket */
  empty?: boolean
  className?: string
  ariaLabel?: string
}

/**
 * Inventory-style socket. Square, carved into the panel, thick ink border.
 * Locked slots get a chain band and a padlock, like an unopened stash row.
 */
export function ItemSlot({
  icon,
  label,
  count,
  locked = false,
  selected = false,
  equipped = false,
  price,
  onClick,
  size = 'md',
  empty = false,
  className,
  ariaLabel,
}: ItemSlotProps) {
  const iconSize = size === 'lg' ? 40 : size === 'sm' ? 20 : 32

  return (
    <button
      type="button"
      className={[
        'slot',
        `slot--${size}`,
        selected ? 'is-selected' : '',
        locked ? 'is-locked' : '',
        empty ? 'is-empty' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      aria-label={ariaLabel ?? label ?? 'item'}
      aria-pressed={selected}
    >
      <div className="slot__inner">
        {icon && !empty && <PixelIcon name={icon} size={iconSize} className="slot__icon" />}
        {empty && <span className="slot__empty-mark">-</span>}

        {locked && (
          <>
            <span className="slot__chain" />
            <span className="slot__lock">
              <PixelIcon name="lock" size={16} />
            </span>
          </>
        )}

        {equipped && (
          <span className="slot__equipped">
            <PixelIcon name="check" size={12} />
          </span>
        )}

        {count !== undefined && count > 0 && <span className="slot__count">{count}</span>}
      </div>

      {label && <span className="slot__label">{label}</span>}

      {price && (
        <span className="slot__price">
          <PixelIcon name={price.currency === 'bankroll' ? 'coin' : 'shard'} size={10} />
          {price.amount}
        </span>
      )}
    </button>
  )
}
