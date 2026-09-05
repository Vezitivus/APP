import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterState, OutfitId, PoseId } from './types'

type Props = { state: CharacterState }

function poseTransform(pose: PoseId) {
  switch (pose) {
    case 'lie':
      return { rot: [1.15, 0.2, 0.05] as [number, number, number], pos: [0, 0.35, 0] as [number, number, number] }
    case 'sit':
      return { rot: [0.35, 0.15, 0] as [number, number, number], pos: [0, 0.55, 0] as [number, number, number] }
    case 'stand':
      return { rot: [0, 0.2, 0] as [number, number, number], pos: [0, 0.95, 0] as [number, number, number] }
    case 'wave':
      return { rot: [0, 0.35, 0] as [number, number, number], pos: [0, 0.95, 0] as [number, number, number] }
    case 'turn':
      return { rot: [0, Math.PI + 0.15, 0] as [number, number, number], pos: [0, 0.95, 0] as [number, number, number] }
  }
}

function hairColor(hair: CharacterState['hair']) {
  if (hair === 'blonde') return '#d4b483'
  return '#1a1210'
}

function outfitParts(outfit: OutfitId, color: string) {
  return {
    showThong: outfit === 'thong' || outfit === 'swimwear',
    dress: outfit === 'dress',
    hoodie: outfit === 'casual',
    athletic: outfit === 'athletic',
    bikini: outfit === 'swimwear',
    color,
  }
}

