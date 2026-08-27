import { PixelIcon, type IconName } from './PixelIcon'

export interface PixelBarProps {
  label?: string
  icon?: IconName
  value: number
  max?: number
  color: string
  colorDark: string
  /** blink when the value is critical */
  low?: boolean
  /** show the numeric value on the right */
  showValue?: boolean
  /** replaces the numeric value with arbitrary text (money, "12/20", ...) */
  valueText?: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * RPG stat bar. The fill is quantised to 5% steps so it moves in visible
 * chunks instead of sliding smoothly - reads as pixel segments, not a
 * progress bar.
 */
export function PixelBar({
  label,
  icon,
  value,
  max = 100,
  color,
  colorDark,
  low = false,
  showValue = true,
  valueText,
  size = 'md',
  className,
}: PixelBarProps) {
  const raw = Math.max(0, Math.min(1, value / max))
  const pct = Math.round(raw * 20) * 5

  return (
    <div className={`bar bar--${size} ${low ? 'bar--low' : ''} ${className ?? ''}`}>
      {icon && <PixelIcon name={icon} size={size === 'sm' ? 12 : 16} />}
      {label && <span className="bar__label">{label}</span>}
      <div className="bar__track">
        <div
          className="bar__fill"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `inset 0 -3px 0 0 ${colorDark}, inset 0 2px 0 0 rgba(255,255,255,0.18)`,
          }}
        />
        <div className="bar__notches" />
      </div>
      {showValue && <span className="bar__value">{valueText ?? Math.round(value)}</span>}
    </div>
  )
}
