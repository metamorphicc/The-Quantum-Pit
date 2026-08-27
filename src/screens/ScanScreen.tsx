import { FloatingTextLayer } from '../components/FloatingTextLayer'
import { PixelButton } from '../components/PixelButton'
import { PixelIcon } from '../components/PixelIcon'
import { PixelPanel } from '../components/PixelPanel'
import { ScreenHeader } from '../components/ScreenHeader'
import { boardQuotes, cooldownLeft, doScan, isStale, marketCostWithRig, openBet, scanCostWithRig } from '../game/actions'
import { MARKET, MARKET_BY_ID, WORLD, traderClassById } from '../game/config'
import { useGameState } from '../game/store'
import { formatPrice, formatProb, formatSeconds } from '../game/util'
export function ScanScreen() {
  const s = useGameState()
  const now = Date.now()
  const board = boardQuotes()
  const klass = traderClassById(s.traderClass)
  const left = cooldownLeft('scan', now)
  const scanCost = scanCostWithRig()
  const broke = s.stats.focus < scanCost.focus

  return (
    <div className="screen">
      <ScreenHeader title="The Board" />

      <div className="screen__body">
        <FloatingTextLayer />

        <PixelPanel variant="darkwood" pad="sm" rivets>
          <ul className="board">
            {board.map((q) => {
              const def = MARKET_BY_ID[q.id]!
              const cost = marketCostWithRig(def)
              const stale = isStale(q.quotedAt, now)
              const favored = klass?.marketBias === def.category
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className={`mkt ${stale ? 'is-stale' : ''}`}
                    onClick={() => openBet(q.id)}
                  >
                    <span className="mkt__icon">
                      <PixelIcon name={def.icon} size={20} />
                    </span>

                    <span className="mkt__mid">
                      <span className="mkt__tag t-label t-dim">
                        {def.tag} / {def.category}
                        {favored ? ' / favored' : ''}
                        {stale ? ' - stale' : ''}
                      </span>
                      <span className="mkt__q t-body">{def.question}</span>
                      <span className="mkt__cost t-label t-dim">
                        {cost.focus} focus - {cost.heat} heat
                      </span>
                    </span>

                    <span className="mkt__quote">
                      <b className="mkt__prob">{formatProb(q.prob)}</b>
                      <span className="t-label t-dim">
                        Y {formatPrice(q.prob)} / N {formatPrice(1 - q.prob)}
                      </span>
                      {/* one chunky segment bar instead of a chart */}
                      <span className="mkt__bar" aria-hidden="true">
                        <i style={{ width: `${Math.round(q.prob * 20) * 5}%` }} />
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </PixelPanel>

        <PixelButton
          label={left > 0 ? 'Board is settling' : broke ? 'Too fried to read it' : 'Scan the board'}
          icon="dice"
          variant="teal"
          size="lg"
          full
          disabled={left > 0}
          sublabel={
            left > 0
              ? formatSeconds(left)
              : `Costs ${scanCost.focus} focus - +${scanCost.heat} heat`
          }
          onClick={() => doScan()}
        />

        <p className="t-label t-dim t-center screen__foot">
          Quotes go stale after {Math.round(MARKET.quoteTtlMs / 60_000)} minutes and fill worse.
          <br />
          {WORLD.disclaimer}
        </p>
      </div>
    </div>
  )
}
