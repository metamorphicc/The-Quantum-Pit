import { useState } from 'react'
import { Modal } from '../components/Modal'
import { PixelBar } from '../components/PixelBar'
import { PixelButton } from '../components/PixelButton'
import { PixelIcon, type IconName } from '../components/PixelIcon'
import { PixelPanel } from '../components/PixelPanel'
import { ScreenHeader } from '../components/ScreenHeader'
import { WardenPlinth } from '../components/WardenPlinth'
import { claimAchievement, isAlarming, renameWarden, setScreen } from '../game/actions'
import { ACHIEVEMENTS } from '../game/achievements'
import {
  BANKROLL_BAR,
  DESK_STAT_ORDER,
  NAME_MAX,
  RIG_BY_ID,
  SLOT_LABEL,
  STATS,
  WORLD,
  careerStatusForLevel,
  nextProgressionTier,
  progressionTierForLevel,
  xpProgress,
} from '../game/config'
import { bankrollHealth, overallForm, useGameState } from '../game/store'
import type { AchievementId, EquipSlot } from '../game/types'
import { formatAway, formatCash, formatSigned } from '../game/util'
import { cloudAvailable, tgUserId, tgUserName, tgUsername } from '../telegram/telegram'
import { badgeClaimConfigured } from '../web3/baseAchievements'
import { shortAddress } from '../web3/baseAccount'
const SLOTS: EquipSlot[] = ['head', 'cloak', 'blade']

