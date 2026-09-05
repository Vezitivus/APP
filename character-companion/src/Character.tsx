import { useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
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
  const skinHide = outfit === 'bare'
  return {
    showThong: outfit === 'thong' || outfit === 'swimwear',
    showTop: outfit === 'dress' || outfit === 'casual' || outfit === 'athletic' || outfit === 'swimwear',
    showPants: outfit === 'casual' || outfit === 'athletic' || outfit === 'dress',
    dress: outfit === 'dress',
    hoodie: outfit === 'casual',
    athletic: outfit === 'athletic',
    bikini: outfit === 'swimwear',
    bare: skinHide,
    color,
  }
}

export function Character({ state }: Props) {
  const group = useRef<THREE.Group>(null)
  const target = useRef(poseTransform(state.pose))
  const texture = useLoader(THREE.TextureLoader, `${import.meta.env.BASE_URL}character-ref.jpg`)

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
  }, [texture])

  target.current = poseTransform(state.pose)
  const parts = outfitParts(state.outfit, state.outfitColor)
  const hair = hairColor(state.hair)
  const shoulder = 0.22 + state.muscle * 0.08
  const torsoW = 0.28 + state.muscle * 0.06
  const waistW = 0.16 + state.waist * 0.12
  const hipW = 0.26 + (1 - state.waist) * 0.04
  const scaleY = state.height

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

    // wave arm bob
    const arm = g.getObjectByName('rightArm')
    if (arm && state.pose === 'wave') {
      arm.rotation.z = -0.6 + Math.sin(clock.clock.elapsedTime * 5) * 0.45
    } else if (arm) {
      arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, -0.25, 0.1)
    }
  })

  const skin = '#c6866a'
  const glossy = { roughness: 0.35, metalness: 0.05 }

  return (
    <group ref={group} position={[0, 0.95, 0]}>
      {/* Photo likeness card — face/torso from reference */}
      <mesh position={[0, 0.55, 0.18]} castShadow>
        <planeGeometry args={[0.55, 0.85]} />
        <meshStandardMaterial map={texture} roughness={0.55} metalness={0.02} transparent opacity={0.98} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      {/* Hair volume */}
      <mesh position={[0, 1.12, -0.02]} castShadow>
        <sphereGeometry args={[0.175, 32, 32]} />
        <meshStandardMaterial color={hair} roughness={0.7} />
      </mesh>
      {state.hair === 'ponytail' && (
        <mesh position={[0, 0.95, -0.18]} rotation={[0.6, 0, 0]} castShadow>
          <capsuleGeometry args={[0.04, 0.28, 8, 16]} />
          <meshStandardMaterial color={hair} roughness={0.7} />
        </mesh>
      )}
      {state.hair === 'wet' && (
        <>
          <mesh position={[-0.12, 1.0, 0.08]} castShadow>
            <capsuleGeometry args={[0.025, 0.2, 6, 12]} />
            <meshStandardMaterial color={hair} roughness={0.4} metalness={0.15} />
          </mesh>
          <mesh position={[0.1, 0.98, 0.1]} castShadow>
            <capsuleGeometry args={[0.022, 0.18, 6, 12]} />
            <meshStandardMaterial color={hair} roughness={0.4} metalness={0.15} />
          </mesh>
        </>
      )}

      {/* Torso */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[torsoW * 0.55, 0.45, 8, 16]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      {/* Waist / hips */}
      <mesh position={[0, 0.22, 0]} scale={[waistW / 0.22, 1, 0.9]} castShadow>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh position={[0, 0.05, 0]} scale={[hipW / 0.24, 0.7, 1]} castShadow>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      {/* Shoulders */}
      <mesh position={[-shoulder, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh position={[shoulder, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      {/* Arms */}
      <mesh name="leftArm" position={[-shoulder - 0.05, 0.45, 0]} rotation={[0, 0, 0.25]} castShadow>
        <capsuleGeometry args={[0.045, 0.42, 6, 12]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh name="rightArm" position={[shoulder + 0.05, 0.45, 0]} rotation={[0, 0, -0.25]} castShadow>
        <capsuleGeometry args={[0.045, 0.42, 6, 12]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.09, -0.35, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.55, 6, 12]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>
      <mesh position={[0.09, -0.35, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.55, 6, 12]} />
        <meshStandardMaterial color={skin} {...glossy} />
      </mesh>

      {/* Clothing layers */}
      {parts.showThong && !parts.dress && (
        <mesh position={[0, 0.02, 0.02]} scale={[hipW / 0.24, 0.35, 1.05]} castShadow>
          <sphereGeometry args={[0.2, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={parts.bikini ? parts.color : '#111111'} roughness={0.45} />
        </mesh>
      )}

      {parts.bikini && (
        <mesh position={[0, 0.62, 0.02]} scale={[1, 0.55, 1]} castShadow>
          <sphereGeometry args={[0.2, 24, 16]} />
          <meshStandardMaterial color={parts.color} roughness={0.4} />
        </mesh>
      )}

      {parts.dress && (
        <mesh position={[0, 0.25, 0]} castShadow>
          <coneGeometry args={[0.32, 0.85, 24]} />
          <meshStandardMaterial color={parts.color} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {parts.hoodie && (
        <>
          <mesh position={[0, 0.55, 0]} castShadow>
            <capsuleGeometry args={[torsoW * 0.62, 0.4, 8, 16]} />
            <meshStandardMaterial color={parts.color} roughness={0.75} />
          </mesh>
          <mesh position={[-0.09, -0.15, 0.01]} castShadow>
            <capsuleGeometry args={[0.085, 0.35, 6, 12]} />
            <meshStandardMaterial color="#2a3a55" roughness={0.7} />
          </mesh>
          <mesh position={[0.09, -0.15, 0.01]} castShadow>
            <capsuleGeometry args={[0.085, 0.35, 6, 12]} />
            <meshStandardMaterial color="#2a3a55" roughness={0.7} />
          </mesh>
        </>
      )}

      {parts.athletic && (
        <>
          <mesh position={[0, 0.55, 0]} castShadow>
            <capsuleGeometry args={[torsoW * 0.58, 0.38, 8, 16]} />
            <meshStandardMaterial color={parts.color} roughness={0.55} />
          </mesh>
          <mesh position={[-0.09, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.4, 6, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
          </mesh>
          <mesh position={[0.09, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.4, 6, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
          </mesh>
        </>
      )}
    </group>
  )
}