export function Character({ state }: Props) {
  const group = useRef<THREE.Group>(null)
  const target = useRef(poseTransform(state.pose))
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}character-ref.jpg`
    const loader = new THREE.TextureLoader()
    let alive = true
    loader.load(
      url,
      (tex) => {
        if (!alive) return
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        setTexture(tex)
      },
      undefined,
      () => {
        console.warn('character texture failed', url)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  target.current = poseTransform(state.pose)
  const parts = outfitParts(state.outfit, state.outfitColor)
  const hair = hairColor(state.hair)
  const shoulder = 0.22 + state.muscle * 0.08
  const torsoW = 0.28 + state.muscle * 0.06
  const waistW = 0.16 + state.waist * 0.12
  const hipW = 0.26 + (1 - state.waist) * 0.04
  const scaleY = state.height
  const skin = '#c6866a'
  const glossy = useMemo(() => ({ roughness: 0.35, metalness: 0.05 }), [])

  useFrame((clock) => {
    const g = group.current
    if (!g) return
    const breath = 1 + Math.sin(clock.clock.elapsedTime * 1.6) * 0.012
    const t = target.current
    g.position.x = THREE.MathUtils.lerp(g.position.x, t.pos[0], 0.08)
    g.position.y = THREE.MathUtils.lerp(g.position.y, t.pos[1], 0.08)
    g.position.z = THREE.MathUtils.lerp(g.position.z, t.pos[2], 0.08)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, t.rot[0], 0.08)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, t.rot[1], 0.08)
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, t.rot[2], 0.08)
    g.scale.set(1, scaleY * breath, 1)
    const arm = g.getObjectByName('rightArm')
    if (arm && state.pose === 'wave') {
      arm.rotation.z = -0.6 + Math.sin(clock.clock.elapsedTime * 5) * 0.45
    } else if (arm) {
      arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, -0.25, 0.1)
    }
  })

  return (
    <group ref={group} position={[0, 0.95, 0]}>
      {texture ? (
        <mesh position={[0, 0.55, 0.18]}>
          <planeGeometry args={[0.55, 0.85]} />
          <meshStandardMaterial map={texture} roughness={0.55} metalness={0.02} transparent opacity={0.98} />
        </mesh>
      ) : (
        <mesh position={[0, 0.55, 0.18]}>
          <planeGeometry args={[0.55, 0.85]} />
          <meshStandardMaterial color={skin} {...glossy} />
        </mesh>
      )}

      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh position={[0, 1.12, -0.02]}>
        <sphereGeometry args={[0.175, 24, 24]} />
        <meshStandardMaterial color={hair} roughness={0.7} />
      </mesh>
      {state.hair === 'ponytail' && (
        <mesh position={[0, 0.95, -0.18]} rotation={[0.6, 0, 0]}>
          <capsuleGeometry args={[0.04, 0.28, 6, 12]} />
          <meshStandardMaterial color={hair} roughness={0.7} />
        </mesh>
      )}
      {state.hair === 'wet' && (
        <>
          <mesh position={[-0.12, 1.0, 0.08]}>
            <capsuleGeometry args={[0.025, 0.2, 4, 8]} />
            <meshStandardMaterial color={hair} roughness={0.4} metalness={0.15} />
          </mesh>
          <mesh position={[0.1, 0.98, 0.1]}>
            <capsuleGeometry args={[0.022, 0.18, 4, 8]} />
            <meshStandardMaterial color={hair} roughness={0.4} metalness={0.15} />
          </mesh>
        </>
      )}

      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[torsoW * 0.55, 0.45, 6, 12]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh position={[0, 0.22, 0]} scale={[waistW / 0.22, 1, 0.9]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh position={[0, 0.05, 0]} scale={[hipW / 0.24, 0.7, 1]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      <mesh position={[-shoulder, 0.78, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh position={[shoulder, 0.78, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      <mesh name="leftArm" position={[-shoulder - 0.05, 0.45, 0]} rotation={[0, 0, 0.25]}>
        <capsuleGeometry args={[0.045, 0.42, 4, 8]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh name="rightArm" position={[shoulder + 0.05, 0.45, 0]} rotation={[0, 0, -0.25]}>
        <capsuleGeometry args={[0.045, 0.42, 4, 8]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      <mesh position={[-0.09, -0.35, 0]}>
        <capsuleGeometry args={[0.07, 0.55, 4, 8]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh position={[0.09, -0.35, 0]}>
        <capsuleGeometry args={[0.07, 0.55, 4, 8]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      {parts.showThong && !parts.dress && (
        <mesh position={[0, 0.02, 0.02]} scale={[hipW / 0.24, 0.35, 1.05]}>
          <sphereGeometry args={[0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={parts.bikini ? parts.color : '#111111'} roughness={0.45} />
        </mesh>
      )}
      {parts.bikini && (
        <mesh position={[0, 0.62, 0.02]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[0.2, 16, 12]} />
          <meshStandardMaterial color={parts.color} roughness={0.4} />
        </mesh>
      )}
      {parts.dress && (
        <mesh position={[0, 0.25, 0]}>
          <coneGeometry args={[0.32, 0.85, 16]} />
          <meshStandardMaterial color={parts.color} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      {parts.hoodie && (
        <>
          <mesh position={[0, 0.55, 0]}>
            <capsuleGeometry args={[torsoW * 0.62, 0.4, 6, 12]} />
            <meshStandardMaterial color={parts.color} roughness={0.75} />
          </mesh>
          <mesh position={[-0.09, -0.15, 0.01]}>
            <capsuleGeometry args={[0.085, 0.35, 4, 8]} />
            <meshStandardMaterial color="#2a3a55" roughness={0.7} />
          </mesh>
          <mesh position={[0.09, -0.15, 0.01]}>
            <capsuleGeometry args={[0.085, 0.35, 4, 8]} />
            <meshStandardMaterial color="#2a3a55" roughness={0.7} />
          </mesh>
        </>
      )}
      {parts.athletic && (
        <>
          <mesh position={[0, 0.55, 0]}>
            <capsuleGeometry args={[torsoW * 0.58, 0.38, 6, 12]} />
            <meshStandardMaterial color={parts.color} roughness={0.55} />
          </mesh>
          <mesh position={[-0.09, -0.2, 0]}>
            <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
          </mesh>
          <mesh position={[0.09, -0.2, 0]}>
            <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
          </mesh>
        </>
      )}
    </group>
  )
}
