'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SHAPES, CW, CH } from './GameCanvas'

// ── Animated spotlight disc under each character ─────────────────────────────

function SpotlightDisc({ posX, color }) {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    ref.current.material.opacity = 0.15 + Math.sin(t * 2) * 0.05
    ref.current.scale.setScalar(1 + Math.sin(t * 3) * 0.08)
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[posX, -2.19, 0]}>
      <circleGeometry args={[0.8, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── Floating sparkle particles ───────────────────────────────────────────────

function Sparkles() {
  const COUNT = 40
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const data = useMemo(() => {
    const arr = []
    for (let i = 0; i < COUNT; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 8,
        y: Math.random() * 4 - 1,
        z: (Math.random() - 0.5) * 4,
        speed: 0.3 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        size: 0.02 + Math.random() * 0.03,
      })
    }
    return arr
  }, [])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    for (let i = 0; i < COUNT; i++) {
      const d = data[i]
      const y = d.y + Math.sin(t * d.speed + d.phase) * 0.5
      const alpha = (Math.sin(t * d.speed * 2 + d.phase) + 1) * 0.5
      dummy.position.set(d.x, y, d.z)
      dummy.scale.setScalar(d.size * (0.5 + alpha * 0.5))
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#FFFFFF" transparent opacity={0.6} />
    </instancedMesh>
  )
}

// ── Dancing character ────────────────────────────────────────────────────────

