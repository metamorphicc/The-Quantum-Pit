import type { ReactNode } from 'react'
import { PixelIcon, type IconName } from './PixelIcon'

export type PanelVariant = 'wood' | 'darkwood' | 'stone' | 'ink'
export type PanelPad = 'none' | 'sm' | 'md'

export interface PixelPanelProps {
  children?: ReactNode
  variant?: PanelVariant
  /** carved header strip */
  title?: string
  titleIcon?: IconName
  /** trailing content in the header strip (counters, small buttons) */
  titleRight?: ReactNode
  /** gold corner studs */
  rivets?: boolean
  pad?: PanelPad
  className?: string
  style?: React.CSSProperties
}

/** Base surface for pixel panels: thick border, hard bevel, optional header. */
export function PixelPanel({
  children,
  variant = 'wood',
  title,
  titleIcon,
  titleRight,
  rivets = false,
  pad = 'md',
  className,
  style,
}: PixelPanelProps) {
  return (
    <div
      className={`panel panel--${variant} ${className ?? ''}`}
      style={style}
    >
      {rivets && (
        <>
          <i className="panel__rivet panel__rivet--tl" />
          <i className="panel__rivet panel__rivet--tr" />
          <i className="panel__rivet panel__rivet--bl" />
          <i className="panel__rivet panel__rivet--br" />
        </>
      )}

      {title && (
        <div className="panel__head">
          {titleIcon && <PixelIcon name={titleIcon} size={16} />}
          <span className="panel__title t-title">{title}</span>
          {titleRight && <div className="panel__head-right">{titleRight}</div>}
        </div>
      )}

      <div className={`panel__body panel__body--${pad}`}>{children}</div>
    </div>
  )
}
