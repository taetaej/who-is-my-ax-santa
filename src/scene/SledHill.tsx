import { useMemo } from 'react'
import * as THREE from 'three'
import { RecordBoard } from './Boards'
import { M } from './materials'
import { Snowman } from './props'
import { SpotLabel } from './Spots'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SLED, SLED_OBSTACLES, SLED_ROT, STAIRS, groundY, sledPoint, sledProfile, stairY } from './world'

// 🛷 AX 썰매 레이스: 넓은 산(네 줄), 출발 현수막, 범퍼 눈더미, 점프대, 눈사람·선물상자 숲, 거리 표지판, 깃발, 타는 곳. 높이 계산은 world.ts 의 groundY 와 같다.

const SLED_RED = new THREE.MeshStandardMaterial({ color: '#c8352b', roughness: 0.5 })
const RUNNER = new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.3, metalness: 0.7 })
// 바닥 위에 확실히 그려지게 (겹치면 깜빡인다)
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

const WOOD = new THREE.MeshStandardMaterial({ color: '#8a5a35', roughness: 0.85 })
const WOOD_DARK = new THREE.MeshStandardMaterial({ color: '#5e3b22', roughness: 0.9 })

/** 산과 같은 방향으로 놓인 상자 하나 (s·w 자리, 높이 y0~y1) */
function slab(s0: number, s1: number, w0: number, w1: number, y0: number, y1: number) {
  const c = sledPoint((s0 + s1) / 2, (w0 + w1) / 2)
  const g = new THREE.BoxGeometry(Math.abs(w1 - w0), Math.max(0.02, y1 - y0), Math.abs(s1 - s0))
  g.rotateY(SLED_ROT)
  g.translate(c.x, (y0 + y1) / 2, c.z)
  return g
}

/** 🪜 산 옆 나무 계단 + 손잡이 + 꼭대기 나무 다리 */
function Stairs() {
  const geo = useMemo(() => {
    const steps: THREE.BufferGeometry[] = []
    const rails: THREE.BufferGeometry[] = []
    const n = STAIRS.steps
    const run = (STAIRS.from - STAIRS.to) / n
    for (let i = 0; i < n; i++) {
      const s1 = STAIRS.from - i * run
      const s0 = s1 - run
      const y = stairY(s0 + 0.001)
      // 계단 한 칸: 얇은 디딤판 (밑이 뚫린 가벼운 나무 계단)
      steps.push(slab(s0, s1, STAIRS.w - STAIRS.half, STAIRS.w + STAIRS.half, y - 0.14, y))
      // 네 칸마다 디딤판 밑 받침 기둥
      if (i % 4 === 2) for (const side of [-1, 1]) {
        const w = STAIRS.w + side * (STAIRS.half - 0.1)
        rails.push(slab(s0 + run / 2 - 0.06, s0 + run / 2 + 0.06, w - 0.06, w + 0.06, 0, y - 0.14))
      }
    }
    // 꼭대기 나무 다리 (계단 위 → 출발선)
    steps.push(slab(-SLED.deck, STAIRS.to + 0.4, SLED.track, STAIRS.w + STAIRS.half, SLED.h - 0.18, SLED.h))
    // 다리 밑 기둥
    for (const w of [SLED.track + 1.2, STAIRS.w]) for (const s of [-SLED.deck + 0.15, STAIRS.to + 0.25]) rails.push(slab(s - 0.08, s + 0.08, w - 0.08, w + 0.08, 0, SLED.h))
    // 손잡이: 계단 양옆으로 기둥과 난간
    for (const side of [-1, 1]) {
      const w = STAIRS.w + side * (STAIRS.half - 0.04)
      for (let i = 0; i <= n; i += 3) {
        const s = STAIRS.from - i * run - 0.05
        const y = stairY(s)
        rails.push(slab(s - 0.04, s + 0.04, w - 0.04, w + 0.04, y, y + 0.75))
      }
      // 난간(위)과 디딤판을 받치는 옆판(아래): 비스듬한 막대
      const a = sledPoint(STAIRS.from, w)
      const b = sledPoint(STAIRS.to, w)
      for (const [ya, yb, r] of [
        [0.75, SLED.h + 0.75, 0.035],
        [-0.05, SLED.h - 0.25, 0.08],
      ] as const) {
        const len = Math.hypot(b.x - a.x, yb - ya, b.z - a.z)
        const bar = new THREE.CylinderGeometry(r, r, len, 6)
        const dir = new THREE.Vector3(b.x - a.x, yb - ya, b.z - a.z).normalize()
        bar.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))
        bar.translate((a.x + b.x) / 2, (ya + yb) / 2, (a.z + b.z) / 2)
        rails.push(bar)
      }
    }
    // 다리 바깥쪽 난간
    rails.push(slab(-SLED.deck, STAIRS.to + 0.4, STAIRS.w + STAIRS.half - 0.05, STAIRS.w + STAIRS.half, SLED.h, SLED.h + 0.7))
    return { steps: mergeGeometries(steps.map((g) => g.toNonIndexed()))!, rails: mergeGeometries(rails.map((g) => (g.index ? g.toNonIndexed() : g)))! }
  }, [])
  return (
    <group>
      <mesh geometry={geo.steps} material={WOOD} castShadow receiveShadow />
      <mesh geometry={geo.rails} material={WOOD_DARK} castShadow />
    </group>
  )
}

