import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Batch } from './Batch'
import { M, blobs, rng } from './materials'
import { Present } from './props'
import { TextSign } from './TextSign'
import { SpotLabel } from './Spots'
import { PARTY, addCircle } from './world'

// 🎂 AX 파티 테이블: 3단 크리스마스 케이크 + 촛불 + 풍선 + 가랜드 깃발. 연말 파티 느낌.

const CREAM = new THREE.MeshStandardMaterial({ color: '#fff8ee', roughness: 0.55 })
const SPONGE = new THREE.MeshStandardMaterial({ color: '#f3d6b0', roughness: 0.8 })
const BERRY = new THREE.MeshStandardMaterial({ color: '#e0242c', roughness: 0.3 })
const LEAF = new THREE.MeshStandardMaterial({ color: '#2e8a52', roughness: 0.6 })
const CLOTH = new THREE.MeshStandardMaterial({ color: '#b3202a', roughness: 0.8, side: THREE.DoubleSide })
const CANDLE = new THREE.MeshStandardMaterial({ color: '#fdf3f6', roughness: 0.5 })
const FLAME = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb04a', emissiveIntensity: 3.2, toneMapped: false })
const BALLOONS = ['#e0242c', '#e8b53a', '#2e8a52', '#f4f1ea', '#2f62b0', '#e06a9a'].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.15 }),
)

addCircle(PARTY.x, PARTY.z, 1.05) // 테이블

const TABLE_H = 0.72
const TIERS = [
  { r: 0.62, h: 0.42 },
  { r: 0.46, h: 0.38 },
  { r: 0.3, h: 0.34 },
]

/** 각 단 위에 흘러내리는 크림 + 딸기 */
function tierDeco(r: number, top: number, seed: number) {
  const g = rng(seed)
  const drips: [number, number, number, number][] = []
  const berries: [number, number, number, number][] = []
  const n = Math.round(r * 30)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    drips.push([Math.cos(a) * r, top - 0.04 - g() * 0.08, Math.sin(a) * r, 0.045 + g() * 0.02])
    drips.push([Math.cos(a) * (r - 0.03), top + 0.02, Math.sin(a) * (r - 0.03), 0.05])
  }
  const nb = Math.round(r * 13)
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + 0.2
    berries.push([Math.cos(a) * (r - 0.1), top + 0.07, Math.sin(a) * (r - 0.1), 0.055])
  }
  return { drips, berries }
}

