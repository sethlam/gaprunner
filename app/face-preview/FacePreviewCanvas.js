'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Shared body ──────────────────────────────────────────────────────────────

const BODY_D = 0.5
const BODY_W = 1.0
const BODY_H = 1.0

// ── Face A: Kawaii Bead Eyes ─────────────────────────────────────────────────

function FaceA() {
  const groupRef = useRef()

  // Cat mouth: two small curves forming a "w" shape
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

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    // Gentle idle bounce
    groupRef.current.position.y = Math.sin(t * 2) * 0.03
  })

  return (
    <group ref={groupRef}>
      {/* Big glossy black bead eyes */}
      <mesh position={[-0.22, 0.08, BODY_D / 2 + 0.06]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.3} />
      </mesh>
      <mesh position={[0.22, 0.08, BODY_D / 2 + 0.06]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.3} />
      </mesh>

      {/* Large white highlight on each eye */}
      <mesh position={[-0.27, 0.14, BODY_D / 2 + 0.17]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0.17, 0.14, BODY_D / 2 + 0.17]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>
      {/* Small secondary highlight */}
      <mesh position={[-0.19, 0.03, BODY_D / 2 + 0.18]}>
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0.25, 0.03, BODY_D / 2 + 0.18]}>
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {/* Cat mouth (W shape) */}
      <mesh position={[0, -0.1, BODY_D / 2 + 0.03]} geometry={mouthGeoL}>
        <meshBasicMaterial color="#333" />
      </mesh>
      <mesh position={[0, -0.1, BODY_D / 2 + 0.03]} geometry={mouthGeoR}>
        <meshBasicMaterial color="#333" />
      </mesh>

      {/* Rosy blush cheeks */}
      <mesh position={[-0.3, -0.06, BODY_D / 2 + 0.02]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.08, 16]} />
        <meshBasicMaterial color="#FF6B8A" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.3, -0.06, BODY_D / 2 + 0.02]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.08, 16]} />
        <meshBasicMaterial color="#FF6B8A" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── Face B: Big Anime Eyes ───────────────────────────────────────────────────

function FaceB() {
  const groupRef = useRef()
  const lBrowRef = useRef()
  const rBrowRef = useRef()

  // Eyebrow arc
  const browGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.08, 0, 0),
      new THREE.Vector3(0, 0.03, 0),
      new THREE.Vector3(0.08, 0, 0)
    )
    return new THREE.TubeGeometry(curve, 10, 0.014, 6, false)
  }, [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.position.y = Math.sin(t * 2) * 0.03
    // Eyebrow bounce
    if (lBrowRef.current && rBrowRef.current) {
      const bounce = Math.sin(t * 3) * 0.015
      lBrowRef.current.position.y = 0.28 + bounce
      rBrowRef.current.position.y = 0.28 + bounce
    }
  })

  return (
    <group ref={groupRef}>
      {/* Large white sclera (tall ovals via scale) */}
      <mesh position={[-0.2, 0.08, BODY_D / 2 + 0.04]} scale={[1, 1.35, 0.85]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0.2, 0.08, BODY_D / 2 + 0.04]} scale={[1, 1.35, 0.85]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {/* Colored iris (matching character color — using blue here) */}
      <mesh position={[-0.2, 0.06, BODY_D / 2 + 0.14]}>
        <sphereGeometry args={[0.1, 14, 14]} />
        <meshStandardMaterial color="#4FC3F7" roughness={0.2} />
      </mesh>
      <mesh position={[0.2, 0.06, BODY_D / 2 + 0.14]}>
        <sphereGeometry args={[0.1, 14, 14]} />
        <meshStandardMaterial color="#4FC3F7" roughness={0.2} />
      </mesh>

      {/* Dark pupils */}
      <mesh position={[-0.2, 0.06, BODY_D / 2 + 0.21]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <mesh position={[0.2, 0.06, BODY_D / 2 + 0.21]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial color="#111" />
      </mesh>

      {/* Big highlight */}
      <mesh position={[-0.25, 0.13, BODY_D / 2 + 0.22]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0.15, 0.13, BODY_D / 2 + 0.22]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>
      {/* Small highlight */}
      <mesh position={[-0.16, 0.01, BODY_D / 2 + 0.23]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0.24, 0.01, BODY_D / 2 + 0.23]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {/* Tiny open mouth — surprised "o" */}
      <mesh position={[0, -0.12, BODY_D / 2 + 0.08]} scale={[1, 0.8, 0.5]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color="#222" />
      </mesh>
      {/* Pink tongue inside mouth */}
      <mesh position={[0, -0.14, BODY_D / 2 + 0.07]} scale={[0.8, 0.5, 0.3]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial color="#FF8A9E" />
      </mesh>

      {/* Blush */}
      <mesh position={[-0.32, -0.04, BODY_D / 2 + 0.02]}>
        <circleGeometry args={[0.06, 16]} />
        <meshBasicMaterial color="#FF6B8A" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.32, -0.04, BODY_D / 2 + 0.02]}>
        <circleGeometry args={[0.06, 16]} />
        <meshBasicMaterial color="#FF6B8A" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Eyebrows */}
      <mesh ref={lBrowRef} position={[-0.2, 0.28, BODY_D / 2 + 0.14]} geometry={browGeo}>
        <meshBasicMaterial color="#333" />
      </mesh>
      <mesh ref={rBrowRef} position={[0.2, 0.28, BODY_D / 2 + 0.14]} geometry={browGeo}>
        <meshBasicMaterial color="#333" />
      </mesh>
    </group>
  )
}

