'use client'

import dynamic from 'next/dynamic'
import { useRef, useState, useEffect, useCallback } from 'react'
import { SHAPES, BASE_SPEED, LEVELS, getTheme } from './GameCanvas'
import SoundManager from './SoundManager'

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false })
const MenuCanvas = dynamic(() => import('./MenuCanvas'), { ssr: false })

// ── AdMob helpers ─────────────────────────────────────────────────────────────

const REWARDED_AD_ID = 'ca-app-pub-3486420366158936/7901903950'

let admobLoaded = false
async function initAdMob() {
  if (admobLoaded) return
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    await AdMob.initialize({ initializeForTesting: false })
    admobLoaded = true
  } catch (_) {}
}

async function showRewardedAd() {
  try {
    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob')
    await initAdMob()
    return new Promise((resolve) => {
      let resolved = false
      const cleanup = () => {
        if (resolved) return
        resolved = true
        onRewarded.remove()
        onFailed.remove()
        onDismissed.remove()
        clearTimeout(timeout)
      }
      const timeout = setTimeout(() => { cleanup(); resolve(false) }, 15000)
      const onRewarded = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        cleanup(); resolve(true)
      })
      const onDismissed = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        cleanup(); resolve(false)
      })
      const onFailed = AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
        cleanup(); resolve(false)
      })
      AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID, isTesting: false })
        .then(() => AdMob.showRewardVideoAd())
        .catch(() => { cleanup(); resolve(false) })
    })
  } catch (_) {
    return false
  }
}

// ── Skins ─────────────────────────────────────────────────────────────────────

const SKINS = [
  { name: 'Classic',  color: null,      threshold: 0 },
  { name: 'Golden',   color: '#FFD700', threshold: 10 },
  { name: 'Rose',     color: '#FF6B8A', threshold: 25 },
  { name: 'Electric', color: '#00E5FF', threshold: 45 },
  { name: 'Shadow',   color: '#2C2C2C', threshold: 60 },
  { name: 'Rainbow',  color: 'rainbow', threshold: 80 },
]

// ── Default stats ─────────────────────────────────────────────────────────────

const DEFAULT_STATS = {
  totalGames: 0, totalWalls: 0, totalScore: 0,
  bestStreak: 0, levelsCompleted: 0, timePlayed: 0,
}

// ── Game state factory ────────────────────────────────────────────────────────

function initGame(startLevel = 1) {
  const lvl = LEVELS[Math.min(startLevel - 1, LEVELS.length - 1)]
  return {
    walls:              [],
    score:              0,
    speed:              lvl.speed,
    shapeIndex:         0,
    lastWallShapeIndex: -1,
    gamePhase:          'MENU',
    gameOverAt:         0,
    wallIdSeq:          0,
    playerX:            0,
    playerY:            0,
    playerScale:        1.0,
    streak:             0,
    level:              startLevel,
    wallsCleared:       0,
    levelMaxMult:       0,
    levelFitSum:        0,
    levelFitCount:      0,
    customLevel:        null,
    skinColor:          null,
    startTime:          Date.now(),
  }
}

// ── Animated floating shapes for the menu background ─────────────────────────

function FloatingShapes() {
  const shapes = SHAPES.map((s, i) => ({
    color: s.color, w: s.wFrac, h: s.hFrac,
    delay: i * 1.2, x: 15 + i * 30, dur: 4 + i * 0.8,
  }))
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {shapes.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${s.x}%`, top: '20%',
          width: Math.round(60 * s.w / 0.3), height: Math.round(60 * s.h / 0.3),
          background: s.color, borderRadius: 8, opacity: 0.12,
          animation: `floatShape ${s.dur}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
      {shapes.map((s, i) => (
        <div key={`b${i}`} style={{
          position: 'absolute',
          left: `${10 + i * 35}%`, top: '55%',
          width: Math.round(40 * s.w / 0.3), height: Math.round(40 * s.h / 0.3),
          background: s.color, borderRadius: 6, opacity: 0.08,
          animation: `floatShape ${s.dur + 1}s ease-in-out ${s.delay + 2}s infinite reverse`,
        }} />
      ))}
    </div>
  )
}

// ── Menu button component ────────────────────────────────────────────────────

function MenuButton({ children, onClick, primary, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: primary ? '14px 36px' : '12px 28px',
        minHeight: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: disabled
          ? 'rgba(150,150,150,0.3)'
          : primary
            ? 'linear-gradient(135deg, #5B8DEF 0%, #4FC3F7 100%)'
            : 'rgba(255,255,255,0.85)',
        color: disabled ? '#999' : primary ? 'white' : '#1A3A5C',
        fontFamily: 'monospace',
        fontSize: primary ? 16 : 14,
        fontWeight: 'bold',
        letterSpacing: primary ? 3 : 1,
        borderRadius: 12,
        cursor: disabled ? 'default' : 'pointer',
        pointerEvents: disabled ? 'none' : 'auto',
        border: disabled ? '2px solid rgba(150,150,150,0.2)' : primary ? '2px solid rgba(255,255,255,0.3)' : '2px solid rgba(91,141,239,0.3)',
        boxShadow: disabled ? 'none' : primary
          ? '0 4px 20px rgba(91,141,239,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
          : '0 2px 12px rgba(0,0,0,0.08)',
        textAlign: 'center',
        transition: 'transform 0.15s, box-shadow 0.15s',
        textShadow: primary ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = 'scale(1.05)' } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {children}
    </div>
  )
}

// ── Bubbly game logo ─────────────────────────────────────────────────────────

function GameLogo() {
  const letters = [
    { ch: 'G', color: '#4FC3F7', size: 110, rot: -8,  y: -6  },
    { ch: 'A', color: '#5BE0A8', size: 96,  rot: 5,   y: 2   },
    { ch: 'P', color: '#81C784', size: 118, rot: -4,  y: -10 },
    { ch: ' ', color: 'none',    size: 30,  rot: 0,   y: 0   },
    { ch: 'R', color: '#FFB74D', size: 108, rot: 6,   y: -4  },
    { ch: 'U', color: '#FF8A65', size: 92,  rot: -7,  y: 4   },
    { ch: 'N', color: '#FF6B6B', size: 114, rot: 3,   y: -8  },
    { ch: 'N', color: '#E040FB', size: 100, rot: -5,  y: 0   },
    { ch: 'E', color: '#7C4DFF', size: 110, rot: 7,   y: -6  },
    { ch: 'R', color: '#4FC3F7', size: 106, rot: -3,  y: 2   },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 0, padding: '0 4px', width: '96vw', maxWidth: 620,
    }}>
      {letters.map((l, i) => {
        if (l.ch === ' ') return <div key={i} style={{ width: 16 }} />
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontFamily: "'Arial Black', 'Impact', sans-serif",
              fontWeight: 900,
              fontSize: `clamp(${l.size * 0.5}px, ${l.size / 9}vw, ${l.size}px)`,
              color: l.color,
              textShadow: `
                0 3px 0 rgba(0,0,0,0.15),
                0 6px 12px rgba(0,0,0,0.1),
                0 0 24px ${l.color}66
              `,
              WebkitTextStroke: '2px rgba(255,255,255,0.6)',
              paintOrder: 'stroke fill',
              lineHeight: 1,
              animation: `bubbleBounce_${i} 2.2s ease-in-out infinite`,
            }}
          >
            {l.ch}
          </span>
        )
      })}
      <style>{letters.map((l, i) => l.ch === ' ' ? '' : `
        @keyframes bubbleBounce_${i} {
          0%, 100% { transform: rotate(${l.rot}deg) translateY(${l.y}px) scale(1); }
          50% { transform: rotate(${l.rot + (i % 2 ? 2 : -2)}deg) translateY(${l.y - 10}px) scale(1.08); }
        }
      `).join('')}</style>
    </div>
  )
}

// ── Collision diagram ────────────────────────────────────────────────────────