function DancingChar({ shapeIndex, posX }) {
  const shape = SHAPES[shapeIndex]

  const groupRef    = useRef()
  const bodyRef     = useRef()
  const faceRef     = useRef()
  const lArmRef     = useRef()
  const rArmRef     = useRef()
  const lLegRef     = useRef()
  const rLegRef     = useRef()
  const lForearmRef = useRef()
  const rForearmRef = useRef()
  const lShinRef    = useRef()
  const rShinRef    = useRef()

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: shape.color, emissive: shape.color,
    emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.25,
  }), [shape.color])

  const limbMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#3A3A3A', roughness: 0.7,
  }), [])

  const jointMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#555555', roughness: 0.6,
  }), [])

  const mouthGeoL = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.01, 0, 0),
      new THREE.Vector3(-0.06, -0.06, 0),
      new THREE.Vector3(-0.12, 0.01, 0)
    )
    return new THREE.TubeGeometry(curve, 12, 0.016, 6, false)
  }, [])
  const mouthGeoR = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.01, 0, 0),
      new THREE.Vector3(0.06, -0.06, 0),
      new THREE.Vector3(0.12, 0.01, 0)
    )
    return new THREE.TubeGeometry(curve, 12, 0.016, 6, false)
  }, [])

  const BODY_D  = 0.4
  const LIMB_T  = 0.05
  const UPPER_A = 0.20
  const LOWER_A = 0.20
  const UPPER_L = 0.22
  const LOWER_L = 0.22
  const JOINT_R = 0.04
  const HAND_R  = 0.055
  const FOOT_R  = 0.06

  const bW = shape.wFrac * CW
  const bH = shape.hFrac * CH

  const phaseOffset = useMemo(() => shapeIndex * 0.7, [shapeIndex])

  useFrame((state) => {
    if (!groupRef.current) return

    const t = state.clock.getElapsedTime() + phaseOffset
    const bpm = 2.0

    const phase = t * bpm * Math.PI * 2
    const sinP = Math.sin(phase)
    const cosP = Math.cos(phase)
    const sin2 = Math.sin(phase * 2)

    const bounce = Math.abs(Math.sin(phase)) * 0.15
    groupRef.current.position.y = bounce

    groupRef.current.position.x = posX + sinP * 0.12
    groupRef.current.rotation.z = sinP * 0.08
    groupRef.current.rotation.y = sinP * 0.15

    bodyRef.current.rotation.y = sinP * 0.2
    bodyRef.current.rotation.z = sinP * 0.06

    const lHip = sinP * 0.3 + Math.max(0, sinP) * 0.4
    const rHip = -sinP * 0.3 + Math.max(0, -sinP) * 0.4
    lLegRef.current.rotation.x = lHip
    rLegRef.current.rotation.x = rHip

    lShinRef.current.rotation.x = Math.max(0, sinP) * 1.2 + 0.05
    rShinRef.current.rotation.x = Math.max(0, -sinP) * 1.2 + 0.05

    lLegRef.current.rotation.z = 0.05 + sinP * 0.04
    rLegRef.current.rotation.z = -0.05 + sinP * 0.04

    lArmRef.current.rotation.z = 0.3 + sinP * 0.8
    lArmRef.current.rotation.x = sin2 * 0.4 - 0.3
    rArmRef.current.rotation.z = -0.3 - sinP * 0.8
    rArmRef.current.rotation.x = -sin2 * 0.4 - 0.3

    lForearmRef.current.rotation.x = -0.8 - Math.abs(cosP) * 0.6
    rForearmRef.current.rotation.x = -0.8 - Math.abs(cosP) * 0.6

    const fScale = Math.min(bW, bH) * 0.85
    faceRef.current.scale.setScalar(fScale)
  })

  const legSpread = Math.min(bW * 0.22, 0.3)

  return (
    <group ref={groupRef} position={[posX, 0, 0]}>
      <mesh ref={bodyRef} material={bodyMat} scale={[bW, bH, BODY_D]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>

      <group ref={faceRef} position={[0, 0, BODY_D / 2 + 0.01]}>
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

      <group ref={lArmRef} position={[-bW / 2 - LIMB_T, 0, 0]}>
        <mesh position={[0, -UPPER_A / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, UPPER_A, LIMB_T]} /></mesh>
        <mesh position={[0, -UPPER_A, 0]} material={jointMat}><sphereGeometry args={[JOINT_R, 8, 8]} /></mesh>
        <group ref={lForearmRef} position={[0, -UPPER_A, 0]}>
          <mesh position={[0, -LOWER_A / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, LOWER_A, LIMB_T]} /></mesh>
          <mesh position={[0, -LOWER_A, 0]} material={limbMat}><sphereGeometry args={[HAND_R, 8, 8]} /></mesh>
        </group>
      </group>

      <group ref={rArmRef} position={[bW / 2 + LIMB_T, 0, 0]}>
        <mesh position={[0, -UPPER_A / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, UPPER_A, LIMB_T]} /></mesh>
        <mesh position={[0, -UPPER_A, 0]} material={jointMat}><sphereGeometry args={[JOINT_R, 8, 8]} /></mesh>
        <group ref={rForearmRef} position={[0, -UPPER_A, 0]}>
          <mesh position={[0, -LOWER_A / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, LOWER_A, LIMB_T]} /></mesh>
          <mesh position={[0, -LOWER_A, 0]} material={limbMat}><sphereGeometry args={[HAND_R, 8, 8]} /></mesh>
        </group>
      </group>

      <group ref={lLegRef} position={[-legSpread, -bH / 2, 0]}>
        <mesh position={[0, -UPPER_L / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, UPPER_L, LIMB_T]} /></mesh>
        <mesh position={[0, -UPPER_L, 0]} material={jointMat}><sphereGeometry args={[JOINT_R, 8, 8]} /></mesh>
        <group ref={lShinRef} position={[0, -UPPER_L, 0]}>
          <mesh position={[0, -LOWER_L / 2, 0]} material={limbMat}><boxGeometry args={[LIMB_T, LOWER_L, LIMB_T]} /></mesh>
          <mesh position={[0, -LOWER_L, 0]} material={limbMat}><sphereGeometry args={[FOOT_R, 8, 8]} /></mesh>
        </group>
      </group>

      <group ref={rLegRef} position={[legSpread, -bH / 2, 0]}>
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

// ── Animated colored lights ──────────────────────────────────────────────────

function DanceLights() {
  const l1 = useRef()
  const l2 = useRef()
  const l3 = useRef()

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (l1.current) {
      l1.current.position.x = -2.6 + Math.sin(t * 1.5) * 0.3
      l1.current.intensity = 3 + Math.sin(t * 3) * 1.5
    }
    if (l2.current) {
      l2.current.position.x = Math.sin(t * 1.2) * 0.3
      l2.current.intensity = 3 + Math.sin(t * 3.5 + 1) * 1.5
    }
    if (l3.current) {
      l3.current.position.x = 2.6 + Math.sin(t * 1.8) * 0.3
      l3.current.intensity = 3 + Math.sin(t * 2.8 + 2) * 1.5
    }
  })

  return (
    <>
      <pointLight ref={l1} position={[-2.6, 2, 2]} intensity={3} distance={8} color={SHAPES[0].color} />
      <pointLight ref={l2} position={[0, 2, 2]} intensity={3} distance={8} color={SHAPES[1].color} />
      <pointLight ref={l3} position={[2.6, 2, 2]} intensity={3} distance={8} color={SHAPES[2].color} />
    </>
  )
}

// ── Turntable ────────────────────────────────────────────────────────────────

function Turntable({ children }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.25) * 0.12
    }
  })
  return <group ref={ref}>{children}</group>
}

// ── Reflective ground ────────────────────────────────────────────────────────

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]}>
      <planeGeometry args={[14, 8]} />
      <meshStandardMaterial
        color="#243B60"
        roughness={0.15}
        metalness={0.8}
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}

// ── Menu canvas export ───────────────────────────────────────────────────────

export default function MenuCanvas() {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      camera={{ position: [0, 0.6, 6], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#87CEEB', 10, 20]} />

      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 8, 5]} intensity={1.4} color="#FFFFFF" />
      <hemisphereLight args={['#87CEEB', '#E8F5E9', 0.6]} />

      <DanceLights />

      <Turntable>
        <DancingChar shapeIndex={0} posX={-2.6} />
        <DancingChar shapeIndex={1} posX={0}    />
        <DancingChar shapeIndex={2} posX={2.6}  />
      </Turntable>

      <Sparkles />
    </Canvas>
  )
}
