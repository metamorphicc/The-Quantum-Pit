import { useEffect } from 'react'
import { AchievementToasts } from './components/AchievementToasts'
import { QuestWindow } from './components/QuestWindow'
import { Toast } from './components/Toast'
import { saveNow, syncFromCloud, refreshTasks } from './game/actions'
import { tick, useGame } from './game/store'
import { BetScreen } from './screens/BetScreen'
import { BootScreen } from './screens/BootScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { ResearchScreen } from './screens/ResearchScreen'
import { RigScreen } from './screens/RigScreen'
import { RoomScreen } from './screens/RoomScreen'
import { ScanScreen } from './screens/ScanScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ShopScreen } from './screens/ShopScreen'
import { initTelegram } from './telegram/telegram'

/* ==========================================================================
   App shell: Telegram handshake, the one-second game clock, and the router.
   ========================================================================== */

export function App() {
  const screen = useGame((s) => s.screen)
  const reduceMotion = useGame((s) => s.settings.reduceMotion)

  // Telegram handshake, once. The cloud pull runs straight after it: the save
  // is already loaded from localStorage by then, so this only ever upgrades to
  // a newer copy stored against the player's account.
  useEffect(() => {
    initTelegram()
    void syncFromCloud()
  }, [])

  // game clock: decay, activity expiry, cooldown countdowns
  useEffect(() => {
    tick()
    // Roll any task window that lapsed while the app was closed. Done here on
    // boot (not on every tick) so it is a one-off catch-up, not a hot path.
    refreshTasks()
    const id = window.setInterval(() => tick(), 1000)
    return () => window.clearInterval(id)
  }, [])

  // catch up immediately when the WebView comes back, and flush the save
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        tick()
        refreshTasks()
      } else saveNow()
    }
    const onHide = () => saveNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onHide)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('reduce-motion', reduceMotion)
  }, [reduceMotion])

  return (
    <div className="app">
      <div className="scanlines" aria-hidden="true" />
      {screen === 'boot' ? <BootScreen /> : null}
      {screen === 'room' ? <RoomScreen /> : null}
      {screen === 'research' ? <ResearchScreen /> : null}
      {screen === 'rig' ? <RigScreen /> : null}
      {screen === 'scan' ? <ScanScreen /> : null}
      {screen === 'bet' ? <BetScreen /> : null}
      {screen === 'shop' ? <ShopScreen /> : null}
      {screen === 'profile' ? <ProfileScreen /> : null}
      {screen === 'settings' ? <SettingsScreen /> : null}
      <QuestWindow />
      <AchievementToasts />
      <Toast />
    </div>
  )
}