function CollisionDiagram({ info }) {
  if (!info) return null

  const SIZE = 180
  const PAD  = 12

  const diagScale = (SIZE - PAD * 2) / Math.max(info.wallW, info.wallH)
  const halfS = SIZE / 2

  function toX(v) { return halfS + v * diagScale }
  function toY(v) { return halfS - v * diagScale }

  const wL = toX(-info.wallW / 2), wR = toX(info.wallW / 2)
  const wT = toY(info.wallH / 2),  wB = toY(-info.wallH / 2)
  const gL = toX(info.gapX - info.gapW / 2)
  const gR = toX(info.gapX + info.gapW / 2)
  const gT = toY(info.gapY + info.gapH / 2)
  const gB = toY(info.gapY - info.gapH / 2)
  const pL = toX(info.playerX - info.playerW / 2)
  const pR = toX(info.playerX + info.playerW / 2)
  const pT = toY(info.playerY + info.playerH / 2)
  const pB = toY(info.playerY - info.playerH / 2)

  const collisionEdges = []
  if (info.playerX - info.playerW / 2 < info.gapX - info.gapW / 2)
    collisionEdges.push({ x1: pL, y1: pT, x2: pL, y2: pB })
  if (info.playerX + info.playerW / 2 > info.gapX + info.gapW / 2)
    collisionEdges.push({ x1: pR, y1: pT, x2: pR, y2: pB })
  if (info.playerY + info.playerH / 2 > info.gapY + info.gapH / 2)
    collisionEdges.push({ x1: pL, y1: pT, x2: pR, y2: pT })
  if (info.playerY - info.playerH / 2 < info.gapY - info.gapH / 2)
    collisionEdges.push({ x1: pL, y1: pB, x2: pR, y2: pB })

  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#4A6A8A', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1 }}>
        COLLISION VIEW
      </span>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)' }}
      >
        <rect x={wL} y={wT} width={wR - wL} height={wB - wT} fill="#FF6B6B" opacity={0.35} />
        <rect x={gL} y={gT} width={gR - gL} height={gB - gT}
          fill="white" stroke={info.gapColor} strokeWidth={2} strokeDasharray="4 2" />
        <rect x={pL} y={pT} width={pR - pL} height={pB - pT}
          fill={info.playerColor} opacity={0.7} stroke={info.playerColor} strokeWidth={1.5} rx={3} />
        {collisionEdges.map((e, i) => (
          <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="#FF0000" strokeWidth={3.5} strokeLinecap="round" />
        ))}
        <text x={gL + (gR - gL) / 2} y={gT - 4} textAnchor="middle"
          fill={info.gapColor} fontSize={9} fontFamily="monospace" fontWeight="bold">GAP</text>
        <text x={pL + (pR - pL) / 2} y={pB + 11} textAnchor="middle"
          fill={info.playerColor} fontSize={9} fontFamily="monospace" fontWeight="bold">YOU</text>
      </svg>
    </div>
  )
}

// ── Shape indicator panel ────────────────────────────────────────────────────

