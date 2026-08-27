import { useState } from 'react'
import { ItemSlot } from '../components/ItemSlot'
import { PixelButton } from '../components/PixelButton'
import { PixelIcon } from '../components/PixelIcon'
import { PixelPanel } from '../components/PixelPanel'
import { ScreenHeader } from '../components/ScreenHeader'
import { FloatingTextLayer } from '../components/FloatingTextLayer'
import { cooldownLeft, deskRead, deskReadGainWithRig, say, setScreen, useSupply } from '../game/actions'
import { EDGE_SOFT_CAP, STATS, STAT_ORDER, SUPPLIES } from '../game/config'
import { useGameState } from '../game/store'
import { formatSeconds } from '../game/util'
export function ResearchScreen() {
  const s = useGameState()
  const stocked = SUPPLIES.filter((f) => (s.stash[f.id] ?? 0) > 0)
  const [selectedId, setSelectedId] = useState<string | null>(stocked[0]?.id ?? null)

  const selected = stocked.find((f) => f.id === selectedId) ?? stocked[0] ?? null
  const stock = selected ? (s.stash[selected.id] ?? 0) : 0
  const saturated = s.stats.edge >= EDGE_SOFT_CAP
  const readLeft = cooldownLeft('read')
  const readGain = deskReadGainWithRig()

  const consume = () => {
    if (!selected) return
    const result = useSupply(selected.id)
    if (result.ok && (s.stash[selected.id] ?? 0) - 1 <= 0) {
      const next = stocked.find((f) => f.id !== selected.id)
      setSelectedId(next?.id ?? null)
    }
    if (!result.ok && result.message) say(result.message)
  }

  return (
    <div className="screen">
      <ScreenHeader title="Notes & Signals" />

      <div className="screen__body">
        <FloatingTextLayer />

        <PixelPanel variant="darkwood" title="On the desk" titleIcon="stew" pad="sm" rivets>
          {stocked.length ? (
            <div className="grid grid--4">
              {stocked.map((supply) => (
                <ItemSlot
                  key={supply.id}
                  icon={supply.icon}
                  label={supply.name}
                  count={s.stash[supply.id]}
                  selected={selected?.id === supply.id}
                  onClick={() => setSelectedId(supply.id)}
                  ariaLabel={`${supply.name}, ${s.stash[supply.id]} left`}
                />
              ))}
              {Array.from({ length: Math.max(0, 4 - (stocked.length % 4 || 4)) }).map((_, i) => (
                <ItemSlot key={`pad-${i}`} empty />
              ))}
            </div>
          ) : (
            <div className="empty-note">
              <PixelIcon name="skull" size={20} />
              <p className="t-body t-dim">
                Nothing left but a cold mug and yesterday&apos;s printout.
              </p>
              <PixelButton
                label="Go to Supply"
                icon="bag"
                variant="gold"
                size="sm"
                onClick={() => setScreen('shop')}
              />
            </div>
          )}
        </PixelPanel>

        {selected ? (
          <PixelPanel
            variant="wood"
            title={selected.name}
            titleIcon={selected.icon}
            titleRight={<span className="t-label t-dim">x{stock}</span>}
            pad="md"
            rivets
          >
            <p className="t-body detail__desc">{selected.desc}</p>

            <ul className="detail__gains">
              {STAT_ORDER.filter((k) => typeof selected.gain[k] === 'number').map((k) => {
                const v = selected.gain[k]!
                // Heat reads backwards: more of it is the bad outcome
                const good = STATS[k].inverted ? v < 0 : v > 0
                return (
                  <li key={k} className={good ? 'is-up' : 'is-down'}>
                    <PixelIcon name={STATS[k].icon} size={12} />
                    <span>{STATS[k].label}</span>
                    <b>
                      {v > 0 ? '+' : ''}
                      {v}
                    </b>
                  </li>
                )
              })}
            </ul>

            <PixelButton
              label={saturated && (selected.gain.edge ?? 0) > 0 ? 'Nothing left to learn' : 'Read it'}
              icon="stew"
              variant="ember"
              size="lg"
              full
              disabled={stock <= 0}
              onClick={consume}
            />
          </PixelPanel>
        ) : null}

        {/* the free read - slow, small, and always available */}
        <PixelPanel variant="stone" title="Just sit and read" titleIcon="swordBlue" pad="md">
          <p className="t-body detail__desc">
            No notes, no signal, no shortcut. An hour with the resolution rules and a pencil.
          </p>
          <ul className="detail__gains">
            {STAT_ORDER.filter((k) => typeof readGain[k] === 'number').map((k) => {
              const v = readGain[k]!
              const good = STATS[k].inverted ? v < 0 : v > 0
              return (
                <li key={k} className={good ? 'is-up' : 'is-down'}>
                  <PixelIcon name={STATS[k].icon} size={12} />
                  <span>{STATS[k].label}</span>
                  <b>
                    {v > 0 ? '+' : ''}
                    {v}
                  </b>
                </li>
              )
            })}
          </ul>
          <PixelButton
            label={readLeft > 0 ? 'Eyes need a minute' : saturated ? 'He knows this page' : 'Read the rules'}
            icon="swordBlue"
            variant="wood"
            size="md"
            full
            sublabel={readLeft > 0 ? formatSeconds(readLeft) : undefined}
            disabled={readLeft > 0}
            onClick={() => deskRead()}
          />
        </PixelPanel>

        <p className="t-label t-dim t-center screen__foot">
          Edge {Math.round(s.stats.edge)} / 100
        </p>
      </div>
    </div>
  )
}
