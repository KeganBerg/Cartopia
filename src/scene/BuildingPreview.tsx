import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { View, PerspectiveCamera } from '@react-three/drei'
import type { Group, Mesh } from 'three'
import { TILE, type BuildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'

// One shared renderer draws every shop thumbnail, so the shop costs a single
// WebGL context however many items it lists. The canvas covers the whole
// screen (drei's View maths assumes that) and is clipped to the scrolling list.
export function PreviewCanvas() {
  const area = useRef<HTMLDivElement>(null)
  const [clip, setClip] = useState('inset(100%)')
  useEffect(() => {
    let id = 0
    let last = ''
    const tick = () => {
      const r = area.current?.getBoundingClientRect()
      if (r) {
        const next = `inset(${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px)`
        if (next !== last) setClip((last = next))
      }
      id = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <>
      <div ref={area} className="preview-area" />
      {createPortal(
        <div className="preview-canvas" style={{ clipPath: clip }}>
          <Canvas dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
            <View.Port />
          </Canvas>
        </div>,
        document.body,
      )}
    </>
  )
}

function Floating({ def }: { def: BuildingDef }) {
  const ref = useRef<Group>(null)
  const shadow = useRef<Mesh>(null)
  useFrame(({ clock }, dt) => {
    const lift = 0.25 + Math.sin(clock.elapsedTime * 2) * 0.12
    if (ref.current) {
      ref.current.position.y = lift
      ref.current.rotation.y += Math.min(dt, 0.1) * 0.6
    }
    shadow.current?.scale.setScalar(1 - lift * 0.5)
  })
  const size = Math.max(def.w, def.h) * TILE
  return (
    <>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.01}>
        <circleGeometry args={[size * 0.5, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <group ref={ref}>
        <BuildingModel def={def} />
      </group>
    </>
  )
}

// A building or decoration floating and turning, exactly as it looks in town.
export function BuildingThumb({ def }: { def: BuildingDef }) {
  const size = Math.max(def.w, def.h) * TILE
  // Frame bigger lots from further away so everything fills the card.
  const d = 1.6 + size * 1.05
  return (
    <View className="thumb3d">
      <PerspectiveCamera makeDefault fov={30} position={[d, d * 0.8, d]} onUpdate={(c) => c.lookAt(0, 0.7 + size * 0.1, 0)} />
      <hemisphereLight args={['#ffffff', '#8d9ba3', 1.1]} />
      <directionalLight position={[4, 8, 3]} intensity={1.5} />
      <Floating def={def} />
    </View>
  )
}
