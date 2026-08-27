import { useState } from 'react'
import { Modal } from '../components/Modal'
import { PixelButton } from '../components/PixelButton'
import { PixelIcon } from '../components/PixelIcon'
import { PixelPanel } from '../components/PixelPanel'
import { ScreenHeader } from '../components/ScreenHeader'
import { resetGame, saveNow, setScreen, toggleSetting } from '../game/actions'
import { GAME_VERSION, WORLD } from '../game/config'
import { useGameState } from '../game/store'
import { closeApp, isTelegram, telegramInfo } from '../telegram/telegram'
import type { IconName } from '../components/PixelIcon'
const TOGGLES: { key: 'sound' | 'haptics' | 'reduceMotion'; label: string; icon: IconName; note: string }[] =
  [
    { key: 'sound', label: 'Sound', icon: 'flame', note: 'Short pixel blips. No music.' },
    { key: 'haptics', label: 'Rumble', icon: 'bolt', note: 'Telegram haptics on each action.' },
    {
      key: 'reduceMotion',
      label: 'Still Pit',
      icon: 'gear',
      note: 'Freezes fire, dust and shake.',
    },
  ]

export function SettingsScreen() {
  const s = useGameState()
  const [confirming, setConfirming] = useState(false)
  const tg = telegramInfo()

  return (
    <div className="screen">
      <ScreenHeader title={WORLD.keep} showCurrency={false} />

      <div className="screen__body">
        <PixelPanel variant="darkwood" title="Comforts" titleIcon="gear" pad="sm" rivets>
          <ul className="toggles">
            {TOGGLES.map((t) => {
              const on = s.settings[t.key]
              return (
                <li key={t.key}>
                  <button
                    type="button"
                    className={`toggle ${on ? 'is-on' : ''}`}
                    onClick={() => toggleSetting(t.key)}
                    aria-pressed={on}
                  >
                    <PixelIcon name={t.icon} size={14} />
                    <span className="toggle__text">
                      <b>{t.label}</b>
                      <small>{t.note}</small>
                    </span>
                    <span className="toggle__switch">
                      <span className="toggle__knob" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </PixelPanel>

        <PixelPanel variant="ink" title="Desk" titleIcon="torch" pad="md" rivets>
          <div className="stack">
            <PixelButton
              label="Trading record"
              icon="warden"
              variant="wood"
              size="sm"
              full
              sublabel="Name, form, the book"
              onClick={() => setScreen('profile')}
            />
            <PixelButton
              label="Save now"
              icon="check"
              variant="wood"
              size="sm"
              full
              onClick={saveNow}
            />
            <PixelButton
              label={`Back to ${WORLD.hall}`}
              icon="arrowLeft"
              variant="wood"
              size="sm"
              full
              onClick={() => setScreen('room')}
            />
            {isTelegram() ? (
              <PixelButton
                label="Close"
                icon="close"
                variant="ghost"
                size="sm"
                full
                onClick={closeApp}
              />
            ) : null}
            <PixelButton
              label="Close the account"
              icon="skull"
              variant="danger"
              size="sm"
              full
              sublabel="Wipes everything"
              onClick={() => setConfirming(true)}
            />
          </div>
        </PixelPanel>

        <p className="t-label t-dim t-center screen__foot">
          {WORLD.title} v{GAME_VERSION}
          {tg ? ` - Telegram ${tg.platform} ${tg.version}` : ' - browser'}
        </p>
        <p className="t-label t-dim t-center screen__foot">
          {WORLD.disclaimer}
          <br />
          Wallet identity only. No deposits, no real orders. It is a toy book on a desk.
        </p>
      </div>

      <Modal
        open={confirming}
        title="Close the account?"
        confirmLabel="Wipe it"
        cancelLabel="Keep it"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          resetGame()
          setConfirming(false)
          setScreen('boot')
        }}
      >
        Everything goes: the tally, the {WORLD.cashName.toLowerCase()}, the rig. He will not
        remember you, which is arguably a mercy.
      </Modal>
    </div>
  )
}
