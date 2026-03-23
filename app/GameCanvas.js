'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ── Shared constants ──────────────────────────────────────────────────────────

export const SHAPES = [
  { name: 'Tall & Thin',  wFrac: 0.18, hFrac: 0.72, color: '#4FC3F7' },
  { name: 'Short & Wide', wFrac: 0.62, hFrac: 0.30, color: '#81C784' },
  { name: 'Small Square', wFrac: 0.28, hFrac: 0.28, color: '#FFB74D' },
]

export const CW         = 6
export const CH         = 4
const WALL_T            = 0.4
const SPAWN_Z           = -55
const REMOVE_Z          = 3
const COLLISION_Z       = -0.8
const PASS_Z            = 0.5
export const BASE_SPEED = 18
const TUNNEL_NEAR_Z     = 18
const TUNNEL_LEN        = TUNNEL_NEAR_Z - SPAWN_Z + 5
const TUNNEL_CENTER_Z   = (TUNNEL_NEAR_Z + SPAWN_Z) / 2

// ── 30-Level definitions ──────────────────────────────────────────────────────
// vDrift = vertical gap oscillation, speedVar = per-wall speed variation

export const LEVELS = [
  { name: 'First Steps',      walls: 3,  shapes: [0],     speed: 14, spacing: 32, gapPad: 1.50, tol: 0.20 },
  { name: 'Getting Started',  walls: 4,  shapes: [0],     speed: 15, spacing: 30, gapPad: 1.45, tol: 0.18 },
  { name: 'New Shape',        walls: 4,  shapes: [0,1],   speed: 15, spacing: 30, gapPad: 1.45, tol: 0.18 },
  { name: 'Two Shapes',       walls: 5,  shapes: [0,1],   speed: 16, spacing: 28, gapPad: 1.40, tol: 0.16 },
  { name: 'The Square',       walls: 5,  shapes: [0,1,2], speed: 16, spacing: 28, gapPad: 1.40, tol: 0.16 },
  { name: 'Mix It Up',        walls: 6,  shapes: [0,1,2], speed: 17, spacing: 27, gapPad: 1.38, tol: 0.16 },
  { name: 'Picking Up Speed', walls: 6,  shapes: [0,1,2], speed: 19, spacing: 26, gapPad: 1.35, tol: 0.15 },
  { name: 'Tighter Gaps',     walls: 7,  shapes: [0,1,2], speed: 19, spacing: 26, gapPad: 1.30, tol: 0.15 },
  { name: 'Move It',          walls: 7,  shapes: [0,1,2], speed: 20, spacing: 25, gapPad: 1.30, tol: 0.14 },
  { name: 'Double Digits',    walls: 8,  shapes: [0,1,2], speed: 21, spacing: 25, gapPad: 1.28, tol: 0.14, drift: 0.4 },
  { name: 'Zoom',             walls: 8,  shapes: [0,1,2], speed: 23, spacing: 24, gapPad: 1.25, tol: 0.14, drift: 0.5 },
  { name: 'Precision',        walls: 9,  shapes: [0,1,2], speed: 23, spacing: 24, gapPad: 1.22, tol: 0.12, drift: 0.5, vDrift: 0.3 },
  { name: 'Quick Switch',     walls: 9,  shapes: [0,1,2], speed: 24, spacing: 23, gapPad: 1.22, tol: 0.12, drift: 0.6, vDrift: 0.3 },
  { name: 'No Rest',          walls: 10, shapes: [0,1,2], speed: 25, spacing: 22, gapPad: 1.20, tol: 0.12, drift: 0.6, vDrift: 0.4, dbl: true },
  { name: 'Halfway',          walls: 10, shapes: [0,1,2], speed: 26, spacing: 22, gapPad: 1.20, tol: 0.11, drift: 0.7, vDrift: 0.4, dbl: true },
  { name: 'Size Matters',     walls: 10, shapes: [0,1,2], speed: 27, spacing: 21, gapPad: 1.18, tol: 0.11, drift: 0.7, vDrift: 0.5, dbl: true, speedVar: 0.15 },
  { name: 'Hustle',           walls: 11, shapes: [0,1,2], speed: 28, spacing: 21, gapPad: 1.18, tol: 0.10, drift: 0.8, vDrift: 0.5, dbl: true, speedVar: 0.15 },
  { name: 'Razor Thin',       walls: 11, shapes: [0,1,2], speed: 29, spacing: 20, gapPad: 1.15, tol: 0.10, drift: 0.8, vDrift: 0.6, dbl: true, rot: true, speedVar: 0.2 },
  { name: 'Gauntlet',         walls: 12, shapes: [0,1,2], speed: 30, spacing: 20, gapPad: 1.15, tol: 0.09, drift: 0.9, vDrift: 0.6, dbl: true, rot: true, speedVar: 0.2 },
  { name: 'Veteran',          walls: 12, shapes: [0,1,2], speed: 32, spacing: 19, gapPad: 1.12, tol: 0.09, drift: 0.9, vDrift: 0.7, dbl: true, rot: true, speedVar: 0.25 },
  { name: 'Blitz',            walls: 13, shapes: [0,1,2], speed: 33, spacing: 19, gapPad: 1.12, tol: 0.08, drift: 1.0, vDrift: 0.7, dbl: true, rot: true, speedVar: 0.25 },
  { name: 'Needle Thread',    walls: 13, shapes: [0,1,2], speed: 34, spacing: 18, gapPad: 1.10, tol: 0.08, drift: 1.0, vDrift: 0.8, dbl: true, rot: true, speedVar: 0.3 },
  { name: 'Overdrive',        walls: 14, shapes: [0,1,2], speed: 36, spacing: 18, gapPad: 1.10, tol: 0.07, drift: 1.1, vDrift: 0.8, dbl: true, rot: true, speedVar: 0.3 },
  { name: 'Chaos',            walls: 14, shapes: [0,1,2], speed: 38, spacing: 17, gapPad: 1.08, tol: 0.07, drift: 1.1, vDrift: 0.9, dbl: true, rot: true, speedVar: 0.35 },
  { name: 'Insanity',         walls: 15, shapes: [0,1,2], speed: 40, spacing: 17, gapPad: 1.08, tol: 0.06, drift: 1.2, vDrift: 0.9, dbl: true, rot: true, speedVar: 0.35 },
  { name: 'Pixel Perfect',    walls: 15, shapes: [0,1,2], speed: 42, spacing: 16, gapPad: 1.05, tol: 0.06, drift: 1.2, vDrift: 1.0, dbl: true, rot: true, speedVar: 0.4 },
  { name: 'Impossible?',      walls: 16, shapes: [0,1,2], speed: 44, spacing: 16, gapPad: 1.05, tol: 0.05, drift: 1.3, vDrift: 1.0, dbl: true, rot: true, speedVar: 0.4 },
  { name: 'Beyond',           walls: 16, shapes: [0,1,2], speed: 46, spacing: 15, gapPad: 1.03, tol: 0.05, drift: 1.3, vDrift: 1.1, dbl: true, rot: true, speedVar: 0.4 },
  { name: 'Final Form',       walls: 18, shapes: [0,1,2], speed: 48, spacing: 15, gapPad: 1.02, tol: 0.04, drift: 1.4, vDrift: 1.1, dbl: true, rot: true, speedVar: 0.4 },
  { name: 'GapRunner Master', walls: 20, shapes: [0,1,2], speed: 50, spacing: 14, gapPad: 1.00, tol: 0.03, drift: 1.5, vDrift: 1.2, dbl: true, rot: true, speedVar: 0.5 },
]