function ShapePanel({ shape, side, label, onClick }) {
  const PREVIEW = 48
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed', [side]: '2%', top: '55%', transform: 'translateY(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.8)', border: `1px solid ${shape.color}66`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: 8, padding: '10px 10px', cursor: 'pointer',
        minWidth: 44, minHeight: 44,
      }}
    >
      <div style={{ width: PREVIEW, height: PREVIEW, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: shape.wFrac * PREVIEW, height: shape.hFrac * PREVIEW,
          background: shape.color, borderRadius: 3, border: `1.5px solid ${shape.color}`,
          boxShadow: `0 0 8px ${shape.color}88`, opacity: 0.82,
        }} />
      </div>
      <span style={{ color: 'rgba(0,0,0,0.45)', fontFamily: 'monospace', fontSize: 9 }}>{label}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GapRunner() {
  const gameRef          = useRef(initGame())
  const isDraggingRef    = useRef(false)
  const pointerNDCRef    = useRef({ x: 0, y: 0 })
  const pinchRef         = useRef({ active: false, initialDist: 0, initialScale: 1 })
  const dangerRef        = useRef(null)
  const canvasWrapRef    = useRef(null)
  const soundRef         = useRef(null)
  const particleBurstsRef = useRef([])
  const deathRef         = useRef(null)
  const playerVisibleRef = useRef(true)
  const usedContinueRef  = useRef(false)
  const deathSnapshotRef = useRef(null)
  const invincibleRef    = useRef(false)
  const shakeRef         = useRef({ intensity: 0, duration: 0, elapsed: 999 })
  const timeScaleRef     = useRef({ value: 1.0 })

  const displayPhaseRef = useRef('MENU')
  const [displayPhase,  setDisplayPhase_]  = useState('MENU')
  const setDisplayPhase = useCallback((v) => { displayPhaseRef.current = v; setDisplayPhase_(v) }, [])
  const [finalScore,    setFinalScore]    = useState(0)
  const [collisionInfo, setCollisionInfo] = useState(null)
  const [wallIds,       setWallIds]       = useState([])
  const [shapeIndex,    setShapeIndex]    = useState(0)
  const [score,         setScore]         = useState(0)
  const [highScore,     setHighScore]     = useState(0)
  const [savedLevel,    setSavedLevel]    = useState(1)
  const [streak,        setStreak]        = useState(0)
  const [level,         setLevel]         = useState(1)
  const [levelName,     setLevelName]     = useState(LEVELS[0].name)
  const [milestoneText, setMilestoneText] = useState('')
  const [nearMissFlash, setNearMissFlash] = useState(false)
  const [fitPopup,      setFitPopup]      = useState(null) // { percent, key }
  const [levelUpText,   setLevelUpText]   = useState('')
  const [muted,         setMuted]         = useState(false)
  const [finalLevel,    setFinalLevel]    = useState(1)
  const [multiplier,    setMultiplier]    = useState(1)
  const [levelStars,    setLevelStars]    = useState({})
  const [completedStars, setCompletedStars] = useState(0)
  const [resizeTip,     setResizeTip]     = useState(false)
  const resizeTipShownRef = useRef(false)
  const [showingAd,     setShowingAd]     = useState(false)
  const [canContinue,   setCanContinue]   = useState(false)
  const [selectedSkin,  setSelectedSkin]  = useState(0)
  const [stats,         setStats]         = useState(DEFAULT_STATS)
  const [comboBreakText, setComboBreakText] = useState('')

  // Load saved data
  useEffect(() => {
    try {
      const best = localStorage.getItem('gaprunner_best')
      if (best) setHighScore(parseInt(best, 10) || 0)
      const lvl = localStorage.getItem('gaprunner_level')
      if (lvl) setSavedLevel(Math.max(1, parseInt(lvl, 10) || 1))
      const stars = localStorage.getItem('gaprunner_stars')
      if (stars) setLevelStars(JSON.parse(stars))
      const savedStats = localStorage.getItem('gaprunner_stats')
      if (savedStats) setStats(prev => ({ ...prev, ...JSON.parse(savedStats) }))
      const savedSkin = localStorage.getItem('gaprunner_skin')
      if (savedSkin) setSelectedSkin(parseInt(savedSkin, 10) || 0)
    } catch (_) {}
  }, [])

  // Save level progress
  const saveLevelProgress = useCallback((lvl) => {
    try {
      const current = parseInt(localStorage.getItem('gaprunner_level') || '1', 10)
      if (lvl > current) {
        localStorage.setItem('gaprunner_level', String(lvl))
        setSavedLevel(lvl)
      }
    } catch (_) {}
  }, [])

  // Shake helper
  const triggerShake = useCallback((intensity, duration) => {
    shakeRef.current = { intensity, duration, elapsed: 0 }
  }, [])

  // Freeze-frame helper
  const triggerFreeze = useCallback((duration = 80) => {
    timeScaleRef.current.value = 0.12
    setTimeout(() => { timeScaleRef.current.value = 1.0 }, duration)
  }, [])

  // Save star ratings
  const saveStars = useCallback((lvl, stars) => {
    try {
      setLevelStars(prev => {
        const next = { ...prev }
        if (!next[lvl] || stars > next[lvl]) {
          next[lvl] = stars
          localStorage.setItem('gaprunner_stars', JSON.stringify(next))
        }
        return next
      })
    } catch (_) {}
  }, [])

  // Speed tier
  const speed = gameRef.current.speed || LEVELS[0].speed
  const speedTier = speed >= 45 ? 'INSANE!' : speed >= 35 ? 'BLAZING!' : speed >= 25 ? 'FAST!' : ''

  // ── Shape cycling ──────────────────────────────────────────────────────────
  const changeShape = useCallback((dir) => {
    const s = gameRef.current
    if (s.gamePhase !== 'PLAYING') return
    const newIdx = dir === 'prev'
      ? (s.shapeIndex - 1 + 3) % 3
      : (s.shapeIndex + 1) % 3
    s.shapeIndex = newIdx
    setShapeIndex(newIdx)
    if (soundRef.current) soundRef.current.playShapeChange()
  }, [])

  // ── Update stats helper ───────────────────────────────────────────────────
  const updateStats = useCallback((updates) => {
    setStats(prev => {
      const next = { ...prev }
      for (const [k, v] of Object.entries(updates)) {
        if (k === 'bestStreak') next[k] = Math.max(next[k] || 0, v)
        else next[k] = (next[k] || 0) + v
      }
      try { localStorage.setItem('gaprunner_stats', JSON.stringify(next)) } catch (_) {}
      return next
    })
  }, [])

  // ── Start game from a specific level ───────────────────────────────────────
  const startGame = useCallback((fromLevel = 1) => {
    const fresh = initGame(fromLevel)
    fresh.gamePhase = 'PLAYING'
    fresh.skinColor = SKINS[selectedSkin] ? SKINS[selectedSkin].color : null
    gameRef.current = fresh
    playerVisibleRef.current = true
    particleBurstsRef.current = []
    deathRef.current = null
    usedContinueRef.current = false
    deathSnapshotRef.current = null
    setCanContinue(false)
    setWallIds([])
    setShapeIndex(0)
    setScore(0)
    setStreak(0)
    setLevel(fromLevel)
    setLevelName(LEVELS[Math.min(fromLevel - 1, LEVELS.length - 1)].name)
    setMilestoneText('')
    setLevelUpText('')
    setDisplayPhase('PLAYING')

    if (!soundRef.current) soundRef.current = new SoundManager()
    soundRef.current.resume()
    const lvlDef = LEVELS[Math.min(fromLevel - 1, LEVELS.length - 1)]
    soundRef.current.startMusic(100 + lvlDef.speed * 1.5)
  }, [selectedSkin])

  // ── Advance to next level from LEVEL_COMPLETE screen ────────────────────────
  const handleNextLevel = useCallback(() => {
    const s = gameRef.current
    if (s.gamePhase !== 'LEVEL_COMPLETE') return
    s.wallsCleared = 0
    s.levelMaxMult = 0
    s.levelFitSum = 0
    s.levelFitCount = 0
    s.level++
    s.walls = []
    const newLvl = LEVELS[Math.min(s.level - 1, LEVELS.length - 1)]
    s.speed = newLvl.speed
    s.gamePhase = 'PLAYING'
    setLevel(s.level)
    setLevelName(newLvl.name)
    setDisplayPhase('PLAYING')
    setWallIds([])

    if (soundRef.current) {
      soundRef.current.resume()
      soundRef.current.startMusic(100 + newLvl.speed * 1.5)
    }
  }, [])

  // ── Go to main menu ────────────────────────────────────────────────────────
  const goToMenu = useCallback(() => {
    const s = gameRef.current
    s.gamePhase = 'MENU'
    setDisplayPhase('MENU')
    if (soundRef.current) soundRef.current.stopMusic()
  }, [])

  // ── Continue from death (after ad) ────────────────────────────────────────
  const continueFromDeath = useCallback(() => {
    const snap = deathSnapshotRef.current
    if (!snap) return

    // Restore game state
    const s = gameRef.current
    s.walls = snap.walls
    s.score = snap.score
    s.speed = snap.speed
    s.shapeIndex = snap.shapeIndex
    s.lastWallShapeIndex = snap.lastWallShapeIndex
    s.wallIdSeq = snap.wallIdSeq
    s.playerX = 0
    s.playerY = 0
    s.playerScale = 1.0
    s.streak = 0
    s.level = snap.level
    s.wallsCleared = snap.wallsCleared
    s.levelMaxMult = snap.levelMaxMult
    s.levelFitSum = snap.levelFitSum
    s.levelFitCount = snap.levelFitCount
    s.gamePhase = 'PLAYING'

    playerVisibleRef.current = true
    deathRef.current = null
    particleBurstsRef.current = []
    usedContinueRef.current = true
    deathSnapshotRef.current = null
    setCanContinue(false)

    // Grant 3 seconds of invincibility
    invincibleRef.current = true
    setTimeout(() => { invincibleRef.current = false }, 3000)

    setScore(snap.score)
    setStreak(0)
    setLevel(snap.level)
    setLevelName(LEVELS[Math.min(snap.level - 1, LEVELS.length - 1)].name)
    setShapeIndex(snap.shapeIndex)
    setWallIds(snap.walls.map(w => ({ id: w.id, gapShapeIndex: w.gapShapeIndex, gapOffsetX: w.gapOffsetX, gapOffsetY: w.gapOffsetY, gapPad: w.gapPad })))
    setDisplayPhase('PLAYING')

    if (!soundRef.current) soundRef.current = new SoundManager()
    soundRef.current.resume()
    const lvlDef = LEVELS[Math.min(snap.level - 1, LEVELS.length - 1)]
    soundRef.current.startMusic(100 + lvlDef.speed * 1.5)
  }, [])

  const [adCountdown, setAdCountdown] = useState(0)

  const startAdThenContinue = useCallback(async () => {
    setShowingAd(true)
    const rewarded = await showRewardedAd()
    if (rewarded) {
      setAdCountdown(3)
      let count = 3
      const timer = setInterval(() => {
        count--
        setAdCountdown(count)
        if (count <= 0) {
          clearInterval(timer)
          setShowingAd(false)
          setAdCountdown(0)
          continueFromDeath()
        }
      }, 1000)
    } else {
      setShowingAd(false)
    }
  }, [continueFromDeath])

  // ── Skin selection ───────────────────────────────────────────────────────
  const selectSkin = useCallback((idx) => {
    setSelectedSkin(idx)
    try { localStorage.setItem('gaprunner_skin', String(idx)) } catch (_) {}
  }, [])

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    const s = gameRef.current
    if (s.gamePhase === 'PLAYING') {
      s.gamePhase = 'PAUSED'
      setDisplayPhase('PAUSED')
      if (soundRef.current) soundRef.current.stopMusic()
    } else if (s.gamePhase === 'PAUSED') {
      s.gamePhase = 'PLAYING'
      setDisplayPhase('PLAYING')
      if (soundRef.current) {
        soundRef.current.resume()
        const lvlDef = LEVELS[Math.min(s.level - 1, LEVELS.length - 1)]
        soundRef.current.startMusic(100 + lvlDef.speed * 1.5)
      }
    }
  }, [])

  // ── Handle start (from keyboard/tap during GAME_OVER) ─────────────────────
  const handleStart = useCallback(() => {
    // Menu and game over are handled by buttons now
  }, [])

  const handleGameOver = useCallback((val, colInfo) => {
    setFinalScore(val)
    setFinalLevel(gameRef.current.level)
    setCollisionInfo(colInfo || null)

    // Save snapshot for continue-from-death
    const s = gameRef.current
    deathSnapshotRef.current = {
      walls: s.walls.filter(w => w.z < -2), // keep walls that haven't passed yet
      score: s.score,
      speed: s.speed,
      shapeIndex: s.shapeIndex,
      lastWallShapeIndex: s.lastWallShapeIndex,
      wallIdSeq: s.wallIdSeq,
      playerX: s.playerX,
      playerY: s.playerY,
      playerScale: s.playerScale,
      streak: s.streak,
      level: s.level,
      wallsCleared: s.wallsCleared,
      levelMaxMult: s.levelMaxMult,
      levelFitSum: s.levelFitSum,
      levelFitCount: s.levelFitCount,
    }
    setCanContinue(!usedContinueRef.current)
    setDisplayPhase('GAME_OVER')

    // Save level progress (the level they reached)
    saveLevelProgress(gameRef.current.level)

    // High score
    try {
      const best = parseInt(localStorage.getItem('gaprunner_best') || '0', 10)
      if (val > best) {
        localStorage.setItem('gaprunner_best', String(val))
        setHighScore(val)
      }
    } catch (_) {}

    // Haptic feedback
    try { navigator.vibrate && navigator.vibrate([100, 50, 100]) } catch (_) {}

    // Track stats
    const elapsed = Math.round((Date.now() - s.startTime) / 1000)
    updateStats({
      totalGames: 1,
      totalWalls: s.wallsCleared,
      totalScore: val,
      bestStreak: s.streak,
      timePlayed: elapsed,
    })

    if (soundRef.current) {
      soundRef.current.playDeath()
      soundRef.current.stopMusic()
    }
  }, [saveLevelProgress, updateStats])

  // ── Game events ────────────────────────────────────────────────────────────
  const handleEvent = useCallback((event) => {
    const sm = soundRef.current

    switch (event.type) {
      case 'PASS':
        if (sm) sm.playPass()
        try { navigator.vibrate && navigator.vibrate(15) } catch (_) {}
        if (event.nearMiss) {
          if (sm) sm.playNearMiss()
          setNearMissFlash(true)
          triggerShake(0.25, 0.15)
          triggerFreeze(60)
          setTimeout(() => setNearMissFlash(false), 600)
          try { navigator.vibrate && navigator.vibrate([30, 20, 30]) } catch (_) {}
        }
        setStreak(event.streak)
        setMultiplier(event.multiplier || 1)
        setFitPopup({ percent: event.fitPercent, points: event.points, key: Date.now() })
        setTimeout(() => setFitPopup(null), 1200)
        // Show resize tip on early levels
        if (gameRef.current.level <= 5 && !resizeTipShownRef.current && event.fitPercent < 60) {
          resizeTipShownRef.current = true
          setResizeTip(true)
          setTimeout(() => setResizeTip(false), 4000)
        }
        break

      case 'COMBO_BREAK':
        if (sm) sm.playComboBreak()
        setComboBreakText(`${event.streak}x COMBO LOST!`)
        setTimeout(() => setComboBreakText(''), 1500)
        setStreak(0)
        setMultiplier(1)
        try { navigator.vibrate && navigator.vibrate([50, 30, 50]) } catch (_) {}
        break

      case 'MILESTONE':
        if (sm) sm.playMilestone()
        setMilestoneText(event.label)
        triggerShake(0.2, 0.2)
        setTimeout(() => setMilestoneText(''), 2000)
        break

      case 'LEVEL_COMPLETE':
        if (sm) sm.playLevelUp()
        triggerShake(0.3, 0.25)
        saveLevelProgress(event.level + 1)
        setCompletedStars(event.stars || 1)
        saveStars(event.level, event.stars || 1)
        setDisplayPhase('LEVEL_COMPLETE')
        if (sm) sm.stopMusic()
        updateStats({ levelsCompleted: 1 })
        break

      case 'DEATH':
        triggerShake(0.6, 0.4)
        triggerFreeze(100)
        try { navigator.vibrate && navigator.vibrate([100, 50, 100]) } catch (_) {}
        break
    }
  }, [saveLevelProgress, saveStars, triggerShake, triggerFreeze, updateStats])

  // ── Mute toggle ────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!soundRef.current) soundRef.current = new SoundManager()
    const nowMuted = soundRef.current.toggleMute()
    setMuted(nowMuted)
  }, [])

  // ── Input events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = canvasWrapRef.current

    function toNDC(clientX, clientY) {
      return {
        x:  (clientX / window.innerWidth)  * 2 - 1,
        y: -(clientY / window.innerHeight) * 2 + 1,
      }
    }

    function touchDist(a, b) {
      const dx = a.clientX - b.clientX
      const dy = a.clientY - b.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const pinch = pinchRef.current

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        const phase = gameRef.current.gamePhase
        if (phase === 'PLAYING' || phase === 'PAUSED') togglePause()
        else if (displayPhaseRef.current === 'LEVEL_SELECT' || displayPhaseRef.current === 'STATS') setDisplayPhase('MENU')
        return
      }
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') { e.preventDefault(); changeShape('prev') }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); changeShape('next') }
      if (e.key === ' ') {
        e.preventDefault()
        const phase = gameRef.current.gamePhase
        if (phase === 'PLAYING') changeShape('next')
        else if (phase === 'PAUSED') togglePause()
        else if (phase === 'LEVEL_COMPLETE') handleNextLevel()
      }
    }

    function onMouseDown(e) {
      const phase = gameRef.current.gamePhase
      if (phase === 'LEVEL_COMPLETE') { handleNextLevel(); return }
      if (phase !== 'PLAYING') return
      isDraggingRef.current = true
      pointerNDCRef.current = toNDC(e.clientX, e.clientY)
    }
    function onMouseMove(e) {
      if (!isDraggingRef.current) return
      pointerNDCRef.current = toNDC(e.clientX, e.clientY)
    }
    function onMouseUp() { isDraggingRef.current = false }

    function onWheel(e) {
      e.preventDefault()
      const s = gameRef.current
      if (s.gamePhase !== 'PLAYING') return
      const step = e.deltaY > 0 ? -0.07 : 0.07
      s.playerScale = Math.max(0.5, Math.min(2.0, s.playerScale + step))
    }

    function onTouchStart(e) {
      const phase = gameRef.current.gamePhase
      if (phase === 'LEVEL_COMPLETE') { handleNextLevel(); return }
      if (phase !== 'PLAYING') return
      if (e.touches.length === 2) {
        pinch.active       = true
        pinch.initialDist  = touchDist(e.touches[0], e.touches[1])
        pinch.initialScale = gameRef.current.playerScale
        isDraggingRef.current = false
      } else if (e.touches.length === 1 && !pinch.active) {
        isDraggingRef.current = true
        pointerNDCRef.current = toNDC(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    function onTouchMove(e) {
      const s = gameRef.current
      if (s.gamePhase !== 'PLAYING') return
      if (e.touches.length === 2 && pinch.active) {
        e.preventDefault()
        const dist  = touchDist(e.touches[0], e.touches[1])
        const ratio = dist / pinch.initialDist
        s.playerScale = Math.max(0.5, Math.min(2.0, pinch.initialScale * ratio))
      } else if (e.touches.length === 1 && isDraggingRef.current) {
        pointerNDCRef.current = toNDC(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    function onTouchEnd(e) {
      if (e.touches.length < 2) pinch.active = false
      if (e.touches.length === 0) isDraggingRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    wrap.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    wrap.addEventListener('wheel', onWheel, { passive: false })
    wrap.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      wrap.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      wrap.removeEventListener('wheel', onWheel)
      wrap.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [changeShape, handleStart, handleNextLevel, togglePause])

  const prevShape = SHAPES[(shapeIndex - 1 + 3) % 3]
  const nextShape = SHAPES[(shapeIndex + 1) % 3]
  const lvlDef = LEVELS[Math.min(level - 1, LEVELS.length - 1)]
  const savedLvlDef = LEVELS[Math.min(savedLevel - 1, LEVELS.length - 1)]
  const theme = getTheme(level)

  return (
    <div style={{ position: 'fixed', inset: 0, background: theme.sky, overflow: 'hidden', userSelect: 'none', transition: 'background 1s ease' }}>

      {/* Canvas wrapper */}
      <div ref={canvasWrapRef} style={{ position: 'fixed', inset: 0, zIndex: 1, touchAction: 'none' }}>
        <GameCanvas
          gameRef={gameRef}
          wallIds={wallIds}
          setWallIds={setWallIds}
          setScore={setScore}
          dangerRef={dangerRef}
          onGameOver={handleGameOver}
          onEvent={handleEvent}
          isDraggingRef={isDraggingRef}
          pointerNDCRef={pointerNDCRef}
          particleBurstsRef={particleBurstsRef}
          deathRef={deathRef}
          playerVisibleRef={playerVisibleRef}
          shakeRef={shakeRef}
          timeScaleRef={timeScaleRef}
          invincibleRef={invincibleRef}
        />
      </div>

      {/* Danger vignette */}
      <div ref={dangerRef} style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5,
        background: 'radial-gradient(ellipse at center, transparent 25%, rgba(200,0,0,0.5) 100%)', opacity: 0,
      }} />

      {/* ── PLAYING HUD ── */}
      {displayPhase === 'PLAYING' && (
        <>
          <div style={{
            position: 'fixed', top: 12, left: 12, zIndex: 10,
            color: '#1A3A5C', fontFamily: 'monospace', fontWeight: 'bold',
            textShadow: '0 1px 3px rgba(255,255,255,0.6)', pointerEvents: 'none',
            maxWidth: '35vw',
          }}>
            <div style={{ fontSize: 'clamp(14px, 4vw, 20px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {score.toLocaleString()}
              {multiplier > 1 && (
                <span style={{
                  fontSize: 'clamp(11px, 2.5vw, 14px)', color: multiplier >= 4 ? '#FF1744' : multiplier >= 3 ? '#FF9100' : '#FFD600',
                  background: 'rgba(0,0,0,0.1)', borderRadius: 6, padding: '2px 6px',
                  animation: 'streakPulse 0.3s ease-out',
                  fontWeight: 'bold',
                }}>
                  {multiplier}x
                </span>
              )}
            </div>
            {speedTier && <div style={{ fontSize: 11, color: '#D32F2F', marginTop: 2 }}>{speedTier}</div>}
          </div>

          <div style={{
            position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            color: '#1A3A5C', fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'center',
            textShadow: '0 1px 3px rgba(255,255,255,0.6)', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 12 }}>LV.{level}</div>
            <div style={{ fontSize: 10, color: '#4A6A8A', marginTop: 1 }}>{levelName}</div>
            <div style={{ marginTop: 3, width: 80, height: 3, background: 'rgba(0,0,0,0.1)', borderRadius: 2 }}>
              <div style={{
                width: `${Math.min(100, (gameRef.current.wallsCleared / lvlDef.walls) * 100)}%`,
                height: '100%', background: '#5B8DEF', borderRadius: 2, transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {streak >= 3 && (
            <div style={{
              position: 'fixed', top: 58, left: 12, zIndex: 10,
              color: '#FF8C00', fontFamily: 'monospace', fontSize: Math.min(14 + streak, 24), fontWeight: 'bold',
              textShadow: '0 0 10px rgba(255,140,0,0.5)', pointerEvents: 'none',
              animation: 'streakPulse 0.5s ease-in-out',
            }}>
              {streak}x STREAK!
            </div>
          )}

          {fitPopup && (
            <div key={fitPopup.key} style={{
              position: 'fixed', top: '48%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 14,
              pointerEvents: 'none',
              animation: 'fitPopFloat 1.2s ease-out forwards',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                color: fitPopup.percent >= 80 ? '#4FC3F7' : fitPopup.percent >= 60 ? '#81C784' : '#FFB74D',
                fontFamily: 'monospace', fontSize: 'clamp(22px,5vw,40px)', fontWeight: 'bold',
                textShadow: `0 0 16px ${fitPopup.percent >= 80 ? 'rgba(79,195,247,0.6)' : fitPopup.percent >= 60 ? 'rgba(129,199,132,0.6)' : 'rgba(255,183,77,0.6)'}`,
              }}>
                {fitPopup.percent >= 90 ? 'PERFECT!' : fitPopup.percent >= 70 ? 'GREAT!' : fitPopup.percent >= 50 ? 'GOOD' : 'OK'}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'monospace', fontWeight: 'bold',
              }}>
                <div style={{
                  width: 60, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${fitPopup.percent}%`, height: '100%', borderRadius: 3,
                    background: fitPopup.percent >= 80 ? '#4FC3F7' : fitPopup.percent >= 60 ? '#81C784' : '#FFB74D',
                  }} />
                </div>
                <span style={{
                  color: 'rgba(255,255,255,0.7)', fontSize: 'clamp(12px,2vw,16px)',
                  textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}>
                  {fitPopup.percent}% fill
                </span>
              </div>
              {fitPopup.points && (
                <div style={{
                  color: '#FFD700', fontFamily: 'monospace', fontSize: 'clamp(14px,2.5vw,20px)', fontWeight: 'bold',
                  textShadow: '0 0 10px rgba(255,215,0,0.5)',
                }}>
                  +{fitPopup.points.toLocaleString()}
                </div>
              )}
            </div>
          )}

          {nearMissFlash && (
            <div style={{
              position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 15,
              color: '#FFD700', fontFamily: 'monospace', fontSize: 32, fontWeight: 'bold',
              textShadow: '0 0 20px rgba(255,215,0,0.8)', pointerEvents: 'none',
              animation: 'nearMissFade 0.6s ease-out forwards',
            }}>
              CLOSE!
            </div>
          )}

          {comboBreakText && (
            <div style={{
              position: 'fixed', top: '44%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 15,
              color: '#D32F2F', fontFamily: 'monospace', fontSize: 'clamp(18px,4vw,30px)', fontWeight: 'bold',
              textShadow: '0 0 16px rgba(211,47,47,0.6)', pointerEvents: 'none',
              animation: 'comboBreakFade 1.5s ease-out forwards',
            }}>
              {comboBreakText}
            </div>
          )}

          {resizeTip && (
            <div style={{
              position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 16,
              pointerEvents: 'none', background: 'rgba(0,0,0,0.35)', borderRadius: 14, padding: '14px 24px',
              color: 'white', fontFamily: 'monospace', fontSize: 14, textAlign: 'center',
              border: '1px solid rgba(255,215,0,0.3)',
              animation: 'fitPopFloat 4s ease-out forwards', lineHeight: 1.6,
            }}>
              Scroll / pinch to resize your shape<br/>
              <span style={{ color: '#FFD700', fontWeight: 'bold' }}>Bigger shape = more points!</span>
            </div>
          )}

          {milestoneText && (
            <div style={{
              position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 15,
              color: '#FF4081', fontFamily: 'monospace', fontSize: 'clamp(24px,5vw,42px)', fontWeight: 'bold',
              textShadow: '0 0 20px rgba(255,64,129,0.6)', pointerEvents: 'none',
              animation: 'milestonePop 2s ease-out forwards',
            }}>
              {milestoneText}
            </div>
          )}

          {levelUpText && (
            <div style={{
              position: 'fixed', top: '25%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 15,
              color: '#5B8DEF', fontFamily: 'monospace', fontSize: 'clamp(20px,4vw,36px)', fontWeight: 'bold',
              textShadow: '0 0 20px rgba(91,141,239,0.6)', pointerEvents: 'none',
              animation: 'milestonePop 2.5s ease-out forwards',
            }}>
              {levelUpText}
            </div>
          )}

          {/* Pause button */}
          <div
            onClick={togglePause}
            style={{
              position: 'fixed', top: 12, right: 56, zIndex: 25,
              width: 44, height: 44, borderRadius: 22,
              background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 16, pointerEvents: 'auto',
              border: '1px solid rgba(0,0,0,0.1)', fontFamily: 'monospace', fontWeight: 'bold',
              color: '#1A3A5C',
            }}
          >
            ⏸
          </div>

          <ShapePanel shape={prevShape} side="left"  label="◀  LEFT"  onClick={() => changeShape('prev')} />
          <ShapePanel shape={nextShape} side="right" label="RIGHT  ▶" onClick={() => changeShape('next')} />
        </>
      )}

      {/* ═══════════════ PAUSED OVERLAY ═══════════════ */}
      {displayPhase === 'PAUSED' && (
        <div style={{
          ...overlayStyle,
          background: 'rgba(200,230,245,0.92)',
          pointerEvents: 'auto',
        }}>
          <h1 style={{
            color: '#1A3A5C', fontSize: 'clamp(28px,6vw,48px)', fontFamily: 'monospace',
            letterSpacing: 6, marginBottom: 8, fontWeight: 900,
            textShadow: '0 2px 8px rgba(91,141,239,0.3)',
          }}>
            PAUSED
          </h1>

          <p style={{
            color: '#4A6A8A', fontFamily: 'monospace', fontSize: 14, marginBottom: 32,
          }}>
            Level {level} — {levelName}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <MenuButton primary onClick={togglePause}>
              RESUME
            </MenuButton>
            <MenuButton onClick={goToMenu}>
              MAIN MENU
            </MenuButton>
          </div>

          <p style={{
            color: '#7A9AB8', fontFamily: 'monospace', fontSize: 11, marginTop: 28,
          }}>
            ESC or SPACE to resume
          </p>
        </div>
      )}

      {/* Mute button (always visible) */}
      <div
        onClick={toggleMute}
        style={{
          position: 'fixed', top: 12, right: 8, zIndex: 25,
          width: 44, height: 44, borderRadius: 22,
          background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 18, pointerEvents: 'auto',
          border: '1px solid rgba(0,0,0,0.1)',
        }}
      >
        {muted ? '\u{1F507}' : '\u{1F50A}'}
      </div>

      {/* ═══════════════ LEVEL COMPLETE ═══════════════ */}
      {displayPhase === 'LEVEL_COMPLETE' && (() => {
        const completedLevel = gameRef.current.level
        const completedDef = LEVELS[Math.min(completedLevel - 1, LEVELS.length - 1)]
        const nextLvl = Math.min(completedLevel + 1, LEVELS.length)
        const nextDef = LEVELS[Math.min(nextLvl - 1, LEVELS.length - 1)]
        return (
          <div style={{
            ...overlayStyle,
            background: 'linear-gradient(180deg, rgba(91,141,239,0.15) 0%, rgba(200,230,245,0.95) 30%, rgba(220,240,250,0.98) 100%)',
            pointerEvents: 'auto',
          }}>
            {/* Star rating */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 8,
              animation: 'levelCompleteStar 1s ease-out',
            }}>
              {[1, 2, 3].map(i => (
                <span key={i} style={{
                  fontSize: 36,
                  filter: i <= completedStars ? 'none' : 'grayscale(1) opacity(0.3)',
                  animationDelay: `${i * 0.2}s`,
                  animation: i <= completedStars ? `starPop 0.4s ease-out ${i * 0.2}s both` : 'none',
                }}>
                  {'\u2B50'}
                </span>
              ))}
            </div>

            <h1 style={{
              color: '#1A3A5C', fontSize: 'clamp(22px,5vw,36px)', fontFamily: 'monospace',
              letterSpacing: 4, margin: 0, fontWeight: 900, marginBottom: 4,
              textShadow: '0 2px 8px rgba(91,141,239,0.3)',
            }}>
              LEVEL {completedLevel} COMPLETE!
            </h1>

            <p style={{
              color: '#5B8DEF', fontFamily: 'monospace', fontSize: 14, letterSpacing: 2,
              marginBottom: 24, fontWeight: 'bold',
            }}>
              {completedDef.name}
            </p>

            <div style={{
              display: 'flex', gap: 20, marginBottom: 20, padding: '12px 24px',
              background: 'rgba(255,255,255,0.6)', borderRadius: 12,
              border: '1px solid rgba(91,141,239,0.15)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#1A3A5C', fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold' }}>
                  {score.toLocaleString()}
                </div>
                <div style={{ color: '#8A9AB0', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1 }}>
                  SCORE
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#FF8C00', fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold' }}>
                  {streak}
                </div>
                <div style={{ color: '#8A9AB0', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1 }}>
                  STREAK
                </div>
              </div>
            </div>

            {/* Next level preview */}
            <div style={{
              marginBottom: 20, padding: '10px 20px',
              background: 'rgba(91,141,239,0.08)', borderRadius: 10,
              border: '1px solid rgba(91,141,239,0.12)', textAlign: 'center',
            }}>
              <div style={{ color: '#7A9AB8', fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>
                UP NEXT
              </div>
              <div style={{ color: '#1A3A5C', fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold' }}>
                Level {nextLvl}: {nextDef.name}
              </div>
              <div style={{ color: '#5B8DEF', fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>
                {nextDef.walls} walls · Speed {nextDef.speed}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <MenuButton primary onClick={handleNextLevel}>
                NEXT LEVEL
              </MenuButton>
              <MenuButton onClick={goToMenu}>
                MAIN MENU
              </MenuButton>
            </div>

            {completedStars < 3 && (
              <p style={{
                color: '#8A9AB0', fontFamily: 'monospace', fontSize: 10, marginTop: -4, marginBottom: 8,
              }}>
                {completedStars < 2 ? 'Get 2x combo for more stars!' : 'Get 3x combo for all stars!'}
              </p>
            )}

            <p style={{
              color: '#7A9AB8', fontFamily: 'monospace', fontSize: 11, marginTop: 20,
            }}>
              TAP OR PRESS SPACE
            </p>

            <style>{`
              @keyframes levelCompleteStar {
                0% { transform: scale(0) rotate(-180deg); opacity: 0; }
                60% { transform: scale(1.3) rotate(10deg); opacity: 1; }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
              }
              @keyframes starPop {
                0% { transform: scale(0) rotate(-30deg); }
                60% { transform: scale(1.3) rotate(5deg); }
                100% { transform: scale(1) rotate(0deg); }
              }
            `}</style>
          </div>
        )
      })()}

      {/* ═══════════════ MAIN MENU ═══════════════ */}
      {displayPhase === 'MENU' && (() => {
        const totalStars = Object.values(levelStars).reduce((a, b) => a + b, 0)
        const maxStars = LEVELS.length * 3
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column',
            pointerEvents: 'auto', overflow: 'hidden',
            background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0F0 50%, #D4F1F9 100%)',
          }}>
            {/* 3D scene — top section */}
            <div style={{
              position: 'relative', width: '100%', flex: '0 0 28%', minHeight: 160,
            }}>
              <MenuCanvas />
              {/* Gradient fade into content */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
                background: 'linear-gradient(to bottom, transparent, #B0E0F0)',
                pointerEvents: 'none',
              }} />
            </div>

            {/* Content — bottom section, vertically centered */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(180deg, #B0E0F0 0%, #C8EAF5 50%, #D4F1F9 100%)',
              padding: '8px 16px 24px',
              overflow: 'auto',
            }}>
              {/* Bubbly game logo */}
              <div style={{ marginBottom: 8, overflow: 'visible' }}>
                <GameLogo />
              </div>

              <p style={{
                color: '#4A6A8A', fontFamily: 'monospace', fontSize: 10,
                letterSpacing: 3, marginBottom: 14, textTransform: 'uppercase',
                fontWeight: 'bold',
              }}>
                Shape Shift · Dodge · Survive
              </p>

              {/* Stats row — compact horizontal chips */}
              {(highScore > 0 || savedLevel > 1 || totalStars > 0) && (
                <div style={{
                  display: 'flex', gap: 6, marginBottom: 16, justifyContent: 'center',
                }}>
                  {highScore > 0 && (
                    <div style={{
                      padding: '4px 10px', borderRadius: 14,
                      background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,140,0,0.3)',
                      display: 'flex', alignItems: 'center', gap: 4,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      <span style={{ fontSize: 10 }}>{'\uD83C\uDFC6'}</span>
                      <span style={{ color: '#D48800', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>
                        {highScore.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {savedLevel > 1 && (
                    <div style={{
                      padding: '4px 10px', borderRadius: 14,
                      background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(91,141,239,0.3)',
                      display: 'flex', alignItems: 'center', gap: 4,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      <span style={{ fontSize: 10 }}>{'\uD83D\uDEA9'}</span>
                      <span style={{ color: '#3A6FD8', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>
                        Lv.{savedLevel}
                      </span>
                    </div>
                  )}
                  {totalStars > 0 && (
                    <div style={{
                      padding: '4px 10px', borderRadius: 14,
                      background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(218,165,32,0.3)',
                      display: 'flex', alignItems: 'center', gap: 4,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      <span style={{ fontSize: 10 }}>{'\u2B50'}</span>
                      <span style={{ color: '#C49B00', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>
                        {totalStars}/{maxStars}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Buttons — consistent width */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch', width: '100%', maxWidth: 300 }}>
                <div
                  onClick={() => startGame(1)}
                  style={{
                    padding: '14px 0', textAlign: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, #4FC3F7 0%, #5B8DEF 100%)',
                    color: 'white', fontFamily: 'monospace', fontSize: 18, fontWeight: 'bold',
                    letterSpacing: 3, borderRadius: 14, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 4px 24px rgba(79,195,247,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 32px rgba(79,195,247,0.5), inset 0 1px 0 rgba(255,255,255,0.2)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(79,195,247,0.3), inset 0 1px 0 rgba(255,255,255,0.15)' }}
                >
                  {'\u25B6'}  NEW GAME
                </div>

                {savedLevel > 1 && (
                  <div
                    onClick={() => startGame(savedLevel)}
                    style={{
                      padding: '12px 0', textAlign: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.85)',
                      color: '#1A3A5C', fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold',
                      letterSpacing: 1, borderRadius: 12, cursor: 'pointer',
                      border: '1px solid rgba(91,141,239,0.2)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                      transition: 'transform 0.12s, background 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.background = 'rgba(255,255,255,1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.85)' }}
                  >
                    CONTINUE — Lv.{savedLevel}
                  </div>
                )}

                <div
                  onClick={() => setDisplayPhase('LEVEL_SELECT')}
                  style={{
                    padding: '12px 0', textAlign: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.85)',
                    color: '#1A3A5C', fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold',
                    letterSpacing: 1, borderRadius: 12, cursor: 'pointer',
                    border: '1px solid rgba(91,141,239,0.2)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                    transition: 'transform 0.12s, background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.background = 'rgba(255,255,255,1)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.85)' }}
                >
                  LEVELS
                </div>
              </div>

              {/* Skins row */}
              {(() => {
                const unlockedStars = Object.values(levelStars).reduce((a, b) => a + b, 0)
                return (
                  <div style={{ marginTop: 18, width: '100%', maxWidth: 300 }}>
                    <div style={{ color: 'rgba(0,0,0,0.35)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, marginBottom: 6, textAlign: 'center' }}>
                      SKINS
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {SKINS.map((skin, i) => {
                        const unlocked = unlockedStars >= skin.threshold
                        const active = selectedSkin === i
                        return (
                          <div
                            key={i}
                            onClick={() => { if (unlocked) selectSkin(i) }}
                            style={{
                              width: 36, height: 36, borderRadius: 8, cursor: unlocked ? 'pointer' : 'default',
                              background: skin.color === 'rainbow'
                                ? 'linear-gradient(135deg, #FF6B6B, #FFB74D, #81C784, #4FC3F7, #7C4DFF)'
                                : skin.color || 'linear-gradient(135deg, #4FC3F7, #81C784, #FFB74D)',
                              border: active ? '3px solid #1A3A5C' : '2px solid rgba(0,0,0,0.1)',
                              opacity: unlocked ? 1 : 0.3,
                              transition: 'transform 0.12s',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title={unlocked ? skin.name : `${skin.threshold} stars needed`}
                            onMouseEnter={e => { if (unlocked) e.currentTarget.style.transform = 'scale(1.15)' }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                          >
                            {!unlocked && <span style={{ fontSize: 14 }}>{'\uD83D\uDD12'}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 12, marginTop: 18, justifyContent: 'center' }}>
                <div
                  onClick={() => setDisplayPhase('STATS')}
                  style={{
                    padding: '12px 28px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)',
                    color: '#4A6A8A', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
                    cursor: 'pointer', letterSpacing: 1,
                    transition: 'transform 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  STATS
                </div>
              </div>

              {/* Controls hint — bottom */}
              <p style={{
                color: 'rgba(0,0,0,0.25)', fontFamily: 'monospace', fontSize: 10, marginTop: 18,
                letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.7,
              }}>
                Drag to move · Scroll / pinch to resize<br />
                A / D or {'\u25C0'} {'\u25B6'} to change shape
              </p>
            </div>

            {/* CSS Animations */}
            <style>{`
              @keyframes streakPulse { 0% { transform: scale(1.3) } 100% { transform: scale(1) } }
              @keyframes nearMissFade { 0% { opacity:1; transform: translate(-50%,-50%) scale(1.2) } 100% { opacity:0; transform: translate(-50%,-80%) scale(0.8) } }
              @keyframes milestonePop { 0% { opacity:0; transform: translate(-50%,-50%) scale(0.5) } 15% { opacity:1; transform: translate(-50%,-50%) scale(1.1) } 30% { transform: translate(-50%,-50%) scale(1) } 80% { opacity:1 } 100% { opacity:0; transform: translate(-50%,-60%) scale(0.9) } }
              @keyframes fitPopFloat { 0% { opacity:1; transform: translate(-50%,-50%) scale(1.2) } 20% { transform: translate(-50%,-50%) scale(1) } 70% { opacity:1 } 100% { opacity:0; transform: translate(-50%,-90%) scale(0.85) } }
            `}</style>
          </div>
        )
      })()}

      {/* ═══════════════ LEVEL SELECT ═══════════════ */}
      {displayPhase === 'LEVEL_SELECT' && (() => {
        const totalStars = Object.values(levelStars).reduce((a, b) => a + b, 0)
        const maxStars = LEVELS.length * 3
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column',
            background: '#0D1B2A',
            pointerEvents: 'auto',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <div
                onClick={() => setDisplayPhase('MENU')}
                style={{
                  color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: 14,
                  cursor: 'pointer', padding: '6px 12px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                BACK
              </div>
              <h2 style={{
                color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', fontSize: 18,
                fontWeight: 'bold', letterSpacing: 3, margin: 0,
              }}>
                SELECT LEVEL
              </h2>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: '#FFD700', fontFamily: 'monospace', fontSize: 13,
              }}>
                {'\u2B50'} {totalStars}/{maxStars}
              </div>
            </div>

            {/* Level grid */}
            <div style={{
              flex: 1, overflow: 'auto', padding: '16px 16px 24px',
              display: 'flex', justifyContent: 'center',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 10, width: '100%', maxWidth: 640,
                alignContent: 'start',
              }}>
                {LEVELS.map((lvl, i) => {
                  const lvlNum = i + 1
                  const unlocked = lvlNum <= savedLevel
                  const stars = levelStars[lvlNum] || 0
                  return (
                    <div
                      key={lvlNum}
                      onClick={() => { if (unlocked) startGame(lvlNum) }}
                      style={{
                        padding: '14px 12px 12px', borderRadius: 12,
                        background: unlocked
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(255,255,255,0.02)',
                        border: unlocked
                          ? '1px solid rgba(91,141,239,0.2)'
                          : '1px solid rgba(255,255,255,0.04)',
                        cursor: unlocked ? 'pointer' : 'default',
                        opacity: unlocked ? 1 : 0.4,
                        transition: 'transform 0.12s, background 0.12s, box-shadow 0.12s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      }}
                      onMouseEnter={e => { if (unlocked) { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.background = 'rgba(91,141,239,0.12)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(91,141,239,0.2)' } }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = unlocked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)'; e.currentTarget.style.boxShadow = 'none' }}
                    >
                      <div style={{
                        color: unlocked ? '#5B8DEF' : 'rgba(255,255,255,0.3)',
                        fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold',
                      }}>
                        {unlocked ? lvlNum : '\uD83D\uDD12'}
                      </div>
                      <div style={{
                        color: unlocked ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
                        fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold',
                        textAlign: 'center', lineHeight: 1.3,
                      }}>
                        {lvl.name}
                      </div>
                      <div style={{
                        color: unlocked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
                        fontFamily: 'monospace', fontSize: 9,
                      }}>
                        {lvl.walls} walls · Spd {lvl.speed}
                      </div>
                      {unlocked && (lvl.drift || lvl.vDrift || lvl.dbl || lvl.rot || lvl.speedVar) && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', marginTop: 2 }}>
                          {lvl.drift && <span style={{ fontSize: 7, color: '#FF6B35', background: 'rgba(255,107,53,0.15)', borderRadius: 3, padding: '1px 4px' }}>DRIFT</span>}
                          {lvl.vDrift && <span style={{ fontSize: 7, color: '#FF6BC4', background: 'rgba(255,107,196,0.15)', borderRadius: 3, padding: '1px 4px' }}>V-DRIFT</span>}
                          {lvl.dbl && <span style={{ fontSize: 7, color: '#FFD700', background: 'rgba(255,215,0,0.15)', borderRadius: 3, padding: '1px 4px' }}>DOUBLE</span>}
                          {lvl.speedVar && <span style={{ fontSize: 7, color: '#00FFAA', background: 'rgba(0,255,170,0.15)', borderRadius: 3, padding: '1px 4px' }}>RUSH</span>}
                          {lvl.rot && <span style={{ fontSize: 7, color: '#4FC3F7', background: 'rgba(79,195,247,0.15)', borderRadius: 3, padding: '1px 4px' }}>SPIN</span>}
                        </div>
                      )}
                      {/* Stars */}
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[1, 2, 3].map(s => (
                          <span key={s} style={{
                            fontSize: 14,
                            filter: s <= stars ? 'none' : 'grayscale(1) opacity(0.25)',
                          }}>
                            {'\u2B50'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════ GAME OVER ═══════════════ */}
      {displayPhase === 'GAME_OVER' && (
        <div style={{ ...overlayStyle, animation: 'fadeInOverlay 0.3s ease-out' }}>
          <CollisionDiagram info={collisionInfo} />

          <h1 style={{ color: '#D32F2F', fontSize: 'clamp(24px,5vw,42px)', fontFamily: 'monospace', letterSpacing: 4, marginBottom: 12, textShadow: '0 2px 8px rgba(255,255,255,0.4)' }}>
            GAME OVER
          </h1>
          <p style={{ color: '#1A3A5C', fontFamily: 'monospace', fontSize: 'clamp(20px,5vw,28px)', marginBottom: 6, fontWeight: 'bold' }}>
            Score: {finalScore.toLocaleString()}
          </p>
          <p style={{ color: '#4A6A8A', fontFamily: 'monospace', fontSize: 13, marginBottom: 6 }}>
            Level {finalLevel} — {LEVELS[Math.min(finalLevel - 1, LEVELS.length - 1)].name}
          </p>
          {highScore > 0 && (
            <p style={{ color: '#FF8C00', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', marginBottom: 16 }}>
              {finalScore >= highScore ? 'NEW BEST!' : `Best: ${highScore.toLocaleString()}`}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginTop: 4, pointerEvents: 'auto', width: '80%', maxWidth: 280 }}>
            {canContinue && (
              <MenuButton primary onClick={startAdThenContinue}>
                {'\u25B6'} CONTINUE (WATCH AD)
              </MenuButton>
            )}
            <MenuButton primary={!canContinue} onClick={() => startGame(finalLevel)}>
              RETRY LEVEL {finalLevel}
            </MenuButton>
            <MenuButton onClick={goToMenu}>
              MAIN MENU
            </MenuButton>
          </div>
          <style>{`
            @keyframes streakPulse { 0% { transform: scale(1.3) } 100% { transform: scale(1) } }
            @keyframes nearMissFade { 0% { opacity:1; transform: translate(-50%,-50%) scale(1.2) } 100% { opacity:0; transform: translate(-50%,-80%) scale(0.8) } }
            @keyframes milestonePop { 0% { opacity:0; transform: translate(-50%,-50%) scale(0.5) } 15% { opacity:1; transform: translate(-50%,-50%) scale(1.1) } 30% { transform: translate(-50%,-50%) scale(1) } 80% { opacity:1 } 100% { opacity:0; transform: translate(-50%,-60%) scale(0.9) } }
            @keyframes fitPopFloat { 0% { opacity:1; transform: translate(-50%,-50%) scale(1.2) } 20% { transform: translate(-50%,-50%) scale(1) } 70% { opacity:1 } 100% { opacity:0; transform: translate(-50%,-90%) scale(0.85) } }
            @keyframes comboBreakFade { 0% { opacity:1; transform: translate(-50%,-50%) scale(1.3) } 20% { transform: translate(-50%,-50%) scale(1) } 70% { opacity:1 } 100% { opacity:0; transform: translate(-50%,-70%) scale(0.9) } }
            @keyframes fadeInOverlay { 0% { opacity:0; transform: scale(0.95) } 100% { opacity:1; transform: scale(1) } }
          `}</style>
        </div>
      )}

      {/* ═══════════════ AD OVERLAY ═══════════════ */}
      {/* ═══════════════ STATS ═══════════════ */}
      {displayPhase === 'STATS' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(200,230,245,0.95)',
          animation: 'fadeInOverlay 0.3s ease-out',
          pointerEvents: 'auto',
        }}>
          <h1 style={{ color: '#1A3A5C', fontFamily: 'monospace', fontSize: 28, fontWeight: 'bold', letterSpacing: 4, marginBottom: 24 }}>
            STATISTICS
          </h1>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            maxWidth: 300, width: '90%',
          }}>
            {[
              ['Games Played', stats.totalGames],
              ['Walls Cleared', stats.totalWalls],
              ['Total Score', stats.totalScore.toLocaleString()],
              ['Best Streak', stats.bestStreak],
              ['Levels Done', stats.levelsCompleted],
              ['Time Played', `${Math.floor(stats.timePlayed / 60)}m ${stats.timePlayed % 60}s`],
            ].map(([label, value]) => (
              <div key={label} style={{
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(91,141,239,0.15)',
                textAlign: 'center',
              }}>
                <div style={{ color: '#1A3A5C', fontFamily: 'monospace', fontSize: 18, fontWeight: 'bold' }}>{value}</div>
                <div style={{ color: '#7A9AB8', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginTop: 4 }}>{label.toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <MenuButton primary onClick={() => setDisplayPhase('MENU')}>
              BACK
            </MenuButton>
          </div>
        </div>
      )}

      {showingAd && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.92)',
        }}>
          {adCountdown > 0 ? (
            <>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                border: '4px solid #4FC3F7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <span style={{ color: '#4FC3F7', fontFamily: 'monospace', fontSize: 36, fontWeight: 'bold' }}>
                  {adCountdown}
                </span>
              </div>
              <p style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 14, letterSpacing: 2 }}>
                Get ready...
              </p>
            </>
          ) : (
            <>
              <p style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 14, letterSpacing: 2, marginBottom: 24 }}>
                Loading ad...
              </p>
              <div
                onClick={() => setShowingAd(false)}
                style={{
                  padding: '10px 24px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#888', fontFamily: 'monospace', fontSize: 12, letterSpacing: 1,
                  pointerEvents: 'auto',
                }}
              >
                CANCEL
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const overlayStyle = {
  position:       'fixed',
  inset:          0,
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  background:     'rgba(200,230,245,0.88)',
  zIndex:         20,
  pointerEvents:  'none',
}
