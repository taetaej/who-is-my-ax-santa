import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

// 카메라와 내 캐릭터 사이를 가리는 물체(큰 트리, 집)를 반투명하게 만든다.
// 카메라는 항상 캐릭터를 바라보므로, 시선이 바닥(y=0.7)과 만나는 점을 캐릭터 위치로 본다.

const fwd = new THREE.Vector3()

export function Fade({ x, z, r, children }: { x: number; z: number; r: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const mats = useRef<THREE.Material[]>([])
  const opacity = useRef(1)
  const center = useMemo(() => new THREE.Vector2(x, z), [x, z])

  // 이 묶음만 따로 투명해지도록 재질을 복제해 둔다
  useLayoutEffect(() => {
    // 같은 재질은 같은 복제본을 쓰게 해서 Batch 로 합친 메시와 함께 써도 재질 수가 늘지 않게 한다
    const clones = new Map<THREE.Material, THREE.Material>()
    group.current?.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || Array.isArray(m.material)) return
      if (!clones.has(m.material)) clones.set(m.material, m.material.clone())
      m.material = clones.get(m.material)!
    })
    mats.current = [...clones.values()]
  }, [])

  useFrame(({ camera }, dt) => {
    camera.getWorldDirection(fwd)
    let target = 1
    if (fwd.y < -0.05) {
      const t = (0.7 - camera.position.y) / fwd.y
      const px = camera.position.x + fwd.x * t
      const pz = camera.position.z + fwd.z * t
      // 카메라→캐릭터 선분(xz)과 물체 중심 사이 거리
      const ax = camera.position.x
      const az = camera.position.z
      const vx = px - ax
      const vz = pz - az
      const len2 = vx * vx + vz * vz || 1
      const s = ((center.x - ax) * vx + (center.y - az) * vz) / len2
      if (s > 0.05 && s < 0.97) {
        const d = Math.hypot(ax + vx * s - center.x, az + vz * s - center.y)
        if (d < r) target = 0.22
      }
    }
    const prev = opacity.current
    let o = prev + (target - prev) * Math.min(1, dt * 8)
    if (o > 0.99) o = 1
    if (Math.abs(o - prev) < 0.002 && o !== 1) return
    opacity.current = o
    if (o === prev) return
    for (const m of mats.current) {
      m.transparent = o < 1
      m.opacity = o
      m.depthWrite = o === 1
    }
  })

  return <group ref={group}>{children}</group>
}