function getLevelDef(level) {
  const idx = Math.min(level - 1, LEVELS.length - 1)
  return LEVELS[idx]
}

// ── Environment themes ───────────────────────────────────────────────────────

export function getTheme(level) {
  if (level <= 10) return { sky: '#87CEEB', floor: '#A8E6F0', grid: '#80CCD8', rail: '#5B8DEF' }
  if (level <= 20) return { sky: '#2C1654', floor: '#3D2066', grid: '#5B3A8C', rail: '#FF6B35' }
  return { sky: '#080C18', floor: '#0A1628', grid: '#162840', rail: '#00FFAA' }
}

// ── Collision ─────────────────────────────────────────────────────────────────

function checkCollision(wall, playerIdx, playerX, playerY, playerScale, levelDef) {
  const player = SHAPES[playerIdx]
  const gap    = SHAPES[wall.gapShapeIndex]
  const tol    = levelDef.tol
  const gapPad = levelDef.gapPad
  const scale  = playerScale || 1
  const dx     = wall.driftX || 0
  const dy     = wall.driftY || 0
  const pW = player.wFrac * CW * scale
  const pH = player.hFrac * CH * scale
  const gW = gap.wFrac * CW * gapPad
  const gH = gap.hFrac * CH * gapPad
  const gx = wall.gapOffsetX + dx
  const gy = wall.gapOffsetY + dy
  const fits = (
    playerX - pW / 2 >= gx - gW / 2 - tol &&
    playerX + pW / 2 <= gx + gW / 2 + tol &&
    playerY - pH / 2 >= gy - gH / 2 - tol &&
    playerY + pH / 2 <= gy + gH / 2 + tol
  )
  return !fits
}

function computeMargins(wall, playerIdx, playerX, playerY, playerScale, levelDef) {
  const player = SHAPES[playerIdx]
  const gap    = SHAPES[wall.gapShapeIndex]
  const gapPad = levelDef.gapPad
  const scale  = playerScale || 1
  const dx     = wall.driftX || 0
  const dy     = wall.driftY || 0
  const pW = player.wFrac * CW * scale
  const pH = player.hFrac * CH * scale
  const gW = gap.wFrac * CW * gapPad
  const gH = gap.hFrac * CH * gapPad
  const gx = wall.gapOffsetX + dx
  const gy = wall.gapOffsetY + dy
  return Math.min(
    (playerX - pW / 2) - (gx - gW / 2),
    (gx + gW / 2) - (playerX + pW / 2),
    (playerY - pH / 2) - (gy - gH / 2),
    (gy + gH / 2) - (playerY + pH / 2),
  )
}

// ── Camera ────────────────────────────────────────────────────────────────────

function CameraSetup() {
  const { camera } = useThree()
  useEffect(() => { camera.lookAt(0, 4, -20) }, [camera])
  return null
}

// ── Camera shake ─────────────────────────────────────────────────────────────

function CameraShake({ shakeRef }) {
  const { camera } = useThree()
  const basePos = useRef(null)

  useFrame((_, delta) => {
    if (!basePos.current) {
      basePos.current = { x: camera.position.x, y: camera.position.y }
    }
    const s = shakeRef.current
    if (s.elapsed < s.duration) {
      s.elapsed += delta
      const t = 1 - s.elapsed / s.duration
      const intensity = s.intensity * t * t
      camera.position.x = basePos.current.x + (Math.random() - 0.5) * intensity
      camera.position.y = basePos.current.y + (Math.random() - 0.5) * intensity
    } else {
      camera.position.x = basePos.current.x
      camera.position.y = basePos.current.y
    }
  })

  return null
}

// ── Scene theme updater ──────────────────────────────────────────────────────

function SceneTheme({ gameRef }) {
  const { scene } = useThree()
  const target = useRef(new THREE.Color())

  useFrame(() => {
    const theme = getTheme(gameRef.current.level)
    target.current.set(theme.sky)
    if (scene.background && scene.background.lerp) scene.background.lerp(target.current, 0.03)
    if (scene.fog && scene.fog.color && scene.fog.color.lerp) scene.fog.color.lerp(target.current, 0.03)
  })

  return null
}

// ── Open-air track (themed) ──────────────────────────────────────────────────

