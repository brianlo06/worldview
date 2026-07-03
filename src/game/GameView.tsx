// The /game console. The globe stays mounted underneath (App renders it in
// both routes); scans fly the camera to the card's location, run a lock-on
// tease that cycles tier colors before settling on the truth, then flip the
// card back-first — the glow leaking around the card back is the spoiler.
// Tap anywhere during the sequence to skip straight to the card.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useGameStore } from '../store/useGameStore'
import { exitGame } from './router'
import { GameCardFace, TIER_COLORS, TIER_LABELS } from './GameCard'
import { CollectionPanel } from './CollectionPanel'
import { RatesPanel } from './RatesPanel'
import { ShareButton } from '../hud/ShareButton'
import { countryName } from '../globe/countries'
import { audio } from '../audio/audio'
import type { ScanResult, Tier } from '../api/game'

const FLY_MS = 2000
const TIER_ORDER: Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

type RevealStage = 'flight' | 'lockon' | 'materialize' | 'flip' | 'done'

function CountdownToReset() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const midnight = new Date()
  midnight.setUTCHours(24, 0, 0, 0)
  const left = Math.max(0, midnight.getTime() - now)
  const h = Math.floor(left / 3600_000)
  const m = Math.floor((left % 3600_000) / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  return (
    <span>
      RESET IN {h}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  )
}

