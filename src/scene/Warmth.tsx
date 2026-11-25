import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { TIMELINE } from '../timeline'
import { ARCH_Z, EXHIBIT, LANTERNS, LAMP_ANGLES, LAMP_R, PARTY, SLED, SPOT, ZONE_PATHS, at, exhibitAngle, groundY, polar, sledPoint } from './world'

// 🕯️ 마을에 온기: 추운 밤 눈밭 위로 따뜻한 불빛이 고인다.
//  · GlowPools: 등불·창문·모닥불·트리 아래 바닥에 주황빛 웅덩이 (빛을 더하는 평면 한 묶음)
//  · Chimney: 지붕 위 벽돌 굴뚝 + 몽글몽글 올라가는 연기
//  · SledLights: 썰매장 위 공중 등불 + 큰 풍등

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

/** 🏮 썰매장 위 공중 등불: 길 양옆을 따라 떠 있다 (산 위는 더 높이). big = 산 위의 큰 풍등 */
export const SLED_FLOATERS = (() => {
  const out: { x: number; y: number; z: number; big: boolean; flat: boolean; color: 'warm' | 'red' | 'gold' | 'green' }[] = []
  const colors = ['warm', 'gold', 'red', 'warm', 'green', 'gold'] as const
  let i = 0
  for (let s = -1.5; s <= SLED.len + SLED.run - 1; s += 2.6) {
    for (const side of [-1, 1]) {
      const p = sledPoint(s, side * (SLED.track + 0.9 + (i % 3) * 0.25))
      out.push({ ...p, y: groundY(p.x, p.z) + 2.7 + ((i * 37) % 7) * 0.12, big: false, flat: s > SLED.len, color: colors[i % colors.length] })
      i++
    }
  }
  // 산 위로 크게 떠 있는 풍등 넷
  for (const [s, w, y] of [
    [-0.5, 0, 9.2],
    [3.5, -1.6, 8.4],
    [6.5, 1.8, 7.6],
    [9.5, -0.4, 6.4],
  ]) {
    const p = sledPoint(s, w)
    out.push({ ...p, y, big: true, flat: false, color: 'warm' })
  }
  return out
})()

export const POOLS: Pool[] = [
  ...SLED_FLOATERS.filter((f) => f.flat).map((f) => ({ x: f.x, z: f.z, r: 2.4, k: 0.75 })),
  ...[12.2, 16, 19, 22, 25].map((s) => ({ ...sledPoint(s), r: 3.4, k: 0.5 })), // 평지 미끄럼 길 (비탈은 공중 등불 빛으로)
  ...LAMP_ANGLES.map((a) => ({ ...xz(polar(a, LAMP_R)), r: 2.6, k: 0.9 })),
  ...LANTERNS.map((l) => ({ x: l.x * 0.97, z: l.z * 0.97, r: 1.7, k: 0.65 })),
  ...pathLamps().map((p) => ({ ...p, r: 1.5, k: 0.6 })),
  { x: 0, z: 0, r: 5.2, k: 0.55, hue: 'gold' }, // 🎄 큰 트리
  { ...xz(at(SPOT.fire)), r: 4.4, k: 1.1, hue: 'fire' }, // 🔥 불멍
  { ...front(SPOT.cocoa, 2.2), r: 3.0, k: 0.85 }, // ☕ 카페
  { ...front(SPOT.post, 2.4), r: 3.0, k: 0.85 }, // 📮 우편함
  { ...front(SPOT.church, 3.2), r: 3.4, k: 0.8 }, // ⛪
  { x: PARTY.x, z: PARTY.z, r: 2.8, k: 0.7 }, // 🎂 파티
  { x: 0, z: ARCH_Z + 0.4, r: 3.4, k: 0.8 }, // 🎄 입구 아치 아래
  ...TIMELINE.map((_, i) => ({ ...xz(polar(exhibitAngle(i, TIMELINE.length), EXHIBIT.r - 0.7)), r: 1.5, k: 0.6 })), // 📜 연대기 패널 앞
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

const FLOAT_MATS = {
  warm: new THREE.MeshStandardMaterial({ color: '#ffd8a0', emissive: '#ffa24a', emissiveIntensity: 2.6, toneMapped: false }),
  gold: new THREE.MeshStandardMaterial({ color: '#ffe6a0', emissive: '#ffc84a', emissiveIntensity: 2.6, toneMapped: false }),
  red: new THREE.MeshStandardMaterial({ color: '#ff9a8a', emissive: '#ff4a3a', emissiveIntensity: 2.4, toneMapped: false }),
  green: new THREE.MeshStandardMaterial({ color: '#b8ffcc', emissive: '#3ad07a', emissiveIntensity: 2.2, toneMapped: false }),
}
const LANTERN_PAPER = new THREE.MeshStandardMaterial({ color: '#ffcf8a', emissive: '#ff9a3a', emissiveIntensity: 2.2, toneMapped: false, side: THREE.DoubleSide })
const LANTERN_RIM = new THREE.MeshStandardMaterial({ color: '#7a3a20', roughness: 0.8 })

/** 🏮 썰매장 공중 등불: 동그란 빛 구슬이 둥실둥실, 산 위에는 큰 풍등. 썰매 산을 은은하게 비춘다 */
export function SledLights() {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((c, i) => {
      const f = SLED_FLOATERS[i]
      if (!f) return
      c.position.y = f.y + Math.sin(t * (f.big ? 0.6 : 1.1) + i * 1.7) * (f.big ? 0.25 : 0.12)
      c.rotation.y = t * 0.3 + i
    })
  })
  const mid = sledPoint(SLED.len * 0.45)
  const top = sledPoint(-0.5)
  const run = sledPoint(SLED.len + SLED.run * 0.5)
  return (
    <group>
      <group ref={group}>
        {SLED_FLOATERS.map((f, i) =>
          f.big ? (
            <group key={i} position={[f.x, f.y, f.z]}>
              <mesh material={LANTERN_PAPER}>
                <cylinderGeometry args={[0.42, 0.32, 0.8, 12, 1, true]} />
              </mesh>
              <mesh position={[0, 0.42, 0]} material={LANTERN_RIM}>
                <cylinderGeometry args={[0.44, 0.44, 0.06, 12]} />
              </mesh>
              <mesh position={[0, -0.36, 0]} material={FLOAT_MATS.gold}>
                <sphereGeometry args={[0.12, 10, 8]} />
              </mesh>
            </group>
          ) : (
            <group key={i} position={[f.x, f.y, f.z]}>
              <mesh material={FLOAT_MATS[f.color]}>
                <sphereGeometry args={[0.17, 14, 10]} />
              </mesh>
              <mesh position={[0, 0.2, 0]} material={LANTERN_RIM}>
                <cylinderGeometry args={[0.05, 0.07, 0.06, 8]} />
              </mesh>
            </group>
          ),
        )}
      </group>
      {/* 산과 미끄럼 길을 은은하게 밝히는 따뜻한 빛 셋 (그림자 없음) */}
      <pointLight position={[top.x, SLED.h + 4, top.z]} color="#ffb070" intensity={18} distance={16} decay={1.6} />
      <pointLight position={[mid.x, SLED.h * 0.6 + 4, mid.z]} color="#ffb070" intensity={16} distance={14} decay={1.6} />
      <pointLight position={[run.x, 4, run.z]} color="#ffc080" intensity={16} distance={16} decay={1.6} />
    </group>
  )
}