function TrackScene({ gameRef }) {
  const xLines = [-CW * 0.4, -CW * 0.2, 0, CW * 0.2, CW * 0.4]

  const crossZs = useMemo(() => {
    const zs = []
    for (let z = SPAWN_Z; z < REMOVE_Z; z += 4) zs.push(z)
    return zs
  }, [])

  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#A8E6F0', roughness: 0.55 }), [])
  const gridMat  = useMemo(() => new THREE.MeshBasicMaterial({ color: '#80CCD8' }), [])
  const railMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5B8DEF', emissive: '#5B8DEF', emissiveIntensity: 0.2 }), [])
  const edgeGeo  = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(CW, CH, 0.01)), [])
  const edgeRef  = useRef()

  const targets = useMemo(() => ({
    floor: new THREE.Color(), grid: new THREE.Color(), rail: new THREE.Color(),
  }), [])

  useFrame(() => {
    const theme = getTheme(gameRef.current.level)
    targets.floor.set(theme.floor); floorMat.color.lerp(targets.floor, 0.03)
    targets.grid.set(theme.grid);   gridMat.color.lerp(targets.grid, 0.03)
    targets.rail.set(theme.rail)
    railMat.color.lerp(targets.rail, 0.03)
    railMat.emissive.lerp(targets.rail, 0.03)
    if (edgeRef.current) edgeRef.current.color.lerp(targets.rail, 0.03)
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -CH / 2, TUNNEL_CENTER_Z]} material={floorMat}>
        <planeGeometry args={[CW, TUNNEL_LEN]} />
      </mesh>
      {xLines.map(x => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, -CH / 2 + 0.01, TUNNEL_CENTER_Z]} material={gridMat}>
          <planeGeometry args={[0.03, TUNNEL_LEN]} />
        </mesh>
      ))}
      {crossZs.map(z => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, -CH / 2 + 0.01, z]} material={gridMat}>
          <planeGeometry args={[CW, 0.03]} />
        </mesh>
      ))}
      <mesh position={[-CW / 2, -CH / 2 + 0.1, TUNNEL_CENTER_Z]} material={railMat}>
        <boxGeometry args={[0.1, 0.2, TUNNEL_LEN]} />
      </mesh>
      <mesh position={[CW / 2, -CH / 2 + 0.1, TUNNEL_CENTER_Z]} material={railMat}>
        <boxGeometry args={[0.1, 0.2, TUNNEL_LEN]} />
      </mesh>
      <lineSegments geometry={edgeGeo} position={[0, 0, 0.08]}>
        <lineBasicMaterial ref={edgeRef} color="#5B8DEF" transparent opacity={0.5} />
      </lineSegments>
    </group>
  )
}

// ── Wall mesh ─────────────────────────────────────────────────────────────────

function WallMesh({ wallId, gapShapeIndex, gapOffsetX, gapOffsetY, gapPad, gameRef }) {
  const groupRef = useRef()
  const shape    = SHAPES[gapShapeIndex]

  const gapW = shape.wFrac * CW * gapPad
  const gapH = shape.hFrac * CH * gapPad
  const ox = gapOffsetX, oy = gapOffsetY
  const OT = 0.07

  const gL = ox - gapW / 2,  gR = ox + gapW / 2
  const gB = oy - gapH / 2,  gT = oy + gapH / 2
  const wL = -CW / 2, wR = CW / 2, wB = -CH / 2, wT = CH / 2

  const topH   = wT - gT
  const botH   = gB - wB
  const leftW  = gL - wL
  const rightW = wR - gR

  useFrame((state) => {
    const wall = gameRef.current.walls.find(w => w.id === wallId)
    if (wall && groupRef.current) {
      groupRef.current.position.z = wall.z
      groupRef.current.position.x = wall.driftX || 0
      groupRef.current.position.y = wall.driftY || 0
      if (wall.rotSpeed) {
        groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * wall.rotSpeed) * 0.1
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, SPAWN_Z]}>
      {topH > 0.001 && (
        <mesh position={[0, (wT + gT) / 2, 0]}>
          <boxGeometry args={[CW, topH, WALL_T]} />
          <meshStandardMaterial color="#FF6B6B" roughness={0.45} metalness={0.15} />
        </mesh>
      )}
      {botH > 0.001 && (
        <mesh position={[0, (wB + gB) / 2, 0]}>
          <boxGeometry args={[CW, botH, WALL_T]} />
          <meshStandardMaterial color="#FF6B6B" roughness={0.45} metalness={0.15} />
        </mesh>
      )}
      {leftW > 0.001 && (
        <mesh position={[(wL + gL) / 2, oy, 0]}>
          <boxGeometry args={[leftW, gapH, WALL_T]} />
          <meshStandardMaterial color="#FF6B6B" roughness={0.45} metalness={0.15} />
        </mesh>
      )}
      {rightW > 0.001 && (
        <mesh position={[(wR + gR) / 2, oy, 0]}>
          <boxGeometry args={[rightW, gapH, WALL_T]} />
          <meshStandardMaterial color="#FF6B6B" roughness={0.45} metalness={0.15} />
        </mesh>
      )}
      <mesh position={[ox, gT + OT / 2, WALL_T / 2 + 0.02]}>
        <boxGeometry args={[gapW + OT * 2, OT, 0.04]} />
        <meshBasicMaterial color={shape.color} />
      </mesh>
      <mesh position={[ox, gB - OT / 2, WALL_T / 2 + 0.02]}>
        <boxGeometry args={[gapW + OT * 2, OT, 0.04]} />
        <meshBasicMaterial color={shape.color} />
      </mesh>
      <mesh position={[gL - OT / 2, oy, WALL_T / 2 + 0.02]}>
        <boxGeometry args={[OT, gapH, 0.04]} />
        <meshBasicMaterial color={shape.color} />
      </mesh>
      <mesh position={[gR + OT / 2, oy, WALL_T / 2 + 0.02]}>
        <boxGeometry args={[OT, gapH, 0.04]} />
        <meshBasicMaterial color={shape.color} />
      </mesh>
    </group>
  )
}

// ── Success particles (InstancedMesh pool) ──────────────────────────────────

const PARTICLE_COUNT = 120