/** 언덕 겉면: 격자를 만들고 높이를 groundY 로 올린다 (w0~w1 띠) */
function useHillGeometry(from: number, to: number, w0: number, w1: number, lift = 0, wn = 18) {
  return useMemo(() => {
    const sn = 110
    const g = new THREE.PlaneGeometry(1, 1, wn, sn)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5 // 0..1 옆
      const v = pos.getY(i) + 0.5 // 0..1 앞뒤
      const s = from + (to - from) * v
      const w = w0 + (w1 - w0) * u
      const p = sledPoint(s, w)
      pos.setXYZ(i, p.x, groundY(p.x, p.z) + lift, p.z)
    }
    g.computeVertexNormals() // 옆(w) × 앞(s) 순서라 겉면이 위를 본다
    return g
  }, [from, to, w0, w1, lift, wn])
}

/** 캔버스 글씨 텍스처 (출발 현수막, 거리 표지판) */
function textTexture(text: string, w: number, h: number, bg: string, fg: string, font: string) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#ffd86b'
  g.fillRect(0, 0, w, h * 0.07)
  g.fillRect(0, h * 0.93, w, h * 0.07)
  g.fillStyle = fg
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, h * 0.54)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const LANE = new THREE.MeshStandardMaterial({ color: '#9fc0ef', roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })
const GIFT_RED = new THREE.MeshStandardMaterial({ color: '#d2392f', roughness: 0.55 })
const GIFT_GREEN = new THREE.MeshStandardMaterial({ color: '#2e7d4f', roughness: 0.55 })
const RIBBON = new THREE.MeshStandardMaterial({ color: '#f4c542', roughness: 0.35, metalness: 0.3 })
const PILLOW = new THREE.MeshStandardMaterial({ color: '#f7fbff', roughness: 0.8 })
const PILLOW_RING = new THREE.MeshStandardMaterial({ color: '#ff5a6a', emissive: '#ff3050', emissiveIntensity: 0.5, roughness: 0.4 })

/** 🎁 선물상자 탑 (박으면 끝) */
function GiftStack({ rot }: { rot: number }) {
  return (
    <group rotation={[0, rot, 0]}>
      <mesh position={[0, 0.26, 0]} material={GIFT_RED} castShadow>
        <boxGeometry args={[0.6, 0.52, 0.6]} />
      </mesh>
      <mesh position={[0.04, 0.72, 0]} rotation={[0, 0.5, 0]} material={GIFT_GREEN} castShadow>
        <boxGeometry args={[0.42, 0.4, 0.42]} />
      </mesh>
      {[0, Math.PI / 2].map((r) => (
        <group key={r} rotation={[0, r, 0]}>
          <mesh position={[0, 0.26, 0]} material={RIBBON}>
            <boxGeometry args={[0.62, 0.53, 0.09]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.04, 0.98, 0]} rotation={[0, 0.5, Math.PI / 4]} material={RIBBON}>
        <torusGeometry args={[0.1, 0.03, 6, 14]} />
      </mesh>
    </group>
  )
}

/** 🎈 범퍼 눈더미: 통통한 눈 방석에 빨간 띠 (부딪히면 옆으로 튕긴다) */
function Bumper() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[1, 0.55, 1]} material={PILLOW} castShadow receiveShadow>
        <sphereGeometry args={[0.55, 20, 12]} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={PILLOW_RING}>
        <torusGeometry args={[0.5, 0.06, 8, 28]} />
      </mesh>
    </group>
  )
}