export function GameView() {
  const setFlyToTarget = useAppStore((st) => st.setFlyToTarget)
  const setPulseAt = useAppStore((st) => st.setPulseAt)
  const {
    player, bootStatus, boot, scanPhase, lastScan, scanError,
    doScan, finishReveal, loadCollection, loadRates, rates,
  } = useGameStore()
  const [panel, setPanel] = useState<'none' | 'collection' | 'rates'>('none')

  // Reveal choreography state — all local; the pull itself is committed
  // server-side before any of this starts, so interrupting costs nothing.
  const [stage, setStage] = useState<RevealStage | null>(null)
  const [ringColor, setRingColor] = useState('#7be0ff')
  const [ringNonce, setRingNonce] = useState(0)
  const [flash, setFlash] = useState<string | null>(null)
  const [burst, setBurst] = useState<string | null>(null)
  const [beam, setBeam] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const timersRef = useRef<number[]>([])
  const reduceMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    void boot()
    void loadRates()
  }, [boot, loadRates])

  // Suspend the ambient tour rotation while the game is open — the lock-on
  // rings anchor to screen center, so the drop point must stay put after the
  // fly-to. Restored on exit if it was on.
  useEffect(() => {
    const wasTouring = useAppStore.getState().tourMode
    if (wasTouring) useAppStore.getState().setTourMode(false)
    return () => {
      if (wasTouring) useAppStore.getState().setTourMode(true)
    }
  }, [])

  useEffect(() => () => {
    for (const id of timersRef.current) window.clearTimeout(id)
  }, [])

  const scans = player?.wallet.scans_left ?? 0
  const flux = player?.wallet.flux ?? 0
  const bonusScanCost = rates?.scan_prices.bonus ?? 60
  const canBonusScan = scans <= 0 && flux >= bonusScanCost

  function schedule(fn: () => void, ms: number) {
    timersRef.current.push(window.setTimeout(fn, ms))
  }
  function clearTimers() {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
  }
  function clearFlourish() {
    setFlash(null)
    setBurst(null)
    setBeam(null)
    setShake(false)
  }

  function skipSequence() {
    clearTimers()
    clearFlourish()
    setStage('done')
    useGameStore.setState({ scanPhase: 'reveal' })
  }

  function runLockOn(result: ScanResult, hasGeo: boolean) {
    const card = result.card
    const tierColor = TIER_COLORS[card.tier]
    const rank = TIER_ORDER.indexOf(card.tier)
    useGameStore.setState({ scanPhase: 'lockon' })
    setStage('lockon')

    // Roulette: rings cycle the tier ladder with rising blips, decelerating,
    // and settle on the real tier color. Higher tiers earn extra suspense.
    const extra = card.tier === 'legendary' ? 5 : card.tier === 'epic' ? 3 : 0
    const count = reduceMotion ? 4 : 6 + extra
    let at = 0
    for (let i = 0; i < count; i++) {
      const last = i === count - 1
      const color = last ? tierColor : TIER_COLORS[TIER_ORDER[i % TIER_ORDER.length]]
      schedule(() => {
        setRingColor(color)
        setRingNonce((n) => n + 1)
        audio.blip(460 * Math.pow(1.09, i), last ? 0.3 : 0.18)
        if (hasGeo) setPulseAt({ lat: card.lat!, lon: card.lon!, color })
      }, at)
      at += Math.min(420, 170 * Math.pow(1.16, i))
    }

    // Settle flourish, gated by tier.
    at += 240
    schedule(() => {
      if (rank >= 2) setFlash(tierColor)
      if (rank >= 3 && !reduceMotion) setBurst(tierColor)
      if (card.tier === 'legendary') {
        if (!reduceMotion) setBeam(tierColor)
        audio.thud()
        schedule(() => audio.chime(), 180)
      } else if (card.tier === 'epic') {
        audio.chime()
      } else if (card.tier === 'rare') {
        audio.blip(1500, 0.3)
      }
      if (hasGeo && rank >= 3) {
        for (const d of [0, 130, 260]) {
          schedule(() => setPulseAt({ lat: card.lat!, lon: card.lon!, color: tierColor }), d)
        }
      }
    }, at)

    // Materialize (card back with the tier-glow spoiler), flip, done.
    const settleHold = reduceMotion ? 260 : card.tier === 'legendary' ? 950 : rank >= 2 ? 550 : 340
    const materializeMs = reduceMotion ? 300 : card.tier === 'legendary' ? 1150 : rank >= 3 ? 800 : 620
    const flipMs = !reduceMotion && card.tier === 'legendary' ? 900 : 520
    at += settleHold
    schedule(() => {
      clearFlourish()
      useGameStore.setState({ scanPhase: 'reveal' })
      setStage('materialize')
      audio.whoosh(0.22)
    }, at)
    at += materializeMs
    schedule(() => {
      setStage('flip')
      audio.whoosh(0.4)
      if (card.tier === 'legendary' && !reduceMotion) {
        setShake(true)
        schedule(() => setShake(false), 600)
      }
    }, at)
    at += flipMs + 120
    schedule(() => {
      setStage('done')
      if (result.new_badges.length > 0) audio.chime()
    }, at)
  }

  async function onScan() {
    audio.click()
    const result = await doScan(scans > 0 ? 'free' : 'flux')
    if (!result) return
    const { lat, lon } = result.card
    const hasGeo = lat != null && lon != null
    setStage('flight')
    if (hasGeo) {
      setFlyToTarget({ lat: lat!, lon: lon!, durationMs: FLY_MS, marker: false })
    }
    schedule(() => runLockOn(result, hasGeo), hasGeo ? FLY_MS : 400)
  }

  function closeReveal() {
    clearTimers()
    clearFlourish()
    setStage(null)
    finishReveal()
    void loadCollection()
  }

  const revealCard = scanPhase === 'reveal' ? lastScan?.card : null
  const revealTierColor = revealCard ? TIER_COLORS[revealCard.tier] : '#7be0ff'
  const cardShown = stage === 'flip' || stage === 'done'
  const shareBuild = useMemo(() => {
    if (!lastScan) return null
    const c = lastScan.card
    return () => ({
      kind: 'pull' as const,
      title: c.headline,
      place: countryName(c.country),
      flyLat: c.lat,
      flyLon: c.lon,
      stats: {
        tier: c.tier,
        category: c.category,
        pool_date: c.pool_date,
        art_seed: c.art_seed,
      },
    })
  }, [lastScan])

  return (
    <div className="pointer-events-none absolute inset-0 text-hud-sm tracking-widest uppercase">
      {/* header */}
      <div className="pointer-events-auto absolute left-4 top-3 flex items-center gap-3">
        <span className="text-hud-xs tracking-[0.3em] text-[#7be0ff]">
          WORLDVIEW · SCAN
        </span>
        <button
          type="button"
          onClick={() => {
            audio.click()
            exitGame()
          }}
          className="border border-[#4cc9ff]/40 px-2 py-1 text-hud-2xs text-[#4cc9ff]/90 hover:bg-[#4cc9ff]/10 transition"
        >
          ← GLOBE
        </button>
      </div>

      {/* wallet strip */}
      <div className="pointer-events-auto absolute right-4 top-3 flex items-center gap-3 text-hud-2xs tracking-[0.22em] text-[#9db8cc]">
        {player && (
          <>
            <span>⚡ {player.wallet.flux} FLUX</span>
            <span>◈ {scans} SCANS</span>
            {player.streak_days > 1 && <span>🔥 {player.streak_days}D</span>}
          </>
        )}
        <button
          type="button"
          onClick={() => setPanel(panel === 'collection' ? 'none' : 'collection')}
          className="border border-[#4cc9ff]/40 px-2 py-1 text-[#4cc9ff]/90 hover:bg-[#4cc9ff]/10 transition"
        >
          ▤ COLLECTION
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === 'rates' ? 'none' : 'rates')}
          className="border border-[#4cc9ff]/40 px-2 py-1 text-[#4cc9ff]/90 hover:bg-[#4cc9ff]/10 transition"
        >
          % RATES
        </button>
      </div>

      {/* bottom console */}
      <div className="pointer-events-auto absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        {bootStatus === 'error' && (
          <div className="border border-[#ffb84c]/55 bg-[#02040a]/85 px-3 py-1.5 text-hud-xs text-[#ffb84c]">
            GAME FEED UNREACHABLE — RETRYING MAY HELP
          </div>
        )}
        {scanError && (
          <div className="border border-[#ffb84c]/55 bg-[#02040a]/85 px-3 py-1.5 text-hud-xs text-[#ffb84c]">
            {scanError.toUpperCase()}{' '}
            {scanError.includes('scans') && <CountdownToReset />}
          </div>
        )}
        {scanPhase === 'idle' && bootStatus === 'ready' && (
          <button
            type="button"
            onClick={onScan}
            disabled={scans <= 0 && !canBonusScan}
            className={`border px-8 py-3 text-hud-sm tracking-[0.35em] transition ${
              scans > 0 || canBonusScan
                ? 'border-[#7be0ff] bg-[#4cc9ff]/12 text-[#cfe6ff] hover:bg-[#4cc9ff]/22'
                : 'border-[#4cc9ff]/25 text-[#4cc9ff]/40'
            }`}
          >
            {scans > 0 ? '◎ SCAN THE WORLD' : canBonusScan ? (
              `◎ BONUS SCAN · ${bonusScanCost} FLUX`
            ) : (
              <span className="flex items-center gap-2">
                ◌ NO SCANS · {bonusScanCost} FLUX NEEDED · <CountdownToReset />
              </span>
            )}
          </button>
        )}
        {scanPhase === 'scanning' && (
          <div className="border border-[#7be0ff]/60 bg-[#02040a]/80 px-8 py-3 text-hud-sm tracking-[0.35em] text-[#7be0ff] game-scanning">
            {stage === 'flight' ? '◎ SIGNAL ACQUIRED — TRACKING' : '◎ SCANNING…'}
          </div>
        )}
        {bootStatus === 'ready' && scanPhase === 'idle' && (
          <div className="text-hud-2xs tracking-[0.2em] text-[#5a7288]">
            COLLECTION LIVES IN THIS BROWSER · NO ACCOUNT · NO PURCHASES
          </div>
        )}
      </div>

      {/* lock-on overlay: rings cycle tier colors over the globe; also the
          tap-to-skip surface for the flight leg */}
      {(scanPhase === 'lockon' || stage === 'flight') && (
        <div className="pointer-events-auto absolute inset-0 z-20" onPointerDown={skipSequence}>
          {scanPhase === 'lockon' && (
            <div className="game-lockon">
              <div
                key={ringNonce}
                className="game-lockring"
                style={{ borderColor: ringColor, boxShadow: `0 0 16px ${ringColor}55` }}
              />
              <div
                key={`t${ringNonce}`}
                className="game-lockring game-lockring--trail"
                style={{ borderColor: ringColor }}
              />
              <div
                className="game-lockon__core"
                style={{ background: ringColor, boxShadow: `0 0 14px ${ringColor}` }}
              />
            </div>
          )}
          {burst && (
            <div className="game-lockon game-burst" style={{ '--c': burst } as CSSProperties}>
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} style={{ '--a': `${i * 36}deg` } as CSSProperties} />
              ))}
            </div>
          )}
          {beam && (
            <div
              className="game-beam"
              style={{ background: `linear-gradient(to top, transparent, ${beam}cc 45%, transparent)` }}
            />
          )}
          {flash && (
            <div
              className="game-flash"
              style={{ background: `radial-gradient(circle at 50% 50%, ${flash}40, transparent 62%)` }}
            />
          )}
          {scanPhase === 'lockon' && (
            <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 whitespace-nowrap text-hud-2xs tracking-[0.3em] text-[#7be0ff] game-scanning">
              SIGNAL LOCK IN PROGRESS · TAP TO SKIP
            </div>
          )}
        </div>
      )}

      {/* reveal overlay */}
      {revealCard && (
        <div
          className={`pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#02040a]/70 game-fadein ${
            shake ? 'game-shake' : ''
          }`}
          onPointerDown={stage !== 'done' ? skipSequence : undefined}
        >
          <div className="relative">
            {revealCard.tier === 'legendary' && !reduceMotion && cardShown && (
              <div className="game-starburst" />
            )}
            <div
              className={`game-flip3d game-materialize ${cardShown ? 'game-flip3d--flipped' : ''} ${
                revealCard.tier === 'legendary' && !reduceMotion ? 'game-flip3d--slow' : ''
              }`}
            >
              <div className="game-flip3d__inner">
                <div className="game-flip3d__front">
                  <GameCardFace card={revealCard} />
                </div>
                <div
                  className="game-flip3d__back"
                  style={{
                    borderColor: `${revealTierColor}66`,
                    boxShadow: `0 0 52px ${revealTierColor}55, 0 0 20px ${revealTierColor}88, inset 0 0 40px #000000c0`,
                  }}
                >
                  <span className="game-flip3d__glyph">◎</span>
                  <span className="mt-2 text-hud-2xs tracking-[0.35em] text-[#5a7288]">
                    WORLDVIEW
                  </span>
                </div>
              </div>
            </div>
          </div>
          {stage === 'done' && (
            <div className="game-fadein flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="text-hud-xs tracking-[0.3em]"
                  style={{ color: revealTierColor }}
                >
                  {TIER_LABELS[revealCard.tier]}
                  {lastScan?.pity_hit ? ' · PITY' : ''}
                  {lastScan?.flux_spent ? ` · -${lastScan.flux_spent} FLUX` : ''}
                  {lastScan?.is_dupe ? ` · DUPE +${lastScan.flux_credit} FLUX` : ''}
                </span>
              </div>
              {lastScan && lastScan.new_badges.length > 0 && (
                <div className="text-hud-xs tracking-[0.25em] text-[#ffd166]">
                  ◆ BADGE EARNED: {lastScan.new_badges.join(' · ').toUpperCase()}
                </div>
              )}
              <div className="flex items-center gap-3">
                {shareBuild && <ShareButton build={shareBuild} />}
                <button
                  type="button"
                  onClick={closeReveal}
                  className="border border-[#4cc9ff]/50 px-3 py-1 text-hud-2xs text-[#7be0ff] hover:bg-[#4cc9ff]/10 transition"
                >
                  {scans > 0 ? '→ NEXT' : '✓ DONE'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* side panels */}
      {panel === 'collection' && <CollectionPanel onClose={() => setPanel('none')} />}
      {panel === 'rates' && (
        <div className="absolute right-4 top-14">
          <RatesPanel onClose={() => setPanel('none')} />
        </div>
      )}
    </div>
  )
}
