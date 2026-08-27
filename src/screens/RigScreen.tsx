import { useState } from 'react'
import { ItemSlot } from '../components/ItemSlot'
import { PixelButton } from '../components/PixelButton'
import { PixelPanel } from '../components/PixelPanel'
import { ScreenHeader } from '../components/ScreenHeader'
import { FloatingTextLayer } from '../components/FloatingTextLayer'
import { WardenPlinth } from '../components/WardenPlinth'
import { equipRig, say, setScreen } from '../game/actions'
import { RIGS, SLOT_LABEL } from '../game/config'
import { useGameState } from '../game/store'
import type { EquipSlot } from '../game/types'
const SLOTS: EquipSlot[] = ['head', 'cloak', 'blade']

export function RigScreen() {
  const s = useGameState()
  const [slot, setSlot] = useState<EquipSlot>('head')
  const options = RIGS.filter((r) => r.slot === slot)

  return (
    <div className="screen">
      <ScreenHeader title="The Rig" />

      <div className="screen__body">
        <FloatingTextLayer />

        <PixelPanel variant="ink" pad="none" rivets>
          <div className="wardrobe__preview">
            <WardenPlinth width={132} height={96} className="wardrobe__canvas" />
            <div className="wardrobe__plate">
              <span className="t-label t-gold">{s.name}</span>
              <span className="t-label t-dim">
                {SLOTS.map((k) => {
                  const id = s.look[k]
                  return id ? RIGS.find((r) => r.id === id)?.name : null
                })
                  .filter(Boolean)
                  .join(' - ')}
              </span>
            </div>
          </div>
        </PixelPanel>

        <div className="tabs">
          {SLOTS.map((k) => (
            <button
              key={k}
              type="button"
              className={`tab ${slot === k ? 'is-on' : ''}`}
              onClick={() => setSlot(k)}
            >
              <span>{SLOT_LABEL[k]}</span>
            </button>
          ))}
        </div>

        <PixelPanel variant="darkwood" pad="sm" rivets>
          <div className="grid grid--4">
            {options.map((item) => {
              const owned = s.owned.includes(item.id)
              return (
                <ItemSlot
                  key={item.id}
                  icon={item.icon}
                  label={item.name}
                  locked={!owned}
                  equipped={s.look[item.slot] === item.id}
                  selected={s.look[item.slot] === item.id}
                  price={owned ? undefined : { amount: item.price, currency: item.currency }}
                  onClick={() => {
                    if (!owned) {
                      say('Locked. The shelf takes bankroll, not opinions.')
                      return
                    }
                    equipRig(item.id)
                  }}
                  ariaLabel={`${item.name}${owned ? '' : ', locked'}`}
                />
              )
            })}
          </div>
        </PixelPanel>

        <PixelButton
          label="Buy more in Supply"
          icon="bag"
          variant="ghost"
          size="sm"
          full
          onClick={() => setScreen('shop')}
        />
      </div>
    </div>
  )
}