// ── Face C: Squishy Dot (recommended) ────────────────────────────────────────

function FaceC() {
  const groupRef = useRef()
  const blushLRef = useRef()
  const blushRRef = useRef()

  // Wide happy smile
  const smileGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.14, 0, 0),
      new THREE.Vector3(0, -0.1, 0),
      new THREE.Vector3(0.14, 0, 0)
    )
    return new THREE.TubeGeometry(curve, 14, 0.02, 6, false)
  }, [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.position.y = Math.sin(t * 2) * 0.03
    // Pulsing blush
    if (blushLRef.current && blushRRef.current) {
      const pulse = 0.35 + Math.sin(t * 3) * 0.1
      blushLRef.current.material.opacity = pulse
      blushRRef.current.material.opacity = pulse
    }
  })

  return (
    <group ref={groupRef}>
      {/* Glossy black bead eyes — slightly tilted inward (friendly) */}
      <mesh position={[-0.18, 0.1, BODY_D / 2 + 0.08]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#111" roughness={0.08} metalness={0.4} />
      </mesh>
      <mesh position={[0.18, 0.1, BODY_D / 2 + 0.08]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#111" roughness={0.08} metalness={0.4} />
      </mesh>

      {/* Oversized crescent highlights (gives sparkle/life) */}
      <mesh position={[-0.24, 0.17, BODY_D / 2 + 0.17]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0.12, 0.17, BODY_D / 2 + 0.17]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>
      {/* Secondary smaller highlight */}
      <mesh position={[-0.14, 0.04, BODY_D / 2 + 0.18]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0.22, 0.04, BODY_D / 2 + 0.18]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {/* Wide happy smile */}
      <mesh position={[0, -0.08, BODY_D / 2 + 0.04]} geometry={smileGeo}>
        <meshBasicMaterial color="#333" />
      </mesh>

      {/* Tiny pink tongue peeking out */}
      <mesh position={[0, -0.14, BODY_D / 2 + 0.06]} scale={[1, 0.6, 0.4]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshBasicMaterial color="#FF8AAE" />
      </mesh>

      {/* Rosy blush cheeks — pulsing */}
      <mesh ref={blushLRef} position={[-0.3, -0.04, BODY_D / 2 + 0.02]}>
        <circleGeometry args={[0.09, 16]} />
        <meshBasicMaterial color="#FF6B8A" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={blushRRef} position={[0.3, -0.04, BODY_D / 2 + 0.02]}>
        <circleGeometry args={[0.09, 16]} />
        <meshBasicMaterial color="#FF6B8A" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── Character body wrapper ───────────────────────────────────────────────────

function PreviewCharacter({ faceStyle, color }) {
  const groupRef = useRef()

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = Math.sin(t * 0.8) * 0.3
  })

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh scale={[BODY_W, BODY_H, BODY_D]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          roughness={0.35}
          metalness={0.2}
        />
      </mesh>

      {/* Face */}
      {faceStyle === 0 && <FaceA />}
      {faceStyle === 1 && <FaceB />}
      {faceStyle === 2 && <FaceC />}
    </group>
  )
}

// ── Canvas ───────────────────────────────────────────────────────────────────

export default function FacePreviewCanvas({ faceStyle }) {
  const colors = ['#4FC3F7', '#81C784', '#FFB74D']
  return (
    <Canvas
      camera={{ position: [0, 0, 2.8], fov: 40 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 5]} intensity={1.2} />
      <pointLight position={[-2, 2, 3]} intensity={0.5} color="#4FC3F7" />
      <PreviewCharacter faceStyle={faceStyle} color={colors[faceStyle]} />
    </Canvas>
  )
}