function SuccessParticles({ gameRef, particleBurstsRef }) {
  const meshRef  = useRef()
  const particles = useRef([])
  const dummy     = useMemo(() => new THREE.Object3D(), [])
  const tmpColor  = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    const arr = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0 })
    }
    particles.current = arr
    if (meshRef.current) {
      meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(PARTICLE_COUNT * 3), 3
      )
      meshRef.current.instanceColor.setUsage(THREE.DynamicDrawUsage)
      // Hide all initially
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        dummy.position.set(0, -100, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      }
      meshRef.current.instanceMatrix.needsUpdate = true
    }
  }, [dummy])

  useFrame((_, delta) => {
    if (!meshRef.current || particles.current.length === 0) return
    const dt = Math.min(delta, 0.05)

    // Process burst requests
    const bursts = particleBurstsRef.current
    while (bursts.length > 0) {
      const burst = bursts.shift()
      let spawned = 0
      for (let i = 0; i < PARTICLE_COUNT && spawned < 30; i++) {
        const p = particles.current[i]
        if (p.active) continue
        p.active = true
        p.x = burst.x + (Math.random() - 0.5) * 0.3
        p.y = burst.y + (Math.random() - 0.5) * 0.3
        p.z = burst.z || 0
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 5
        p.vx = Math.cos(angle) * speed * (0.5 + Math.random())
        p.vy = Math.sin(angle) * speed * 0.6 + 2
        p.vz = (Math.random() - 0.5) * 3
        p.life = 0.8 + Math.random() * 0.4
        p.maxLife = p.life
        tmpColor.set(burst.color)
        meshRef.current.setColorAt(i, tmpColor)
        spawned++
      }
    }

    // Update particles
    let needsUpdate = false
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles.current[i]
      if (!p.active) continue
      needsUpdate = true
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        dummy.position.set(0, -100, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
        continue
      }
      p.vy -= 9.8 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      const t = p.life / p.maxLife
      dummy.position.set(p.x, p.y, p.z)
      dummy.scale.setScalar(0.08 * t)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    if (needsUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

// ── Speed trail ──────────────────────────────────────────────────────────────

function SpeedTrail({ gameRef }) {
  const refs = useRef([])
  const mats = useRef([])
  const targetCol = useRef(new THREE.Color())
  const COUNT = 5

  useFrame(() => {
    const s = gameRef.current
    if (s.gamePhase !== 'PLAYING') {
      mats.current.forEach(m => { if (m) m.opacity = 0 })
      return
    }
    const lvl = getLevelDef(s.level)
    const speedFrac = Math.max(0, (s.speed - 14) / (50 - 14))
    targetCol.current.set(SHAPES[s.shapeIndex].color)

    for (let i = 0; i < COUNT; i++) {
      const ref = refs.current[i]
      const mat = mats.current[i]
      if (!ref || !mat) continue
      const lag = 0.08 + i * 0.04
      ref.position.x += (s.playerX - ref.position.x) * (1 - lag)
      ref.position.y += (s.playerY - ref.position.y) * (1 - lag)
      ref.position.z = 0.3 + i * 0.5
      mat.color.lerp(targetCol.current, 0.15)
      mat.opacity = speedFrac * (0.25 - i * 0.04)
    }
  })

  return (
    <group>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={el => { refs.current[i] = el }}
          position={[0, 0, 0.3 + i * 0.5]}
        >
          <planeGeometry args={[0.8 + i * 0.15, 0.6 + i * 0.1]} />
          <meshBasicMaterial
            ref={el => { mats.current[i] = el }}
            color="#4FC3F7"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Death explosion ──────────────────────────────────────────────────────────

const FRAG_COUNT = 20

function DeathExplosion({ deathRef }) {
  const refs = useRef([])
  const mats = useRef([])
  const frags = useRef([])

  useEffect(() => {
    const arr = []
    for (let i = 0; i < FRAG_COUNT; i++) {
      arr.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0 })
    }
    frags.current = arr
  }, [])

  useFrame((_, delta) => {
    if (frags.current.length === 0) return
    const dt = Math.min(delta, 0.05)
    const death = deathRef.current

    // Trigger new explosion
    if (death && death.trigger) {
      death.trigger = false
      const col = new THREE.Color(death.color)
      for (let i = 0; i < FRAG_COUNT; i++) {
        const f = frags.current[i]
        f.active = true
        f.age = 0
        f.x = death.x + (Math.random() - 0.5) * death.w * 0.5
        f.y = death.y + (Math.random() - 0.5) * death.h * 0.5
        f.z = 0
        const angle = Math.random() * Math.PI * 2
        const spd = 2 + Math.random() * 6
        f.vx = Math.cos(angle) * spd
        f.vy = Math.sin(angle) * spd * 0.7 + 2
        f.vz = (Math.random() - 0.5) * 4
        if (mats.current[i]) {
          mats.current[i].color.copy(col)
          mats.current[i].opacity = 1
        }
      }
    }

    // Update fragments
    for (let i = 0; i < FRAG_COUNT; i++) {
      const f = frags.current[i]
      const ref = refs.current[i]
      const mat = mats.current[i]
      if (!ref) continue
      if (!f.active) { ref.visible = false; continue }
      f.age += dt
      if (f.age > 1.5) { f.active = false; ref.visible = false; continue }
      f.vy -= 9.8 * dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.z += f.vz * dt
      ref.visible = true
      ref.position.set(f.x, f.y, f.z)
      ref.rotation.x += dt * 5
      ref.rotation.y += dt * 3
      const t = 1 - f.age / 1.5
      ref.scale.setScalar(0.08 + t * 0.08)
      if (mat) mat.opacity = t
    }
  })

  return (
    <group>
      {Array.from({ length: FRAG_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={el => { refs.current[i] = el }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            ref={el => { mats.current[i] = el }}
            color="white"
            transparent
            opacity={0}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Cartoon character ─────────────────────────────────────────────────────────

function PlayerMesh({ gameRef, playerVisibleRef }) {
  const groupRef      = useRef()
  const bodyRef       = useRef()
  const faceRef       = useRef()
  const lArmRef       = useRef()
  const rArmRef       = useRef()
  const lLegRef       = useRef()
  const rLegRef       = useRef()
  const lForearmRef   = useRef()
  const rForearmRef   = useRef()
  const lShinRef      = useRef()
  const rShinRef      = useRef()
  const targetCol     = useRef(new THREE.Color())

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FF8C00', emissive: '#FF8C00',
    emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.2,
  }), [])

  const limbMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#3A3A3A', roughness: 0.7,
  }), [])

  const jointMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#555555', roughness: 0.6,
  }), [])

  // Cat mouth left curve
  const mouthGeoL = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.01, 0, 0),
      new THREE.Vector3(-0.06, -0.06, 0),
      new THREE.Vector3(-0.12, 0.01, 0)
    )
    return new THREE.TubeGeometry(curve, 12, 0.016, 6, false)
  }, [])
  // Cat mouth right curve
  const mouthGeoR = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.01, 0, 0),
      new THREE.Vector3(0.06, -0.06, 0),
      new THREE.Vector3(0.12, 0.01, 0)
    )
    return new THREE.TubeGeometry(curve, 12, 0.016, 6, false)
  }, [])

  const BODY_D   = 0.4
  const LIMB_T   = 0.05
  const UPPER_A  = 0.20
  const LOWER_A  = 0.20
  const UPPER_L  = 0.22
  const LOWER_L  = 0.22
  const JOINT_R  = 0.04
  const HAND_R   = 0.055
  const FOOT_R   = 0.06

  useFrame((state) => {
    if (!groupRef.current || !bodyRef.current || !faceRef.current) return

    groupRef.current.visible = playerVisibleRef.current

    const s     = gameRef.current
    const shape = SHAPES[s.shapeIndex]
    const scale = s.playerScale || 1
    const tW    = shape.wFrac * CW * scale
    const tH    = shape.hFrac * CH * scale

    bodyRef.current.scale.x += (tW - bodyRef.current.scale.x) * 0.18
    bodyRef.current.scale.y += (tH - bodyRef.current.scale.y) * 0.18

    const bW = bodyRef.current.scale.x
    const bH = bodyRef.current.scale.y

    const fScale = Math.min(bW, bH) * 0.85
    faceRef.current.scale.setScalar(fScale)
    faceRef.current.position.z = -(BODY_D / 2 + 0.01)

    lArmRef.current.position.set(-bW / 2 - LIMB_T, 0, 0)
    rArmRef.current.position.set( bW / 2 + LIMB_T, 0, 0)

    const legSpread = Math.min(bW * 0.22, 0.3)
    lLegRef.current.position.set(-legSpread, -bH / 2, 0)
    rLegRef.current.position.set( legSpread, -bH / 2, 0)

    const time = state.clock.getElapsedTime()
    if (s.gamePhase === 'PLAYING') {
      const phase = time * 14
      const sinP  = Math.sin(phase)
      const cosP  = Math.cos(phase)

      groupRef.current.rotation.x = -0.45

      const hipBias = 0.25
      const lThighRaw =  sinP
      const rThighRaw = -sinP
      const lThigh = lThighRaw > 0 ? hipBias + lThighRaw * 1.4 : hipBias + lThighRaw * 0.9
      const rThigh = rThighRaw > 0 ? hipBias + rThighRaw * 1.4 : hipBias + rThighRaw * 0.9
      lLegRef.current.rotation.x = lThigh
      rLegRef.current.rotation.x = rThigh

      const lKnee = Math.max(0,  sinP) * 2.0 + 0.1
      const rKnee = Math.max(0, -sinP) * 2.0 + 0.1
      lShinRef.current.rotation.x = lKnee
      rShinRef.current.rotation.x = rKnee

      const armBias = 0.15
      const lShoulder = armBias + (-sinP > 0 ? -sinP * 1.2 : -sinP * 0.7)
      const rShoulder = armBias + ( sinP > 0 ?  sinP * 1.2 :  sinP * 0.7)
      lArmRef.current.rotation.x = lShoulder
      rArmRef.current.rotation.x = rShoulder

      const lElbow = Math.max(0, -sinP) * 1.3 + 0.9
      const rElbow = Math.max(0,  sinP) * 1.3 + 0.9
      lForearmRef.current.rotation.x = -lElbow
      rForearmRef.current.rotation.x = -rElbow

      lArmRef.current.rotation.z =  0.06
      rArmRef.current.rotation.z = -0.06

      const bounce = Math.pow(Math.abs(cosP), 0.6) * 0.12
      groupRef.current.position.y = s.playerY + bounce
      groupRef.current.position.x = s.playerX + sinP * 0.04

      bodyRef.current.rotation.z = sinP * 0.05
      bodyRef.current.rotation.x = 0
      bodyRef.current.rotation.y = sinP * 0.06
    } else {
      groupRef.current.rotation.x *= 0.9
      lLegRef.current.rotation.x  *= 0.9
      rLegRef.current.rotation.x  *= 0.9
      lShinRef.current.rotation.x *= 0.9
      rShinRef.current.rotation.x *= 0.9
      lArmRef.current.rotation.x  *= 0.9
      rArmRef.current.rotation.x  *= 0.9
      lForearmRef.current.rotation.x *= 0.9
      rForearmRef.current.rotation.x *= 0.9
      lArmRef.current.rotation.z  *= 0.9
      rArmRef.current.rotation.z  *= 0.9
      bodyRef.current.rotation.x  *= 0.9
      bodyRef.current.rotation.y  *= 0.9
      bodyRef.current.rotation.z  *= 0.9
      groupRef.current.position.x = s.playerX
      groupRef.current.position.y = s.playerY
    }

    targetCol.current.set(shape.color)
    bodyMat.color.lerp(targetCol.current, 0.18)
    bodyMat.emissive.lerp(targetCol.current, 0.18)
  })

  const init = SHAPES[0]
  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <mesh ref={bodyRef} material={bodyMat} scale={[init.wFrac * CW, init.hFrac * CH, BODY_D]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>

      <group ref={faceRef} position={[0, 0, -(BODY_D / 2 + 0.01)]} rotation={[0, Math.PI, 0]}>
        {/* Big glossy black bead eyes */}
        <mesh position={[-0.22, 0.08, 0.06]}><sphereGeometry args={[0.14, 16, 16]} /><meshStandardMaterial color="#111" roughness={0.1} metalness={0.3} /></mesh>
        <mesh position={[0.22, 0.08, 0.06]}><sphereGeometry args={[0.14, 16, 16]} /><meshStandardMaterial color="#111" roughness={0.1} metalness={0.3} /></mesh>
        {/* Large white highlights */}
        <mesh position={[-0.27, 0.14, 0.17]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color="white" /></mesh>
        <mesh position={[0.17, 0.14, 0.17]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color="white" /></mesh>
        {/* Small secondary highlights */}
        <mesh position={[-0.19, 0.03, 0.18]}><sphereGeometry args={[0.022, 6, 6]} /><meshBasicMaterial color="white" /></mesh>
        <mesh position={[0.25, 0.03, 0.18]}><sphereGeometry args={[0.022, 6, 6]} /><meshBasicMaterial color="white" /></mesh>
        {/* Cat mouth (W shape) */}
        <mesh position={[0, -0.1, 0.03]} geometry={mouthGeoL}><meshBasicMaterial color="#333" /></mesh>
        <mesh position={[0, -0.1, 0.03]} geometry={mouthGeoR}><meshBasicMaterial color="#333" /></mesh>
        {/* Rosy blush cheeks */}
        <mesh position={[-0.3, -0.06, 0.02]}><circleGeometry args={[0.08, 16]} /><meshBasicMaterial color="#FF6B8A" transparent opacity={0.4} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0.3, -0.06, 0.02]}><circleGeometry args={[0.08, 16]} /><meshBasicMaterial color="#FF6B8A" transparent opacity={0.4} side={THREE.DoubleSide} /></mesh>
      </group>

      <group ref={lArmRef} position={[-(init.wFrac * CW) / 2 - LIMB_T, 0, 0]}>
        <mesh position={[0, -UPPER_A / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, UPPER_A, LIMB_T]} /></mesh>
        <mesh position={[0, -UPPER_A, 0]} material={jointMat}><sphereGeometry args={[JOINT_R, 8, 8]} /></mesh>
        <group ref={lForearmRef} position={[0, -UPPER_A, 0]}>
          <mesh position={[0, -LOWER_A / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, LOWER_A, LIMB_T]} /></mesh>
          <mesh position={[0, -LOWER_A, 0]} material={limbMat}><sphereGeometry args={[HAND_R, 8, 8]} /></mesh>
        </group>
      </group>

      <group ref={rArmRef} position={[(init.wFrac * CW) / 2 + LIMB_T, 0, 0]}>
        <mesh position={[0, -UPPER_A / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, UPPER_A, LIMB_T]} /></mesh>
        <mesh position={[0, -UPPER_A, 0]} material={jointMat}><sphereGeometry args={[JOINT_R, 8, 8]} /></mesh>
        <group ref={rForearmRef} position={[0, -UPPER_A, 0]}>
          <mesh position={[0, -LOWER_A / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, LOWER_A, LIMB_T]} /></mesh>
          <mesh position={[0, -LOWER_A, 0]} material={limbMat}><sphereGeometry args={[HAND_R, 8, 8]} /></mesh>
        </group>
      </group>

      <group ref={lLegRef} position={[-0.2, -(init.hFrac * CH) / 2, 0]}>
        <mesh position={[0, -UPPER_L / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, UPPER_L, LIMB_T]} /></mesh>
        <mesh position={[0, -UPPER_L, 0]} material={jointMat}><sphereGeometry args={[JOINT_R, 8, 8]} /></mesh>
        <group ref={lShinRef} position={[0, -UPPER_L, 0]}>
          <mesh position={[0, -LOWER_L / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, LOWER_L, LIMB_T]} /></mesh>
          <mesh position={[0, -LOWER_L, 0]} material={limbMat}><sphereGeometry args={[FOOT_R, 8, 8]} /></mesh>
        </group>
      </group>

      <group ref={rLegRef} position={[0.2, -(init.hFrac * CH) / 2, 0]}>
        <mesh position={[0, -UPPER_L / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, UPPER_L, LIMB_T]} /></mesh>
        <mesh position={[0, -UPPER_L, 0]} material={jointMat}><sphereGeometry args={[JOINT_R, 8, 8]} /></mesh>
        <group ref={rShinRef} position={[0, -UPPER_L, 0]}>
          <mesh position={[0, -LOWER_L / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, LOWER_L, LIMB_T]} /></mesh>
          <mesh position={[0, -LOWER_L, 0]} material={limbMat}><sphereGeometry args={[FOOT_R, 8, 8]} /></mesh>
        </group>
      </group>
    </group>
  )
}

