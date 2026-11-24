import { useMemo } from 'react'
import * as THREE from 'three'
import { M } from './materials'
import { SpotLabel } from './Spots'
import { SLED, SLED_ROT, groundY, sledPoint, sledProfile } from './world'

// 🛷 AX 눈썰매장: 언덕, 썰매 길, 깃발, 타는 곳 썰매 더미. 높이 계산은 world.ts 의 groundY 와 같다.

const SLED_RED = new THREE.MeshStandardMaterial({ color: '#c8352b', roughness: 0.5 })
const RUNNER = new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.3, metalness: 0.7 })
const TRACK = new THREE.MeshStandardMaterial({ color: '#e4ecf7', roughness: 0.35 })
const FLAG_COLORS = ['#c62a24', '#2e7d4f', '#e0a21a', '#2f62b0'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide }))
const POLE = new THREE.MeshStandardMaterial({ color: '#f6f1e7', roughness: 0.5 })
const STRIPE = new THREE.MeshStandardMaterial({ color: '#c8231f', roughness: 0.5 })

/** 빨간 나무 썰매 (앞이 +z). 쿠키가 탈 때도 같은 모양을 쓴다 */
export function Sled({ mat = SLED_RED }: { mat?: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.09, -0.02]} material={mat} castShadow>
        <boxGeometry args={[0.42, 0.05, 0.62]} />
      </mesh>
      {/* 앞쪽 들린 부분 */}
      <mesh position={[0, 0.14, 0.31]} rotation={[-0.7, 0, 0]} material={mat}>
        <boxGeometry args={[0.42, 0.05, 0.16]} />
      </mesh>
      {[-0.17, 0.17].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.03, 0]} material={RUNNER}>
            <boxGeometry args={[0.035, 0.03, 0.72]} />
          </mesh>
          <mesh position={[x, 0.09, 0.36]} rotation={[Math.PI / 2, 0, Math.PI / 2]} material={RUNNER}>
            <torusGeometry args={[0.06, 0.016, 6, 12, Math.PI]} />
          </mesh>
          {[-0.18, 0.18].map((z) => (
            <mesh key={z} position={[x, 0.055, z]} material={RUNNER}>
              <boxGeometry args={[0.03, 0.05, 0.03]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** 언덕 겉면: 격자를 만들고 높이를 groundY 로 올린다 */
function useHillGeometry(from: number, to: number, half: number, lift = 0) {
  return useMemo(() => {
    const sn = 48
    const wn = 18
    const g = new THREE.PlaneGeometry(1, 1, wn, sn)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5 // 0..1 옆
      const v = pos.getY(i) + 0.5 // 0..1 앞뒤
      const s = from + (to - from) * v
      const w = -half + 2 * half * u
      const p = sledPoint(s, w)
      pos.setXYZ(i, p.x, groundY(p.x, p.z) + lift, p.z)
    }
    g.computeVertexNormals() // 옆(w) × 앞(s) 순서라 겉면이 위를 본다
    return g
  }, [from, to, half, lift])
}

export function SledHill() {
  const hill = useHillGeometry(-SLED.deck - SLED.back, SLED.len, SLED.half)
  const track = useHillGeometry(-SLED.deck, SLED.len + SLED.run, SLED.track, 0.012)
  const flags = useMemo(() => {
    const out: { x: number; z: number; y: number; i: number }[] = []
    for (let k = 0; k < 6; k++) {
      const s = -0.4 + k * 1.05
      for (const side of [-1, 1]) {
        const p = sledPoint(s, side * (SLED.track + 0.25))
        out.push({ ...p, y: groundY(p.x, p.z), i: (k * 2 + (side > 0 ? 1 : 0)) % FLAG_COLORS.length })
      }
    }
    return out
  }, [])
  const gate = sledPoint(SLED.len + SLED.gate + 0.2, SLED.track + 0.9)
  const label = sledPoint(-SLED.deck * 0.5)
  const parked = [0, 1, 2].map((i) => sledPoint(SLED.len + SLED.gate - 0.3 + i * 0.5, SLED.track + 1.5))
  return (
    <group>
      <mesh geometry={hill} material={M.snow} receiveShadow castShadow />
      <mesh geometry={track} material={TRACK} receiveShadow />
      {flags.map((f, i) => (
        <group key={i} position={[f.x, f.y, f.z]}>
          <mesh position={[0, 0.35, 0]} material={POLE}>
            <cylinderGeometry args={[0.025, 0.025, 0.7, 6]} />
          </mesh>
          <mesh position={[0, 0.6, 0.12]} rotation={[0, Math.PI / 2, 0]} material={FLAG_COLORS[f.i]}>
            <planeGeometry args={[0.24, 0.16]} />
          </mesh>
        </group>
      ))}
      {/* 꼭대기 출발 아치: 지팡이 사탕 기둥 두 개 */}
      {[-1, 1].map((side) => {
        const p = sledPoint(-0.15, side * (SLED.track + 0.15))
        return (
          <group key={side} position={[p.x, sledProfile(-0.15), p.z]}>
            <mesh position={[0, 0.6, 0]} material={POLE}>
              <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
            </mesh>
            {[0.2, 0.55, 0.9].map((y) => (
              <mesh key={y} position={[0, y, 0]} material={STRIPE}>
                <cylinderGeometry args={[0.053, 0.053, 0.1, 8]} />
              </mesh>
            ))}
          </group>
        )
      })}
      {/* 타는 곳에 세워 둔 썰매 */}
      {parked.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, SLED_ROT + 0.3 * (i - 1), 0]}>
          <Sled />
        </group>
      ))}
      <SpotLabel position={[label.x, SLED.h + 1.6, label.z]} text="🛷 AX 눈썰매장" />
      <SpotLabel position={[gate.x, 1.4, gate.z]} text="🛷 타는 곳" />
    </group>
  )
}