export function ProfileScreen() {
  const s = useGameState()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(s.name)
  const [claiming, setClaiming] = useState<string | null>(null)

  const daysHeld = Math.max(1, Math.floor((Date.now() - s.firstVisit) / 86_400_000) + 1)
  const form = Math.round(overallForm(s.stats))
  const settled = s.tally.wins + s.tally.losses
  const hitRate = settled > 0 ? Math.round((s.tally.wins / settled) * 100) : 0
  const drawdown = s.peakBankroll > 0 ? Math.round((1 - s.bankroll / s.peakBankroll) * 100) : 0
  const xp = xpProgress(s.xp)
  const career = careerStatusForLevel(xp.level)
  const setup = progressionTierForLevel(xp.level)
  const nextSetup = nextProgressionTier(xp.level)
  const synced = cloudAvailable()
  // A Telegram account id is what namespaces the save. No id means we are in a
  // plain browser (or a client that hides the user), whatever the SDK claims.
  const linked = tgUserId() !== null
  const unlockedBadges = ACHIEVEMENTS.filter((badge) => s.achievements[badge.id]).length
  const claimReady = s.loginMethod === 'base' && Boolean(s.walletAddress)

  const telegramKeeper = (() => {
    const first = tgUserName()
    const handle = tgUsername()
    if (first && handle) return `${first} (@${handle})`
    if (first) return first
    if (handle) return `@${handle}`
    return linked ? 'Unnamed account' : 'Local guest'
  })()

  const loginMethod = s.loginMethod ?? (linked ? 'telegram' : 'guest')
  const keeper =
    loginMethod === 'base'
      ? shortAddress(s.walletAddress)
      : loginMethod === 'telegram'
        ? telegramKeeper
        : 'Local guest'

  const syncNote =
    loginMethod === 'base'
      ? 'Base Account is identity only for now. The book still lives in this browser until wallet saves are added.'
      : synced
        ? 'Held against your Telegram account, so the book turns up on any device you sign into.'
        : linked
          ? 'This Telegram client is too old for account storage. The book lives on this device only.'
          : 'Browser session. The book lives in this browser only - connect in Telegram or Base later to carry it around.'

  function openRename(): void {
    setDraft(s.name)
    setRenaming(true)
  }

  function commitRename(): void {
    renameWarden(draft)
    setRenaming(false)
  }

  async function claimBadge(id: AchievementId): Promise<void> {
    setClaiming(id)
    await claimAchievement(id)
    setClaiming(null)
  }

  return (
    <div className="screen">
      <ScreenHeader title="Trading Record" />

      <div className="screen__body">
        <PixelPanel variant="ink" pad="none" rivets>
          <div className="profile__hero">
            <WardenPlinth width={156} height={108} className="profile__canvas" />
            <div className="profile__plate">
              <span className="profile__name t-gold">{s.name}</span>
              <span className="t-label t-dim">
                Lv. {xp.level} - {career} - Day {daysHeld}
              </span>
              <PixelButton
                label="Rename him"
                icon="star"
                variant="wood"
                size="sm"
                onClick={openRename}
              />
            </div>
          </div>
        </PixelPanel>

        <PixelPanel
          variant="darkwood"
          title="Career"
          titleIcon="star"
          pad="md"
          rivets
          titleRight={<span className="t-label t-dim">Lv. {xp.level}</span>}
        >
          <ul className="detail__gains detail__gains--text">
            <Row label="Status" value={career} icon="warden" />
            <Row label="Setup" value={setup.room} icon="terminal" />
            <Row label="Reputation" value={`${Math.round(s.stats.rep)}/100`} icon="star" />
            <Row
              label="Next step"
              value={nextSetup ? `Lv. ${nextSetup.min}: ${nextSetup.status}` : 'capped'}
              icon="bolt"
            />
          </ul>
          <PixelBar
            label="XP"
            icon="star"
            value={xp.pct}
            color="#68c9ff"
            colorDark="#1f5f78"
            valueText={xp.level >= 30 ? 'MAX' : `${xp.pct}%`}
            showValue
          />
          <PixelBar
            label="Rep"
            icon="star"
            value={s.stats.rep}
            color={STATS.rep.color}
            colorDark={STATS.rep.colorDark}
            valueText={`${Math.round(s.stats.rep)}`}
            showValue
          />
        </PixelPanel>

        <PixelPanel
          variant="darkwood"
          title="Form"
          titleIcon="flame"
          pad="sm"
          rivets
          titleRight={<span className="t-label t-dim">{form}%</span>}
        >
          <div className="profile__bars">
            {DESK_STAT_ORDER.map((key) => {
              const meta = STATS[key]
              const value = s.stats[key]
              return (
                <PixelBar
                  key={key}
                  label={meta.label}
                  icon={meta.icon}
                  value={value}
                  color={meta.color}
                  colorDark={meta.colorDark}
                  low={isAlarming(key, value)}
                  showValue
                />
              )
            })}
            <PixelBar
              label={BANKROLL_BAR.label}
              icon={BANKROLL_BAR.icon}
              value={bankrollHealth(s.bankroll, s.peakBankroll)}
              color={BANKROLL_BAR.color}
              colorDark={BANKROLL_BAR.colorDark}
              low={s.bankroll < 25}
              valueText={formatCash(s.bankroll)}
              showValue
            />
          </div>
          <p className="t-label t-dim">
            {form >= 70
              ? 'Reading it well. He would never say so.'
              : form >= 40
                ? 'Grinding. Barely a compliment.'
                : 'Something on that board is eating him.'}
          </p>
        </PixelPanel>

        <PixelPanel variant="wood" title="The book" titleIcon="coin" pad="md" rivets>
          <ul className="detail__gains detail__gains--text">
            <Row label={WORLD.cashName} value={formatCash(s.bankroll)} icon="coin" />
            <Row label="Peak" value={formatCash(s.peakBankroll)} icon="star" />
            <Row
              label="Off the peak"
              value={drawdown > 0 ? `${drawdown}%` : 'at highs'}
              icon={drawdown > 0 ? 'skull' : 'check'}
            />
            <Row label={WORLD.creditName} value={s.credits} icon="shard" />
          </ul>
          <p className="t-label t-dim">{WORLD.disclaimer}</p>
        </PixelPanel>

        <PixelPanel variant="darkwood" title="Account" titleIcon="warden" pad="md" rivets>
          <ul className="detail__gains detail__gains--text">
            <Row
              label="Signed in"
              value={loginMethod === 'base' ? 'Base Account' : loginMethod === 'telegram' ? 'Telegram' : 'Guest'}
              icon={loginMethod === 'base' ? 'coin' : 'warden'}
            />
            <Row label="Identity" value={keeper} icon={loginMethod === 'base' ? 'coin' : 'terminal'} />
            <Row
              label="Save"
              value={loginMethod === 'base' ? 'This browser' : synced ? 'Telegram account' : 'This device'}
              icon={loginMethod === 'base' ? 'lock' : synced ? 'check' : 'lock'}
            />
            <Row
              label="Last seen"
              value={s.awayMs > 60_000 ? `${formatAway(s.awayMs)} ago` : 'just now'}
              icon="torch"
            />
          </ul>
          <p className="t-label t-dim">{syncNote}</p>
        </PixelPanel>

        <PixelPanel
          variant="darkwood"
          title="Onchain Badges"
          titleIcon="star"
          pad="md"
          rivets
          titleRight={
            <span className="t-label t-dim">
              {unlockedBadges}/{ACHIEVEMENTS.length}
            </span>
          }
        >
          <div className="badges">
            {ACHIEVEMENTS.map((badge) => {
              const record = s.achievements[badge.id]
              const unlocked = Boolean(record)
              const claimed = record?.claimStatus === 'claimed'
              const busy = claiming === badge.id
              return (
                <div
                  key={badge.id}
                  className={`badgecard badgecard--${badge.rarity} ${unlocked ? 'is-unlocked' : 'is-locked'}`}
                >
                  <div className="badgecard__icon">
                    <PixelIcon name={unlocked ? badge.icon : 'lock'} size={18} />
                  </div>
                  <div className="badgecard__body">
                    <b>{badge.name}</b>
                    <span>{badge.desc}</span>
                    <small>
                      ERC-1155 #{badge.tokenId} -{' '}
                      {claimed ? 'claimed' : unlocked ? 'free claim' : 'locked'}
                    </small>
                  </div>
                  <PixelButton
                    label={claimed ? 'Claimed' : busy ? 'Claiming' : 'Claim'}
                    icon={claimed ? 'check' : 'coin'}
                    variant={claimed ? 'ghost' : unlocked && claimReady ? 'teal' : 'ghost'}
                    size="sm"
                    disabled={!unlocked || claimed || busy}
                    onClick={() => void claimBadge(badge.id)}
                  />
                </div>
              )
            })}
          </div>
          <p className="t-label t-dim">
            Badges are free mints. The mint contract/signer still needs deployment
            {badgeClaimConfigured()
              ? '; Base Account can send claims now.'
              : ' before claims can create real NFTs.'}
          </p>
        </PixelPanel>

        <PixelPanel variant="wood" title="The rig" titleIcon="helm" pad="md" rivets>
          <ul className="detail__gains detail__gains--text">
            {SLOTS.map((slot) => {
              const id = s.look[slot]
              const item = id ? RIG_BY_ID[id] : undefined
              return (
                <Row
                  key={slot}
                  label={SLOT_LABEL[slot]}
                  value={item?.name ?? 'Nothing'}
                  icon={item?.icon ?? 'lock'}
                />
              )
            })}
          </ul>
          <PixelButton
            label="Change the rig"
            icon="helm"
            variant="ghost"
            size="sm"
            full
            onClick={() => setScreen('rig')}
          />
        </PixelPanel>

        <PixelPanel variant="darkwood" title="Tally" titleIcon="star" pad="md" rivets>
          <ul className="detail__gains tally">
            <Row label="Days at the desk" value={daysHeld} icon="torch" />
            <Row label="PnL checks" value={s.tally.taps} icon="star" />
            <Row label="Notes read" value={s.tally.researches} icon="stew" />
            <Row label="Breaks taken" value={s.tally.recovers} icon="bed" />
            <Row label="Hedges put on" value={s.tally.hedges} icon="brush" />
            <Row label="Board scans" value={s.tally.scans} icon="dice" />
            <Row label="Sim positions" value={s.tally.bets} icon="terminal" />
            <Row
              label="Settled"
              value={settled > 0 ? `${s.tally.wins}W / ${s.tally.losses}L - ${hitRate}%` : 'none yet'}
              icon="check"
            />
            <Row label="Best run" value={s.tally.bestStreak} icon="bolt" />
            <Row
              label="Best fill"
              value={s.tally.bestWin > 0 ? formatSigned(s.tally.bestWin) : '-'}
              icon="coin"
            />
            <Row
              label="Worst fill"
              value={s.tally.worstLoss > 0 ? formatSigned(-s.tally.worstLoss) : '-'}
              icon="skull"
            />
            <Row label="Visits" value={s.visits} icon="gear" />
          </ul>
          <p className="t-label t-dim">
            {WORLD.cashName} moves on fills and fees. {WORLD.creditName} come from showing up.
          </p>
        </PixelPanel>

        <PixelButton
          label={`Back to ${WORLD.hall}`}
          icon="arrowLeft"
          variant="wood"
          size="sm"
          full
          onClick={() => setScreen('room')}
        />
      </div>

      <Modal
        open={renaming}
        title="What do you call him?"
        confirmLabel="Carve it in"
        cancelLabel="Leave it"
        onCancel={() => setRenaming(false)}
        onConfirm={commitRename}
      >
        <p className="profile__hint">
          Letters, digits, spaces and the odd apostrophe. Up to {NAME_MAX} characters. Leave it
          empty and he goes back to the name on the badge.
        </p>
        <input
          className="field"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
          }}
          maxLength={NAME_MAX}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="words"
          autoFocus
          aria-label="The trader's name"
        />
        <div className="profile__hint-row">
          <span className="t-label t-dim">
            {draft.length}/{NAME_MAX}
          </span>
          <button type="button" className="linkbtn" onClick={() => setDraft(WORLD.hero)}>
            Use the name on the badge
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Row({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: IconName
}) {
  return (
    <li>
      <PixelIcon name={icon} size={12} />
      <span>{label}</span>
      <b>{value}</b>
    </li>
  )
}