// ── Player glow light ─────────────────────────────────────────────────────────

function PlayerLight({ gameRef }) {
  const lightRef  = useRef()
  const targetCol = useRef(new THREE.Color())
  useFrame(() => {
    if (!lightRef.current) return
    const s = gameRef.current
    targetCol.current.set(SHAPES[s.shapeIndex].color)
    lightRef.current.color.lerp(targetCol.current, 0.12)
    lightRef.current.position.x += (s.playerX - lightRef.current.position.x) * 0.15
    lightRef.current.position.y += (s.playerY + 1 - lightRef.current.position.y) * 0.15
  })
  return (
    <pointLight ref={lightRef} position={[0, 1, 2]} intensity={3} distance={14} color={SHAPES[0].color} />
  )
}

// ── Drag handler ──────────────────────────────────────────────────────────────

function DragHandler({ gameRef, isDraggingRef, pointerNDCRef }) {
  const { camera }  = useThree()
  const raycaster    = useMemo(() => new THREE.Raycaster(), [])
  const plane        = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const intersection = useMemo(() => new THREE.Vector3(), [])
  const ndc          = useMemo(() => new THREE.Vector2(), [])

  useFrame(() => {
    const s = gameRef.current
    if (s.gamePhase !== 'PLAYING') return

    const shape    = SHAPES[s.shapeIndex]
    const maxScale = Math.min(1 / shape.wFrac, 1 / shape.hFrac) * 0.95
    s.playerScale  = Math.max(0.5, Math.min(maxScale, s.playerScale))

    const halfW = (shape.wFrac * CW * s.playerScale) / 2
    const halfH = (shape.hFrac * CH * s.playerScale) / 2

    if (isDraggingRef.current) {
      ndc.set(pointerNDCRef.current.x, pointerNDCRef.current.y)
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        s.playerX = intersection.x
        s.playerY = intersection.y
      }
    }

    s.playerX = Math.max(-CW / 2 + halfW, Math.min(CW / 2 - halfW, s.playerX))
    s.playerY = Math.max(-CH / 2 + halfH, Math.min(CH / 2 - halfH, s.playerY))
  })

  return null
}

