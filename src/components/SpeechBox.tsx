export interface SpeechBoxProps {
  text: string
  /** bump to replay the entry animation */
  animKey?: number
  className?: string
}

/** Status line under the room, styled as a chunky pixel plaque. */
export function SpeechBox({ text, animKey = 0, className }: SpeechBoxProps) {
  return (
    <div className={`speech ${className ?? ''}`}>
      <span className="speech__nib" />
      <p key={animKey} className="speech__text anim-slide-up">
        {text}
      </p>
    </div>
  )
}