export function SledHill({ boards = false }: { boards?: boolean }) {
  const hill = useHillGeometry(-SLED.deck - SLED.back, SLED.len, -SLED.half, SLED.half, 0, 28)
  const track = useHillGeometry(-SLED.deck, SLED.len + SLED.run, -SLED.track, SLED.track, 0.03, 20)
  // 줄 구분선 세 개 (네 줄)
  const laneA = useHillGeometry(0, SLED.len + SLED.run, -1.32, -1.26, 0.05, 1)
  const laneB = useHillGeometry(0, SLED.len + SLED.run, -0.03, 0.03, 0.05, 1)
  const laneC = useHillGeometry(0, SLED.len + SLED.run, 1.26, 1.32, 0.05, 1)
  const flags = useMemo(() => {
    const out: { x: number; z: number; y: number; i: number }[] = []
    for (let k = 0; k < 17; k++) {
      const s = -0.6 + k * 1.7
      for (const side of [-1, 1]) {
        const p = sledPoint(s, side * (SLED.track + 0.3))
        out.push({ ...p, y: groundY(p.x, p.z), i: (k * 2 + (side > 0 ? 1 : 0)) % FLAG_COLORS.length })
      }
    }
    return out
  }, [])
  const banner = useMemo(
    () => new THREE.MeshStandardMaterial({ map: textTexture('🛷 AX SLED RACE 🛷', 1024, 128, '#1d2a63', '#ffffff', '900 76px "Pretendard", "Apple SD Gothic Neo", sans-serif'), side: THREE.DoubleSide, roughness: 0.6 }),
    [],
  )
  const marks = useMemo(
    () =>
      [15, 20, 25].map((m) => ({
        m,
        p: sledPoint(m, -(SLED.track + 1.0)),
        mat: new THREE.MeshStandardMaterial({ map: textTexture(`${m}m`, 256, 128, '#c8302a', '#ffffff', '900 72px "Pretendard", sans-serif'), side: THREE.DoubleSide }),
      })),
    [],
  )
  const board = sledPoint(SLED.len + SLED.gate + 1.6, SLED.track + 3.4)
  const gate = sledPoint(SLED.len + SLED.gate, SLED.track + 1.2)
  const label = sledPoint(-SLED.deck * 0.5)
  const lip = sledPoint(SLED.jump - 0.05)
  const start = sledPoint(-0.15)
  const startY = sledProfile(-0.15)
  const parked = [0, 1, 2].map((i) => sledPoint(SLED.len + SLED.gate - 0.5 + i * 0.6, -(SLED.track + 1.0)))
  return (
    <group>
      <mesh geometry={hill} material={M.snow} receiveShadow castShadow />
      <mesh geometry={track} material={TRACK} receiveShadow />
      {[laneA, laneB, laneC].map((g, i) => (
        <mesh key={i} geometry={g} material={LANE} />
      ))}
      <Stairs />
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
      {/* 꼭대기 출발 아치: 지팡이 사탕 기둥 두 개 + "AX SLED RACE" 현수막 */}
      {[-1, 1].map((side) => {
        const p = sledPoint(-0.15, side * (SLED.track + 0.2))
        return (
          <group key={side} position={[p.x, startY, p.z]}>
            <mesh position={[0, 1.35, 0]} material={POLE}>
              <cylinderGeometry args={[0.08, 0.08, 2.7, 10]} />
            </mesh>
            {[0.3, 0.75, 1.2, 1.65, 2.1, 2.55].map((y) => (
              <mesh key={y} position={[0, y, 0]} material={STRIPE}>
                <cylinderGeometry args={[0.084, 0.084, 0.16, 10]} />
              </mesh>
            ))}
            <mesh position={[0, 2.82, 0]} material={M.gold}>
              <sphereGeometry args={[0.14, 12, 10]} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[start.x, startY + 2.25, start.z]} rotation={[0, SLED_ROT, 0]} material={banner}>
        <planeGeometry args={[SLED.track * 2 + 0.2, 0.62]} />
      </mesh>
      {/* 점프대 끝: 빨간 줄 */}
      <mesh position={[lip.x, SLED.jumpH + 0.04, lip.z]} rotation={[0, SLED_ROT, 0]} material={STRIPE}>
        <boxGeometry args={[SLED.track * 2, 0.06, 0.14]} />
      </mesh>
      {/* 장애물: 눈사람·선물상자(박으면 끝), 범퍼 눈더미(통!) */}
      {SLED_OBSTACLES.map((o, i) => {
        const p = sledPoint(o.s, o.w)
        const y = groundY(p.x, p.z)
        return (
          <group key={i} position={[p.x, y, p.z]}>
            {o.kind === 'snowman' ? (
              <Snowman position={[0, 0, 0]} rotation={SLED_ROT + Math.PI} scale={0.7} />
            ) : o.kind === 'gift' ? (
              <GiftStack rot={i * 0.7} />
            ) : (
              <Bumper />
            )}
          </group>
        )
      })}
      {/* 거리 표지판 */}
      {marks.map(({ m, p, mat }) => (
        <group key={m} position={[p.x, 0, p.z]} rotation={[0, SLED_ROT + Math.PI / 2, 0]}>
          <mesh position={[0, 0.5, 0]} material={POLE}>
            <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
          </mesh>
          <mesh position={[0, 1.05, 0]} material={mat}>
            <planeGeometry args={[0.7, 0.35]} />
          </mesh>
        </group>
      ))}
      {/* 타는 곳에 세워 둔 썰매 */}
      {parked.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, SLED_ROT + 0.3 * (i - 1), 0]}>
          <Sled />
        </group>
      ))}
      <SpotLabel position={[label.x, SLED.h + 3.6, label.z]} text="🛷 AX 썰매 레이스 · 여럿이 같이!" />
      <SpotLabel position={[gate.x, 1.4, gate.z]} text="🛷 타는 곳 · 🪜 계단으로" />
      {boards && <RecordBoard kind="sled" footer="Space 연타 · ←→ 줄 고르기 · 쿵쿵 범퍼카!" position={[board.x, 0, board.z]} rotation={0.2} />}
    </group>
  )
}