// ── Game loop (level-driven) ──────────────────────────────────────────────────

function GameScene({ gameRef, setWallIds, setScore, dangerRef, onGameOver, onEvent, particleBurstsRef, deathRef, playerVisibleRef, timeScaleRef }) {
  useFrame((state, delta) => {
    const s = gameRef.current
    if (s.gamePhase !== 'PLAYING') return

    const tScale = timeScaleRef ? timeScaleRef.current.value : 1.0
    const dt   = Math.min(delta, 0.05) * tScale
    const lvl  = getLevelDef(s.level)

    // Apply level speed
    s.speed = lvl.speed

    // Update wall drift and movement
    const clock = state.clock.elapsedTime
    for (const w of s.walls) {
      if (w.driftAmp) {
        w.driftX = Math.sin(clock * w.driftSpeed + w.driftPhase) * w.driftAmp
      }
      if (w.vDriftAmp) {
        w.driftY = Math.sin(clock * w.vDriftSpeed + w.vDriftPhase) * w.vDriftAmp
      }
      w.z += s.speed * dt * (w.speedMult || 1)
    }

    const prevLen = s.walls.length
    s.walls = s.walls.filter(w => w.z < REMOVE_Z)
    if (s.walls.length !== prevLen) {
      setWallIds(s.walls.map(w => ({
        id: w.id, gapShapeIndex: w.gapShapeIndex,
        gapOffsetX: w.gapOffsetX, gapOffsetY: w.gapOffsetY, gapPad: lvl.gapPad,
      })))
    }

    const spacing   = lvl.spacing
    const furthestZ = s.walls.reduce((mn, w) => Math.min(mn, w.z), Infinity)
    if (s.walls.length === 0 || furthestZ > SPAWN_Z + spacing) {
      const spawnWall = (zOffset) => {
        const availShapes = lvl.shapes
        let gsi
        do { gsi = availShapes[Math.floor(Math.random() * availShapes.length)] }
        while (gsi === s.lastWallShapeIndex && availShapes.length > 1)
        s.lastWallShapeIndex = gsi

        const shape  = SHAPES[gsi]
        const gapPad = lvl.gapPad
        const gapW   = shape.wFrac * CW * gapPad
        const gapH   = shape.hFrac * CH * gapPad
        const maxOX  = (CW - gapW) / 2
        const maxOY  = (CH - gapH) / 2
        const gapOffsetX = (Math.random() * 2 - 1) * maxOX
        const gapOffsetY = (Math.random() * 2 - 1) * maxOY

        const id = ++s.wallIdSeq
        const wall = {
          id, z: SPAWN_Z + zOffset, gapShapeIndex: gsi,
          gapOffsetX, gapOffsetY,
          passed: false, collisionChecked: false,
          driftX: 0, driftAmp: 0, driftSpeed: 0, driftPhase: 0,
          driftY: 0, vDriftAmp: 0, vDriftSpeed: 0, vDriftPhase: 0,
          rotSpeed: 0, speedMult: 1,
        }

        // Drifting gaps
        if (lvl.drift) {
          wall.driftAmp = lvl.drift * 0.5
          wall.driftSpeed = 1.5 + Math.random() * 1.5
          wall.driftPhase = Math.random() * Math.PI * 2
        }

        // Vertical drift
        if (lvl.vDrift) {
          wall.vDriftAmp = lvl.vDrift * 0.4
          wall.vDriftSpeed = 1.2 + Math.random() * 1.2
          wall.vDriftPhase = Math.random() * Math.PI * 2
        }

        // Rotating walls (visual only)
        if (lvl.rot) {
          wall.rotSpeed = 1.0 + Math.random() * 2.0
        }

        // Speed variation per wall
        if (lvl.speedVar) {
          wall.speedMult = 1 + (Math.random() - 0.5) * 2 * lvl.speedVar
        }

        s.walls.push(wall)
        setWallIds(prev => [...prev, { id, gapShapeIndex: gsi, gapOffsetX, gapOffsetY, gapPad }])
      }

      spawnWall(0)

      // Double wall: spawn a second wall close behind (30% chance)
      if (lvl.dbl && Math.random() < 0.3) {
        spawnWall(-spacing * 0.35)
      }
    }

    // Danger vignette
    if (dangerRef.current) {
      const closestZ    = s.walls.filter(w => !w.collisionChecked).reduce((mx, w) => Math.max(mx, w.z), -Infinity)
      const dangerStart = -14
      const intensity   = closestZ > dangerStart
        ? Math.min(1, (closestZ - dangerStart) / Math.abs(dangerStart - COLLISION_Z))
        : 0
      dangerRef.current.style.opacity = String(intensity * 0.7)
    }

    for (const w of s.walls) {
      if (!w.collisionChecked && w.z >= COLLISION_Z) {
        w.collisionChecked = true
        if (checkCollision(w, s.shapeIndex, s.playerX, s.playerY, s.playerScale, lvl)) {
          s.gamePhase  = 'GAME_OVER'
          s.gameOverAt = Date.now()
          if (dangerRef.current) dangerRef.current.style.opacity = '0'

          // Death explosion
          playerVisibleRef.current = false
          const pShape = SHAPES[s.shapeIndex]
          const sc = s.playerScale || 1
          deathRef.current = {
            trigger: true,
            x: s.playerX, y: s.playerY,
            w: pShape.wFrac * CW * sc, h: pShape.hFrac * CH * sc,
            color: pShape.color,
          }

          const gShape = SHAPES[w.gapShapeIndex]
          onGameOver(s.score, {
            playerX: s.playerX, playerY: s.playerY,
            playerW: pShape.wFrac * CW * sc,
            playerH: pShape.hFrac * CH * sc,
            playerColor: pShape.color,
            gapX: w.gapOffsetX, gapY: w.gapOffsetY,
            gapW: gShape.wFrac * CW * lvl.gapPad,
            gapH: gShape.hFrac * CH * lvl.gapPad,
            gapColor: gShape.color,
            wallW: CW, wallH: CH,
          })
          onEvent({ type: 'DEATH' })
          return
        }
      }
      if (!w.passed && w.z >= PASS_Z) {
        w.passed = true
        s.streak++
        s.wallsCleared++

        // Combo multiplier
        const mult = s.streak < 5 ? 1 : s.streak < 10 ? 2 : s.streak < 20 ? 3 : 4
        s.levelMaxMult = Math.max(s.levelMaxMult || 0, mult)

        // Near-miss detection
        const margin = computeMargins(w, s.shapeIndex, s.playerX, s.playerY, s.playerScale, lvl)
        const nearMiss = margin < 0.3

        // Score based on fit precision: max 1000 at perfect fit, min ~200 when shrunk to 0.5
        const scale = s.playerScale || 1
        const gap = SHAPES[w.gapShapeIndex]
        const gapArea = gap.wFrac * CW * lvl.gapPad * gap.hFrac * CH * lvl.gapPad
        const player = SHAPES[s.shapeIndex]
        const playerArea = player.wFrac * CW * scale * player.hFrac * CH * scale
        const fitRatio = Math.min(playerArea / gapArea, 1) // 0..1, 1 = perfect fit
        s.levelFitSum = (s.levelFitSum || 0) + fitRatio
        s.levelFitCount = (s.levelFitCount || 0) + 1
        const basePoints = Math.round(200 + 800 * fitRatio) // 200..1000
        s.score += basePoints * mult
        setScore(s.score)

        // Success particles
        particleBurstsRef.current.push({
          x: (w.gapOffsetX + (w.driftX || 0)), y: w.gapOffsetY, z: PASS_Z,
          color: SHAPES[w.gapShapeIndex].color,
        })

        onEvent({ type: 'PASS', nearMiss, streak: s.streak, multiplier: mult, fitPercent: Math.round(fitRatio * 100), points: basePoints * mult, gapColor: SHAPES[w.gapShapeIndex].color })

        // Milestone check (threshold-based)
        const milestones = [
          [5000, 'NICE!'], [15000, 'AMAZING!'], [30000, 'INCREDIBLE!'], [50000, 'LEGENDARY!']
        ]
        const prevScore = s.score - basePoints * mult
        for (const [threshold, label] of milestones) {
          if (prevScore < threshold && s.score >= threshold) {
            onEvent({ type: 'MILESTONE', score: s.score, label })
            break
          }
        }

        // Level progression
        if (s.wallsCleared >= lvl.walls) {
          s.gamePhase = 'LEVEL_COMPLETE'
          const avgFit = s.levelFitCount > 0 ? s.levelFitSum / s.levelFitCount : 0
          const stars = avgFit >= 0.7 ? 3 : avgFit >= 0.5 ? 2 : 1
          onEvent({ type: 'LEVEL_COMPLETE', level: s.level, name: lvl.name, score: s.score, stars, avgFit: Math.round(avgFit * 100), maxMult: s.levelMaxMult || 1 })
        }
      }
    }
  })

  return null
}

