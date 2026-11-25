import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LANTERNS, LAMP_ANGLES, LAMP_R, PARTY, SPOT, ZONE_PATHS, at, groundY, polar } from './world'

// 🕯️ 마을에 온기: 추운 밤 눈밭 위로 따뜻한 불빛이 고인다.
//  · GlowPools: 등불·창문·모닥불·트리 아래 바닥에 주황빛 웅덩이 (빛을 더하는 평면 한 묶음)
//  · Chimney: 지붕 위 벽돌 굴뚝 + 몽글몽글 올라가는 연기

type Pool = { x: number; z: number; r: number; k: number; hue?: 'warm' | 'gold' | 'fire' }

/** 길가 등불 자리: Decor 의 Paths 와 같은 규칙 (4m 마다 길 양쪽 번갈아) */
function pathLamps() {
  const out: { x: number; z: number }[] = []
  let k = 0
  for (const path of ZONE_PATHS)
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]
      const b = path[i]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      const ux = (b.x - a.x) / len
      const uz = (b.z - a.z) / len
      for (let d = 0.4; d < len; d += 0.75)
        if (k++ % 6 === 3) {
          const s = (k % 12 < 6 ? 1 : -1) * 1.0
          out.push({ x: a.x + ux * d - uz * s, z: a.z + uz * d + ux * s })
        }
    }
  return out
}

/** 건물 문 앞 (중심에서 조금 마을 쪽) */
const front = (s: { a: number; r: number }, back: number) => {
  const [x, , z] = polar(s.a, s.r - back)
  return { x, z }
}

export const POOLS: Pool[] = [
  ...LAMP_ANGLES.map((a) => ({ ...xz(polar(a, LAMP_R)), r: 2.6, k: 0.9 })),
  ...LANTERNS.map((l) => ({ x: l.x * 0.97, z: l.z * 0.97, r: 1.7, k: 0.65 })),
  ...pathLamps().map((p) => ({ ...p, r: 1.5, k: 0.6 })),
  { x: 0, z: 0, r: 5.2, k: 0.55, hue: 'gold' }, // 🎄 큰 트리
  { ...xz(at(SPOT.fire)), r: 4.4, k: 1.1, hue: 'fire' }, // 🔥 불멍
  { ...front(SPOT.cocoa, 2.2), r: 3.0, k: 0.85 }, // ☕ 카페
  { ...front(SPOT.post, 2.4), r: 3.0, k: 0.85 }, // 📮 우편함
  { ...front(SPOT.church, 3.2), r: 3.4, k: 0.8 }, // ⛪
  { x: PARTY.x, z: PARTY.z, r: 2.8, k: 0.7 }, // 🎂 파티
]
function xz(p: [number, number, number]) {
  return { x: p[0], z: p[2] }
}

/** 가운데가 진하고 바깥으로 사르르 사라지는 동그란 빛 */
function poolTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const HUES = { warm: new THREE.Color('#ff9a3c'), gold: new THREE.Color('#ffc65a'), fire: new THREE.Color('#ff7a2a') }
const tmp = new THREE.Object3D()
const col = new THREE.Color()

export function GlowPools() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: poolTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        opacity: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -8,
        polygonOffsetUnits: -8,
      }),
    [],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [])
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    POOLS.forEach((p, i) => {
      tmp.position.set(p.x, groundY(p.x, p.z) + 0.03, p.z)
      tmp.scale.set(p.r * 2, 1, p.r * 2)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
      m.setColorAt(i, col.copy(HUES[p.hue ?? 'warm']).multiplyScalar(p.k))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [])
  // 모닥불은 살짝 일렁인다
  const fireIdx = POOLS.findIndex((p) => p.hue === 'fire')
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m || fireIdx < 0) return
    const t = clock.elapsedTime
    m.setColorAt(fireIdx, col.copy(HUES.fire).multiplyScalar(1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, POOLS.length]} frustumCulled={false} renderOrder={2} />
}

const BRICK = new THREE.MeshStandardMaterial({ color: '#8a4a3a', roughness: 0.9 })
const CAP = new THREE.MeshStandardMaterial({ color: '#f4f6fb', roughness: 0.9 })
const SMOKE = new THREE.MeshStandardMaterial({ color: '#e9ecf6', roughness: 1, transparent: true, opacity: 0.7, depthWrite: false })

/** 🏠 벽돌 굴뚝 + 몽글몽글 연기 (position = 굴뚝 바닥, 지붕에 묻히게) */
export function Chimney({ position, h = 0.9 }: { position: [number, number, number]; h?: number }) {
  const puffs = useRef<THREE.Group>(null)
  const seed = useMemo(() => Math.random() * 10, [])
  useFrame(({ clock }) => {
    const g = puffs.current
    if (!g) return
    const t = clock.elapsedTime * 0.45 + seed
    g.children.forEach((c, i) => {
      const p = (t + i / g.children.length) % 1 // 0..1
      c.position.set(Math.sin((t + i) * 1.3) * 0.12 + p * 0.5, h + 0.15 + p * 2.2, Math.cos((t + i) * 1.1) * 0.08)
      c.scale.setScalar(0.12 + p * 0.38)
      ;((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.75 * (1 - p) * Math.min(1, p * 6)
    })
  })
  const mats = useMemo(() => Array.from({ length: 6 }, () => SMOKE.clone()), [])
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} material={BRICK} castShadow>
        <boxGeometry args={[0.36, h, 0.36]} />
      </mesh>
      <mesh position={[0, h + 0.04, 0]} material={CAP}>
        <boxGeometry args={[0.46, 0.1, 0.46]} />
      </mesh>
      <group ref={puffs}>
        {mats.map((m, i) => (
          <mesh key={i} material={m}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
