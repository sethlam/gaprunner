'use client'

import dynamic from 'next/dynamic'
import { useRef, useState, useEffect, useCallback } from 'react'
import { SHAPES, BASE_SPEED, LEVELS, getTheme } from './GameCanvas'
import SoundManager from './SoundManager'

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false })
const MenuCanvas = dynamic(() => import('./MenuCanvas'), { ssr: false })

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
        padding: primary ? '16px 48px' : '12px 36px',
        background: disabled
          ? 'rgba(150,150,150,0.3)'
          : primary
            ? 'linear-gradient(135deg, #5B8DEF 0%, #4FC3F7 100%)'
            : 'rgba(255,255,255,0.85)',
        color: disabled ? '#999' : primary ? 'white' : '#1A3A5C',
        fontFamily: 'monospace',
        fontSize: primary ? 18 : 15,
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
      gap: 0, padding: '0 8px', width: '96vw', maxWidth: 620,
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
              fontSize: `clamp(${l.size * 0.45}px, ${l.size / 12}vw, ${l.size}px)`,
              color: l.color,
              textShadow: `
                0 3px 0 rgba(0,0,0,0.15),
                0 6px 12px rgba(0,0,0,0.1),
                0 0 24px ${l.color}66
              `,
              WebkitTextStroke: '4px rgba(255,255,255,0.6)',
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

  const SIZE = 220
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
  const PREVIEW = 68
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed', [side]: '3%', top: '60%', transform: 'translateY(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,0.85)', border: `1px solid ${shape.color}66`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
      }}
    >
      <div style={{ width: PREVIEW, height: PREVIEW, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: shape.wFrac * PREVIEW, height: shape.hFrac * PREVIEW,
          background: shape.color, borderRadius: 3, border: `1.5px solid ${shape.color}`,
          boxShadow: `0 0 10px ${shape.color}88`, opacity: 0.82,
        }} />
      </div>
      <span style={{ color: 'rgba(0,0,0,0.45)', fontFamily: 'monospace', fontSize: 11 }}>{label}</span>
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

  // Load saved data
  useEffect(() => {
    try {
      const best = localStorage.getItem('gaprunner_best')
      if (best) setHighScore(parseInt(best, 10) || 0)
      const lvl = localStorage.getItem('gaprunner_level')
      if (lvl) setSavedLevel(Math.max(1, parseInt(lvl, 10) || 1))
      const stars = localStorage.getItem('gaprunner_stars')
      if (stars) setLevelStars(JSON.parse(stars))
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

  // ── Start game from a specific level ───────────────────────────────────────
  const startGame = useCallback((fromLevel = 1) => {
    const fresh = initGame(fromLevel)
    fresh.gamePhase = 'PLAYING'
    gameRef.current = fresh
    playerVisibleRef.current = true
    particleBurstsRef.current = []
    deathRef.current = null
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
  }, [])

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

    if (soundRef.current) {
      soundRef.current.playDeath()
      soundRef.current.stopMusic()
    }
  }, [saveLevelProgress])

  // ── Game events ────────────────────────────────────────────────────────────
  const handleEvent = useCallback((event) => {
    const sm = soundRef.current

    switch (event.type) {
      case 'PASS':
        if (sm) sm.playPass()
        if (event.nearMiss) {
          if (sm) sm.playNearMiss()
          setNearMissFlash(true)
          triggerShake(0.25, 0.15)
          triggerFreeze(60)
          setTimeout(() => setNearMissFlash(false), 600)
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
        break

      case 'DEATH':
        triggerShake(0.6, 0.4)
        triggerFreeze(100)
        break
    }
  }, [saveLevelProgress, saveStars, triggerShake, triggerFreeze])

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
        else if (displayPhaseRef.current === 'LEVEL_SELECT') setDisplayPhase('MENU')
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
            position: 'fixed', top: 16, left: 20, zIndex: 10,
            color: '#1A3A5C', fontFamily: 'monospace', fontWeight: 'bold',
            textShadow: '0 1px 3px rgba(255,255,255,0.6)', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              Score: {score.toLocaleString()}
              {multiplier > 1 && (
                <span style={{
                  fontSize: 14, color: multiplier >= 4 ? '#FF1744' : multiplier >= 3 ? '#FF9100' : '#FFD600',
                  background: 'rgba(0,0,0,0.1)', borderRadius: 6, padding: '2px 8px',
                  animation: 'streakPulse 0.3s ease-out',
                  fontWeight: 'bold',
                }}>
                  {multiplier}x
                </span>
              )}
            </div>
            {speedTier && <div style={{ fontSize: 13, color: '#D32F2F', marginTop: 2 }}>{speedTier}</div>}
          </div>

          <div style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            color: '#1A3A5C', fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'center',
            textShadow: '0 1px 3px rgba(255,255,255,0.6)', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 14 }}>LEVEL {level}</div>
            <div style={{ fontSize: 11, color: '#4A6A8A', marginTop: 2 }}>{levelName}</div>
            <div style={{ marginTop: 4, width: 100, height: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 2 }}>
              <div style={{
                width: `${Math.min(100, (gameRef.current.wallsCleared / lvlDef.walls) * 100)}%`,
                height: '100%', background: '#5B8DEF', borderRadius: 2, transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {streak >= 3 && (
            <div style={{
              position: 'fixed', top: 70, left: 20, zIndex: 10,
              color: '#FF8C00', fontFamily: 'monospace', fontSize: Math.min(16 + streak, 28), fontWeight: 'bold',
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

          {resizeTip && (
            <div style={{
              position: 'fixed', bottom: '14%', left: '50%', transform: 'translateX(-50%)', zIndex: 16,
              pointerEvents: 'none', background: 'rgba(0,0,0,0.75)', borderRadius: 14, padding: '14px 24px',
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
              position: 'fixed', top: 16, right: 64, zIndex: 25,
              width: 36, height: 36, borderRadius: 18,
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
          position: 'fixed', top: 16, right: 20, zIndex: 25,
          width: 36, height: 36, borderRadius: 18,
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
                  fontSize: 42,
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
              display: 'flex', gap: 24, marginBottom: 28, padding: '14px 28px',
              background: 'rgba(255,255,255,0.6)', borderRadius: 12,
              border: '1px solid rgba(91,141,239,0.15)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#1A3A5C', fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold' }}>
                  {score.toLocaleString()}
                </div>
                <div style={{ color: '#8A9AB0', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1 }}>
                  SCORE
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#FF8C00', fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold' }}>
                  {streak}
                </div>
                <div style={{ color: '#8A9AB0', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1 }}>
                  STREAK
                </div>
              </div>
            </div>

            {/* Next level preview */}
            <div style={{
              marginBottom: 24, padding: '12px 24px',
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
              position: 'relative', width: '100%', flex: '0 0 40%', minHeight: 200,
            }}>
              <MenuCanvas />
              {/* Gradient fade into content */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
                background: 'linear-gradient(to bottom, transparent, #B0E0F0)',
                pointerEvents: 'none',
              }} />
            </div>

            {/* Content — bottom section, anchored to top */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-start',
              background: 'linear-gradient(180deg, #B0E0F0 0%, #C8EAF5 50%, #D4F1F9 100%)',
              padding: '4px 28px 16px',
              overflow: 'auto',
            }}>
              {/* Bubbly game logo */}
              <div style={{ marginBottom: 6, marginTop: 4 }}>
                <GameLogo />
              </div>

              <p style={{
                color: '#4A6A8A', fontFamily: 'monospace', fontSize: 11,
                letterSpacing: 5, marginBottom: 18, textTransform: 'uppercase',
                fontWeight: 'bold',
              }}>
                Shape Shift · Dodge · Survive
              </p>

              {/* Stats row — compact horizontal chips */}
              {(highScore > 0 || savedLevel > 1 || totalStars > 0) && (
                <div style={{
                  display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center',
                }}>
                  {highScore > 0 && (
                    <div style={{
                      padding: '6px 12px', borderRadius: 16,
                      background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,140,0,0.3)',
                      display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      <span style={{ fontSize: 12 }}>{'\uD83C\uDFC6'}</span>
                      <span style={{ color: '#D48800', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' }}>
                        {highScore.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {savedLevel > 1 && (
                    <div style={{
                      padding: '6px 12px', borderRadius: 16,
                      background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(91,141,239,0.3)',
                      display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      <span style={{ fontSize: 12 }}>{'\uD83D\uDEA9'}</span>
                      <span style={{ color: '#3A6FD8', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' }}>
                        Lv.{savedLevel}
                      </span>
                    </div>
                  )}
                  {totalStars > 0 && (
                    <div style={{
                      padding: '6px 12px', borderRadius: 16,
                      background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(218,165,32,0.3)',
                      display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      <span style={{ fontSize: 12 }}>{'\u2B50'}</span>
                      <span style={{ color: '#C49B00', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' }}>
                        {totalStars}/{maxStars}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Buttons — full width with safe padding */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%', maxWidth: 320 }}>
                <div
                  onClick={() => startGame(1)}
                  style={{
                    width: '100%', padding: '15px 0', textAlign: 'center',
                    background: 'linear-gradient(135deg, #4FC3F7 0%, #5B8DEF 100%)',
                    color: 'white', fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold',
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
                      width: '100%', padding: '13px 0', textAlign: 'center',
                      background: 'rgba(255,255,255,0.85)',
                      color: '#1A3A5C', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
                      letterSpacing: 1, borderRadius: 12, cursor: 'pointer',
                      border: '1px solid rgba(91,141,239,0.2)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                      transition: 'transform 0.12s, background 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.background = 'rgba(255,255,255,1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.85)' }}
                  >
                    CONTINUE — Level {savedLevel}: {savedLvlDef.name}
                  </div>
                )}

                <div
                  onClick={() => setDisplayPhase('LEVEL_SELECT')}
                  style={{
                    width: '100%', padding: '13px 0', textAlign: 'center',
                    background: 'rgba(255,255,255,0.85)',
                    color: '#1A3A5C', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
                    letterSpacing: 1, borderRadius: 12, cursor: 'pointer',
                    border: '1px solid rgba(91,141,239,0.2)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                    transition: 'transform 0.12s, background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.background = 'rgba(255,255,255,1)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.85)' }}
                >
                  SELECT LEVEL
                </div>
              </div>

              {/* Controls hint — bottom */}
              <p style={{
                color: 'rgba(0,0,0,0.25)', fontFamily: 'monospace', fontSize: 10, marginTop: 16,
                letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.7,
              }}>
                Drag to move · Scroll / pinch to resize<br />
                A / D or ◀ ▶ to change shape
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
        <div style={overlayStyle}>
          <CollisionDiagram info={collisionInfo} />

          <h1 style={{ color: '#D32F2F', fontSize: 'clamp(28px,6vw,52px)', fontFamily: 'monospace', letterSpacing: 4, marginBottom: 16, textShadow: '0 2px 8px rgba(255,255,255,0.4)' }}>
            GAME OVER
          </h1>
          <p style={{ color: '#1A3A5C', fontFamily: 'monospace', fontSize: 28, marginBottom: 8, fontWeight: 'bold' }}>
            Score: {finalScore.toLocaleString()}
          </p>
          <p style={{ color: '#4A6A8A', fontFamily: 'monospace', fontSize: 14, marginBottom: 8 }}>
            Level {finalLevel} — {LEVELS[Math.min(finalLevel - 1, LEVELS.length - 1)].name}
          </p>
          {highScore > 0 && (
            <p style={{ color: '#FF8C00', fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold', marginBottom: 20 }}>
              {finalScore >= highScore ? 'NEW BEST!' : `Best: ${highScore.toLocaleString()}`}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', marginTop: 8, pointerEvents: 'auto' }}>
            <MenuButton primary onClick={() => startGame(finalLevel)}>
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
          `}</style>
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