// ── Canvas export ─────────────────────────────────────────────────────────────

export default function GameCanvas({
  gameRef, wallIds, setWallIds, setScore, dangerRef, onGameOver, onEvent,
  isDraggingRef, pointerNDCRef, particleBurstsRef, deathRef, playerVisibleRef,
  shakeRef, timeScaleRef,
}) {
  return (
    <Canvas
      style={{ position: 'fixed', inset: 0 }}
      camera={{ position: [0, 3, 13], fov: 70 }}
      onCreated={({ camera }) => camera.lookAt(0, 4, -20)}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#87CEEB', 35, 68]} />

      <CameraSetup />
      {shakeRef && <CameraShake shakeRef={shakeRef} />}
      <SceneTheme gameRef={gameRef} />

      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 12, 5]} intensity={1.3} color="#FFFFFF" />
      <hemisphereLight args={['#87CEEB', '#A8E6F0', 0.5]} />

      <TrackScene gameRef={gameRef} />
      <PlayerMesh gameRef={gameRef} playerVisibleRef={playerVisibleRef} />
      <PlayerLight gameRef={gameRef} />
      <SpeedTrail gameRef={gameRef} />
      <SuccessParticles gameRef={gameRef} particleBurstsRef={particleBurstsRef} />
      <DeathExplosion deathRef={deathRef} />

      <DragHandler
        gameRef={gameRef}
        isDraggingRef={isDraggingRef}
        pointerNDCRef={pointerNDCRef}
      />

      {wallIds.map(({ id, gapShapeIndex, gapOffsetX, gapOffsetY, gapPad }) => (
        <WallMesh
          key={id}
          wallId={id}
          gapShapeIndex={gapShapeIndex}
          gapOffsetX={gapOffsetX}
          gapOffsetY={gapOffsetY}
          gapPad={gapPad || 1.35}
          gameRef={gameRef}
        />
      ))}

      <GameScene
        gameRef={gameRef}
        setWallIds={setWallIds}
        setScore={setScore}
        dangerRef={dangerRef}
        onGameOver={onGameOver}
        onEvent={onEvent}
        particleBurstsRef={particleBurstsRef}
        deathRef={deathRef}
        playerVisibleRef={playerVisibleRef}
        timeScaleRef={timeScaleRef}
      />
    </Canvas>
  )
}
