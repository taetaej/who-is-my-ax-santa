import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { api, type SledBoard as SledBoardData } from '../api'
import { emotes } from './emote'
import { M } from './materials'
import { sledRecord } from './sledRide'
import { TextSign, type TextLine } from './TextSign'
import { SpotLabel } from './Spots'
import { SLED, SLED_ROT, groundY, sledPoint, sledProfile } from './world'

// 🛷 AX 눈썰매장: 언덕, 썰매 길, 깃발, 타는 곳 썰매 더미. 높이 계산은 world.ts 의 groundY 와 같다.

const SLED_RED = new THREE.MeshStandardMaterial({ color: '#c8352b', roughness: 0.5 })
const RUNNER = new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.3, metalness: 0.7 })
// 광장 돌길(바닥에서 0.012~0.016) 위를 지나가니 그보다 확실히 위에, 그리고 앞에 그려지게 (겹치면 깜빡인다)
const TRACK = new THREE.MeshStandardMaterial({ color: '#e4ecf7', roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
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
  const track = useHillGeometry(-SLED.deck, SLED.len + SLED.run, SLED.track, 0.03)
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

const BOARD_POST = new THREE.MeshStandardMaterial({ color: '#6a4428', roughness: 0.8 })
const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.']

/** 🏆 썰매 기록판: 타는 곳 옆 나무 판. 다 타고 나면 기록을 올리고 판을 새로 그린다 */
export function SledBoard() {
  const [board, setBoard] = useState<SledBoardData | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => void api.sled().then((b) => alive && setBoard(b)).catch(() => {})
    load()
    const t = setInterval(load, 30_000)
    sledRecord.finish = (dist, crashed) => {
      void api
        .sledRun(dist)
        .then((b) => {
          if (!alive) return
          setBoard(b)
          const me = b.mine
          if (b.newBest && me) emotes.toast?.(`🏆 ${crashed ? '박았지만 ' : ''}내 최고 기록 ${b.dist}m! 지금 ${me.rank}위`)
          else if (me) emotes.toast?.(`🛷 ${b.dist}m · 내 최고 ${me.best}m (${me.rank}위)`)
        })
        .catch(() => {})
    }
    return () => {
      alive = false
      clearInterval(t)
      sledRecord.finish = null
    }
  }, [])

  const lines: TextLine[] = [
    { text: '🏆 썰매 기록판', size: 0.16, color: '#ffe7a8', weight: 900, kr: true, gap: 0.06 },
    ...(board?.top.length
      ? board.top.map((r, i) => ({ text: `${MEDALS[i]} ${r.name}  ${r.best.toFixed(1)}m`, size: 0.12, color: r.me ? '#ffcf4a' : '#ffffff', weight: 800, kr: true, gap: 0.03 }))
      : [{ text: '아직 기록이 없어요', size: 0.11, color: '#ffffff', kr: true }]),
    ...(board?.mine && board.mine.rank > 5 ? [{ text: `나 ${board.mine.rank}위 ${board.mine.best.toFixed(1)}m`, size: 0.1, color: '#ffcf4a', weight: 800, kr: true, gap: 0.04 }] : []),
    { text: 'Space 연타 · 가로등 조심!', size: 0.085, color: '#c9d6ff', kr: true, gap: 0.06 },
  ]
  const p = sledPoint(SLED.len + SLED.gate + 0.3, -(SLED.track + 1.5))
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, -0.35, 0]}>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.75, -0.03]} material={BOARD_POST} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 1.5, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, -0.04]} material={BOARD_POST} castShadow>
        <boxGeometry args={[1.75, 1.15, 0.05]} />
      </mesh>
      <TextSign lines={lines} w={1.65} h={1.05} position={[0, 1.2, 0]} bg="#2b2238" radius={0.06} glow />
    </group>
  )
}
