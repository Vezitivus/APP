import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Suspense, useMemo } from "react"
import * as THREE from "three"
import { Character } from "./Character"
import type { CharacterState, LightingId } from "./types"

type Props = {
  state: CharacterState
  controlsRef: React.MutableRefObject<any>
}

function Lights({ mode }: { mode: LightingId }) {
  const cfg = useMemo(() => {
    if (mode === "bright") {
      return { ambient: 0.7, key: 1.5, keyColor: "#fff5e6", fill: 0.55, rim: 0.4, bg: "#1a1a22" }
    }
    if (mode === "sunset") {
      return { ambient: 0.4, key: 1.3, keyColor: "#ff8a4c", fill: 0.35, rim: 0.55, bg: "#1a1018" }
    }
    return { ambient: 0.35, key: 1.25, keyColor: "#ffc07a", fill: 0.35, rim: 0.4, bg: "#0c0a0e" }
  }, [mode])

  return (
    <>
      <color attach="background" args={[cfg.bg]} />
      <ambientLight intensity={cfg.ambient} />
      <directionalLight position={[2.2, 3.2, 2]} intensity={cfg.key} color={cfg.keyColor} />
      <pointLight position={[-1.5, 1.2, 1]} intensity={cfg.fill} color="#8ab4ff" />
      <pointLight position={[0.5, 0.8, -1.5]} intensity={cfg.rim} color="#ff6b8a" />
      <pointLight position={[1.15, 0.55, -0.6]} intensity={0.9} color="#ffc07a" distance={5} />
    </>
  )
}

function Bed() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="#1a1520" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.8, 0.16, 2.4]} />
        <meshStandardMaterial color="#e8e4df" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.22, -0.85]}>
        <boxGeometry args={[1.5, 0.2, 0.45]} />
        <meshStandardMaterial color="#f2eee8" roughness={0.8} />
      </mesh>
      <mesh position={[1.15, 0.55, -0.6]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="#ffd19a" emissive="#ffb347" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

export function Scene({ state, controlsRef }: Props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [1.4, 1.6, 2.4], fov: 40, near: 0.1, far: 50 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <Suspense fallback={null}>
        <Lights mode={state.lighting} />
        <Bed />
        <Character state={state} />
        <OrbitControls
          ref={controlsRef}
          target={[0, 0.9, 0]}
          maxPolarAngle={Math.PI * 0.85}
          minDistance={1.2}
          maxDistance={6}
          enablePan
        />
      </Suspense>
    </Canvas>
  )
}
