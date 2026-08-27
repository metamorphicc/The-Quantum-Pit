import type { ReactNode } from 'react'
import { PixelIcon, type IconName } from './PixelIcon'
import type { Currency } from '../game/types'

export type ButtonVariant = 'wood' | 'gold' | 'ember' | 'teal' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface PixelButtonProps {
  label: string
  onClick?: () => void
  icon?: IconName
  /** small line under the label - cooldown text, stock count, etc. */
  sublabel?: string
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  /** stacks icon above label - used for the room action bar */
  stack?: boolean
  full?: boolean
  /** price tag rendered on the right */
  price?: { amount: number; currency: Currency }
  /** corner badge (stock count) */
  badge?: ReactNode
  className?: string
  ariaLabel?: string
}

/**
 * Chunky pixel button: 3px ink border, hard drop edge, presses down 3px.
 * No transitions on colour, no rounded corners, no gradients.
 */
export function PixelButton({
  label,
  onClick,
  icon,
  sublabel,
  variant = 'wood',
  size = 'md',
  disabled = false,
  stack = false,
  full = false,
  price,
  badge,
  className,
  ariaLabel,
}: PixelButtonProps) {
  const iconSize = size === 'lg' ? 24 : size === 'sm' ? 12 : 16

  return (
    <button
      type="button"
      className={[
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        stack ? 'btn--stack' : '',
        full ? 'btn--full' : '',
        disabled ? 'is-disabled' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
    >
      {badge !== undefined && badge !== null && <span className="btn__badge">{badge}</span>}
      {icon && <PixelIcon name={icon} size={iconSize} className="btn__icon" />}
      <span className="btn__text">
        <span className="btn__label">{label}</span>
        {sublabel && <span className="btn__sub">{sublabel}</span>}
      </span>
      {price && (
        <span className="btn__price">
          <PixelIcon name={price.currency === 'bankroll' ? 'coin' : 'shard'} size={12} />
          {price.amount}
        </span>
      )}
    </button>
  )
}
