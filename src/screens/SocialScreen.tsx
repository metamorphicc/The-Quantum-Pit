import { PixelBar } from '../components/PixelBar'
import { PixelButton } from '../components/PixelButton'
import { PixelIcon, type IconName } from '../components/PixelIcon'
import { PixelPanel } from '../components/PixelPanel'
import { ScreenHeader } from '../components/ScreenHeader'
import {
  cooldownLeft,
  postLatestTrade,
  setScreen,
  writeSocialNote,
} from '../game/actions'
import { MARKET_BY_ID, STATS, WORLD } from '../game/config'
import { SOCIAL_TIERS, socialStatusForRep } from '../game/social'
import { useGameState } from '../game/store'
import { formatCash, formatProb, formatSeconds, formatSigned } from '../game/util'

export function SocialScreen() {
  const s = useGameState()
  const now = Date.now()
  const latest = s.lastTrade
  const latestTradeNo = s.tally.bets
  const postedLatest = latestTradeNo > 0 && s.social.lastPostedTradeNo === latestTradeNo
  const postCd = cooldownLeft('social_post', now)
  const noteCd = cooldownLeft('social_note', now)
  const status = socialStatusForRep(s.stats.rep)
  const nextTier = SOCIAL_TIERS.find((tier) => tier.min > s.stats.rep)
  const category = latest ? MARKET_BY_ID[latest.marketId]?.tag ?? 'MARKET' : 'NONE'

  const latestSub = (() => {
    if (!latest) return 'settle a ticket first'
    if (postedLatest) return 'already posted'
    if (postCd > 0) return formatSeconds(postCd)
    return latest.won ? 'share the win' : 'post the lesson'
  })()

  const noteSub = (() => {
    if (noteCd > 0) return formatSeconds(noteCd)
    if (s.stats.focus < 16) return 'low focus'
    return 'small rep grind'
  })()

  return (
    <div className="screen social">
      <ScreenHeader title="Social Desk" />

      <div className="screen__body">
        <PixelPanel
          variant="ink"
          pad="md"
          rivets
          title="Reputation"
          titleIcon="star"
          titleRight={<span className="t-label t-dim">{status}</span>}
        >
          <div className="social__hero">
            <div className="social__avatar">
              <PixelIcon name="warden" size={26} />
            </div>
            <div>
              <p className="t-label t-dim">Public profile</p>
              <h2>{s.name}</h2>
              <p>
                Rep does not come from raw trading yet. It comes from what he
                posts, how clean it looks, and whether the timeline buys the story.
              </p>
            </div>
          </div>

          <PixelBar
            label="Rep"
            icon="star"
            value={s.stats.rep}
            color={STATS.rep.color}
            colorDark={STATS.rep.colorDark}
            valueText={`${Math.round(s.stats.rep)}/100`}
            showValue
          />

          <ul className="detail__gains detail__gains--text social__rows">
            <Row label="Status" value={status} icon="star" />
            <Row label="Posts" value={s.social.posts} icon="terminal" />
            <Row label="Viral" value={s.social.viralPosts} icon="bolt" />
            <Row label="Backfires" value={s.social.backfires} icon="flame" />
            <Row
              label="Next status"
              value={nextTier ? `${nextTier.title} at ${nextTier.min} Rep` : 'maxed'}
              icon="check"
            />
          </ul>
        </PixelPanel>

        <PixelPanel
          variant="darkwood"
          pad="md"
          rivets
          title="Latest Fill"
          titleIcon="terminal"
          titleRight={<span className="t-label t-dim">{category}</span>}
        >
          {latest ? (
            <>
              <div className={`social__ticket ${latest.won ? 'is-win' : 'is-loss'}`}>
                <div className="social__ticket-top">
                  <span>{latest.won ? 'Won' : 'Lost'}</span>
                  <b>{formatSigned(latest.pnl)}</b>
                </div>
                <p>{latest.question}</p>
                <div className="social__ticket-meta">
                  <span>{latest.side.toUpperCase()}</span>
                  <span>{formatCash(latest.stake)}</span>
                  <span>{formatProb(latest.trueProb)}</span>
                </div>
              </div>

              <PixelButton
                label={postedLatest ? 'Posted' : 'Post latest fill'}
                icon={postedLatest ? 'check' : 'star'}
                variant={postedLatest ? 'ghost' : latest.won ? 'teal' : 'wood'}
                size="md"
                full
                disabled={postedLatest || postCd > 0}
                sublabel={latestSub}
                onClick={postLatestTrade}
              />
            </>
          ) : (
            <div className="empty-note">
              No settled ticket yet. Take a ticket, let it resolve, then decide
              whether the timeline deserves to see it.
            </div>
          )}
        </PixelPanel>

        <PixelPanel variant="darkwood" pad="md" rivets title="Desk Notes" titleIcon="stew">
          <p className="detail__desc">
            Write a short research note when there is no clean fill to show.
            It costs Focus, adds a little Heat, and slowly builds Rep.
          </p>
          <PixelButton
            label="Write desk note"
            icon="stew"
            variant={s.stats.focus >= 16 && noteCd <= 0 ? 'teal' : 'ghost'}
            size="md"
            full
            disabled={noteCd > 0 || s.stats.focus < 16}
            sublabel={noteSub}
            onClick={writeSocialNote}
          />
        </PixelPanel>

        <PixelPanel variant="wood" pad="md" rivets title="Later Unlocks" titleIcon="lock">
          <ul className="detail__gains detail__gains--text social__rows">
            <Row label="15 Rep" value="better replies" icon="star" />
            <Row label="35 Rep" value="cleaner profile" icon="terminal" />
            <Row label="60 Rep" value="room status items" icon="bag" />
            <Row label="85 Rep" value="rare social badges" icon="shard" />
          </ul>
          <p className="t-label t-dim">
            Visual/status unlocks only. No pay-to-win and no real orders.
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