function Cake() {
  const geo = useMemo(() => {
    const drips: [number, number, number, number][] = []
    const berries: [number, number, number, number][] = []
    let y = TABLE_H + 0.04
    TIERS.forEach((t, i) => {
      const d = tierDeco(t.r, y + t.h, 30 + i)
      drips.push(...d.drips)
      berries.push(...d.berries)
      y += t.h
    })
    return { drips: blobs(drips, 6), berries: blobs(berries, 8) }
  }, [])

  const tiers = useMemo(() => {
    let y = TABLE_H + 0.04
    return TIERS.map((t) => {
      const out = { ...t, y: y + t.h / 2 }
      y += t.h
      return out
    })
  }, [])
  const topY = tiers[2].y + TIERS[2].h / 2

  const flames = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    flames.current?.children.forEach((c, i) => {
      c.scale.set(1, 1 + Math.sin(t * 13 + i * 2) * 0.25, 1)
      c.rotation.z = Math.sin(t * 7 + i) * 0.15
    })
    if (light.current) light.current.intensity = 5 + Math.sin(t * 11) * 0.8
  })

  const candles = [0, 1, 2, 3, 4].map((i) => {
    const a = (i / 5) * Math.PI * 2
    return { x: Math.cos(a) * 0.17, z: Math.sin(a) * 0.17, h: 0.2 + (i % 2) * 0.06 }
  })

  return (
    <group>
      <Batch>
        {/* 접시 */}
        <mesh position={[0, TABLE_H + 0.02, 0]} material={M.gold}>
          <cylinderGeometry args={[0.78, 0.74, 0.04, 32]} />
        </mesh>
        {tiers.map((t, i) => (
          <group key={i}>
            <mesh position={[0, t.y, 0]} material={i === 1 ? SPONGE : CREAM} castShadow receiveShadow>
              <cylinderGeometry args={[t.r, t.r, t.h, 36]} />
            </mesh>
            {/* 단마다 빨간 리본 띠 */}
            <mesh position={[0, t.y - t.h * 0.18, 0]} material={M.ribbon}>
              <cylinderGeometry args={[t.r + 0.006, t.r + 0.006, 0.07, 36, 1, true]} />
            </mesh>
          </group>
        ))}
        <mesh geometry={geo.drips} material={CREAM} castShadow />
        <mesh geometry={geo.berries} material={BERRY} />
        {/* 호랑가시 잎 */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.36, tiers[1].y - 0.05, 0.31]} rotation={[0.4, s * 0.6, s * 0.5]} material={LEAF} scale={[1, 0.25, 0.5]}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </mesh>
        ))}
        {candles.map((c, i) => (
          <mesh key={i} position={[c.x, topY + c.h / 2, c.z]} material={CANDLE}>
            <cylinderGeometry args={[0.022, 0.022, c.h, 8]} />
          </mesh>
        ))}
      </Batch>
      <group ref={flames}>
        {candles.map((c, i) => (
          <mesh key={i} position={[c.x, topY + c.h + 0.04, c.z]} material={FLAME}>
            <coneGeometry args={[0.022, 0.07, 8]} />
          </mesh>
        ))}
      </group>
      {/* 꼭대기 장식: 금빛 별 + AX 토퍼 */}
      <mesh position={[0, topY + 0.5, 0]} rotation={[0, 0, Math.PI / 4]} material={M.glow}>
        <octahedronGeometry args={[0.09, 0]} />
      </mesh>
      {/* 토퍼 꽂이 + 양면 팻말 */}
      <mesh position={[0, topY + 0.16, 0]} material={M.gold}>
        <cylinderGeometry args={[0.008, 0.008, 0.32, 4]} />
      </mesh>
      {[0, Math.PI].map((ry) => (
        <TextSign
          key={ry}
          lines={[{ text: 'AX 2026', size: 0.075, color: '#ffffff', weight: 900 }]}
          w={0.36}
          h={0.13}
          bg="#c0392b"
          radius={0.03}
          position={[Math.sin(ry) * 0.006, topY + 0.32, Math.cos(ry) * 0.006]}
          rotation={[0, ry, 0]}
          glow
        />
      ))}
      <pointLight ref={light} position={[0, topY + 0.5, 0.3]} color="#ffbf70" intensity={5} distance={4} decay={2} />
      <Sparkles count={30} scale={[1.2, 0.8, 1.2]} position={[0, topY + 0.45, 0]} size={3} speed={0.6} color="#ffd88a" />
    </group>
  )
}

function Balloons({ position, seed }: { position: [number, number, number]; seed: number }) {
  const ref = useRef<THREE.Group>(null)
  const list = useMemo(() => {
    const g = rng(seed)
    return Array.from({ length: 5 }, (_, i) => ({
      x: (g() - 0.5) * 0.5,
      z: (g() - 0.5) * 0.5,
      y: 1.9 + g() * 0.6,
      m: BALLOONS[(i + seed) % BALLOONS.length],
    }))
  }, [seed])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ref.current?.children.forEach((c, i) => {
      c.position.y = Math.sin(t * 1.3 + i * 1.7 + seed) * 0.06
      c.rotation.z = Math.sin(t * 0.9 + i) * 0.06
    })
  })
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]} material={M.presents[1]}>
        <boxGeometry args={[0.16, 0.12, 0.16]} />
      </mesh>
      <group ref={ref}>
        {list.map((b, i) => (
          <group key={i}>
            <mesh position={[b.x, b.y, b.z]} material={b.m} scale={[1, 1.15, 1]} castShadow>
              <sphereGeometry args={[0.2, 16, 12]} />
            </mesh>
            {/* 줄 */}
            <mesh position={[b.x / 2, (b.y - 0.2) / 2 + 0.06, b.z / 2]} rotation={[b.z * 0.4, 0, -b.x * 0.4]} material={M.trim}>
              <cylinderGeometry args={[0.004, 0.004, b.y - 0.2, 4]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** 삼각 깃발 가랜드 */
function Bunting({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const flags = useMemo(() => {
    const out: { p: THREE.Vector3; rot: number; m: THREE.Material }[] = []
    const n = 12
    const dir = to.clone().sub(from)
    const rot = Math.atan2(dir.x, dir.z) + Math.PI / 2
    for (let i = 1; i < n; i++) {
      const t = i / n
      const p = from.clone().lerp(to, t)
      p.y -= Math.sin(t * Math.PI) * 0.35
      out.push({ p, rot, m: [M.ribbon, M.gold, M.presents[0], M.trim][i % 4] })
    }
    return out
  }, [from, to])
  const wire = useMemo(() => {
    const pts = Array.from({ length: 17 }, (_, i) => {
      const t = i / 16
      const p = from.clone().lerp(to, t)
      p.y -= Math.sin(t * Math.PI) * 0.35
      return p
    })
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 4)
  }, [from, to])
  return (
    <group>
      <mesh geometry={wire} material={M.iron} />
      {flags.map((f, i) => (
        <mesh key={i} position={[f.p.x, f.p.y - 0.11, f.p.z]} rotation={[0, f.rot, Math.PI]} material={f.m}>
          <coneGeometry args={[0.09, 0.22, 3]} />
        </mesh>
      ))}
    </group>
  )
}

export function Party() {
  const poles = useMemo(
    () => [new THREE.Vector3(PARTY.x - 1.9, 2.2, PARTY.z - 1.1), new THREE.Vector3(PARTY.x + 1.9, 2.2, PARTY.z - 1.1)],
    [],
  )
  return (
    <group>
      <group position={[PARTY.x, 0, PARTY.z]}>
        <Batch>
          {/* 둥근 테이블 + 식탁보 */}
          <mesh position={[0, TABLE_H - 0.02, 0]} material={M.wood} castShadow receiveShadow>
            <cylinderGeometry args={[0.95, 0.95, 0.06, 32]} />
          </mesh>
          <mesh position={[0, TABLE_H - 0.2, 0]} material={CLOTH} castShadow>
            <cylinderGeometry args={[1.0, 1.08, 0.38, 32, 1, true]} />
          </mesh>
          <mesh position={[0, TABLE_H / 2 - 0.1, 0]} material={M.woodDark}>
            <cylinderGeometry args={[0.08, 0.12, TABLE_H - 0.2, 10]} />
          </mesh>
          {/* 접시와 컵 */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2 + 0.3
            return (
              <group key={i} position={[Math.cos(a) * 0.8, TABLE_H + 0.01, Math.sin(a) * 0.8]}>
                <mesh material={M.trim}>
                  <cylinderGeometry args={[0.1, 0.09, 0.015, 14]} />
                </mesh>
                <mesh position={[0.12, 0.05, 0]} material={i % 2 ? M.ribbon : M.gold}>
                  <cylinderGeometry args={[0.035, 0.03, 0.09, 10]} />
                </mesh>
              </group>
            )
          })}
        </Batch>
        <Cake />
        <Present position={[1.25, 0, 0.5]} m={0} size={0.3} rotation={0.4} />
        <Present position={[-1.3, 0, 0.35]} m={3} size={0.26} rotation={-0.3} />
        <Present position={[1.1, 0, -0.75]} m={1} size={0.22} rotation={0.9} />
      </group>
      <Balloons position={[PARTY.x - 1.6, 0, PARTY.z + 0.9]} seed={1} />
      <Balloons position={[PARTY.x + 1.7, 0, PARTY.z + 0.2]} seed={4} />
      {poles.map((p, i) => (
        <mesh key={i} position={[p.x, 1.1, p.z]} material={M.trim} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 2.2, 8]} />
        </mesh>
      ))}
      <Bunting from={poles[0]} to={poles[1]} />
      <Sparkles count={40} scale={[4, 2.5, 3]} position={[PARTY.x, 1.6, PARTY.z]} size={4} speed={0.4} color="#ff9ad0" />
      <SpotLabel position={[PARTY.x, 2.9, PARTY.z]} text="🎂 AX 파티 테이블" />
    </group>
  )
}
