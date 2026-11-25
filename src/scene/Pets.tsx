import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { CookieState } from './Cookie'
import { poseAt, tour } from './petPath'

// 🐈🐕 마을 고양이·강아지. 마을 안 안전한 자리들을 이어 천천히 걷다가 앉아 쉰다.
// 움직임은 벽시계(Date.now) 로만 정해져서, 마을에 있는 모두의 화면에서 같은 자리에 있다 (따로 주고받지 않는다).
// 내 쿠키가 가까이 오면 쳐다보고 하트와 "냥~" / "멍!".

type Kind = 'cat' | 'dog'
type PetDef = { id: number; kind: Kind; name: string; fur: string; fur2: string; ear?: string; seed: number }

const PETS: PetDef[] = [
  { id: 0, kind: 'cat', name: '귤냥이', fur: '#f0a04b', fur2: '#fff3e2', seed: 11 },
  { id: 1, kind: 'cat', name: '까망이', fur: '#2f2c3a', fur2: '#f4f4f8', seed: 23 },
  { id: 2, kind: 'dog', name: '시바', fur: '#e0a15c', fur2: '#fff6ea', ear: '#c9853e', seed: 37 },
  { id: 3, kind: 'dog', name: '몽실이', fur: '#f7f5f0', fur2: '#ffffff', ear: '#e9ddd0', seed: 53 },
]

const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
const EYE = new THREE.MeshStandardMaterial({ color: '#1d1a26', roughness: 0.3 })
const NOSE = new THREE.MeshStandardMaterial({ color: '#f08aa0', roughness: 0.5 })
const DOGNOSE = new THREE.MeshStandardMaterial({ color: '#2a2230', roughness: 0.4 })
const COLLAR = new THREE.MeshStandardMaterial({ color: '#c8372d', roughness: 0.5 })
const BELL = new THREE.MeshStandardMaterial({ color: '#f4c14e', roughness: 0.3, metalness: 0.6 })

function Pet({ def, me }: { def: PetDef; me: MutableRefObject<CookieState | null> }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const legs = useRef<THREE.Group>(null)
  const path = useMemo(() => tour(def.seed), [def.seed])
  const m = useMemo(() => ({ fur: mat(def.fur), fur2: mat(def.fur2), ear: mat(def.ear ?? def.fur) }), [def])
  const [say, setSay] = useState<{ text: string; n: number } | null>(null)
  const lastSay = useRef(-100)
  const rot = useRef(0)
  const cat = def.kind === 'cat'

  useFrame(({ clock }, dt) => {
    const g = root.current
    if (!g) return
    const p = poseAt(path, Date.now() / 1000, def.id * 2.3)
    const t = clock.elapsedTime
    const s = me.current
    const near = s ? Math.hypot(s.x - p.x, s.z - p.z) : 99
    // 가까이 오면 걸음을 멈추고(제자리 표시만) 쳐다본다
    let want = p.rot
    if (near < 1.9 && s) want = Math.atan2(s.x - p.x, s.z - p.z)
    let dr = want - rot.current
    dr = Math.atan2(Math.sin(dr), Math.cos(dr))
    rot.current += dr * Math.min(1, dt * 6)
    g.position.set(p.x, 0, p.z)
    g.rotation.y = rot.current
    const walking = p.walking && near >= 1.9
    // 걷기: 통통 + 다리 흔들기 / 쉬기: 앉아서 숨쉬기
    if (body.current) {
      body.current.position.y = walking ? Math.abs(Math.sin(t * 9)) * 0.025 : 0
      body.current.rotation.x = walking ? 0 : cat ? -0.25 : -0.18
      body.current.scale.y = 1 + Math.sin(t * 2.2) * 0.015
    }
    if (legs.current)
      legs.current.children.forEach((l, i) => {
        l.rotation.x = walking ? Math.sin(t * 9 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5 : 0
      })
    if (tail.current) {
      const wag = !cat && near < 2.5 ? 14 : cat ? 2 : 5
      tail.current.rotation.z = Math.sin(t * wag) * (cat ? 0.25 : 0.45)
    }
    if (head.current) head.current.rotation.z = near < 1.9 ? Math.sin(t * 1.6) * 0.18 : 0 // 갸웃
    if (say && t - lastSay.current > 2.4) setSay(null)
    if (near < 1.6 && t - lastSay.current > 5) {
      lastSay.current = t
      const lines = cat ? ['냥~ 💕', '냐앙?', '골골골… 💕'] : ['멍! 💕', '왈왈! 🐾', '헥헥 💕']
      setSay({ text: lines[Math.floor(Math.random() * lines.length)], n: (say?.n ?? 0) + 1 })
    }
  })

  const sz = cat ? 1.3 : 1.45
  return (
    <group ref={root}>
      <group scale={sz}>
        <group ref={body}>
          {/* 몸통 + 배 */}
          <mesh position={[0, 0.2, 0]} scale={[0.17, 0.14, 0.26]} material={m.fur} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          <mesh position={[0, 0.17, 0.06]} scale={[0.12, 0.1, 0.17]} material={m.fur2}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
          {/* 머리 */}
          <group ref={head} position={[0, 0.36, 0.24]}>
            <mesh scale={cat ? [0.15, 0.13, 0.13] : [0.15, 0.14, 0.14]} material={m.fur} castShadow>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
            {/* 입가 (흰 털) */}
            <mesh position={[0, -0.04, cat ? 0.1 : 0.11]} scale={cat ? [0.08, 0.05, 0.05] : [0.08, 0.06, 0.08]} material={m.fur2}>
              <sphereGeometry args={[1, 12, 8]} />
            </mesh>
            <mesh position={[0, -0.01, cat ? 0.145 : 0.18]} material={cat ? NOSE : DOGNOSE}>
              <sphereGeometry args={[cat ? 0.016 : 0.022, 8, 6]} />
            </mesh>
            {[-1, 1].map((sx) => (
              <mesh key={sx} position={[sx * 0.06, 0.03, 0.115]} material={EYE}>
                <sphereGeometry args={[0.02, 8, 6]} />
              </mesh>
            ))}
            {/* 귀: 고양이는 뾰족, 강아지는 늘어진 귀 */}
            {[-1, 1].map((sx) =>
              cat ? (
                <mesh key={sx} position={[sx * 0.085, 0.12, 0]} rotation={[0, 0, -sx * 0.25]} material={m.fur}>
                  <coneGeometry args={[0.05, 0.09, 4]} />
                </mesh>
              ) : (
                <mesh key={sx} position={[sx * 0.13, 0.02, -0.01]} rotation={[0, 0, sx * 0.35]} scale={[0.04, 0.08, 0.06]} material={m.ear}>
                  <sphereGeometry args={[1, 10, 8]} />
                </mesh>
              ),
            )}
          </group>
          {/* 빨간 목걸이 + 금방울 */}
          <mesh position={[0, 0.27, 0.19]} rotation={[0.5, 0, 0]} material={COLLAR}>
            <torusGeometry args={[0.085, 0.014, 6, 16]} />
          </mesh>
          <mesh position={[0, 0.22, 0.25]} material={BELL}>
            <sphereGeometry args={[0.022, 8, 6]} />
          </mesh>
          {/* 꼬리 */}
          <group ref={tail} position={[0, 0.24, -0.24]}>
            <mesh position={[0, cat ? 0.12 : 0.06, -0.03]} rotation={[cat ? -0.25 : -0.9, 0, 0]} material={m.fur}>
              <capsuleGeometry args={[cat ? 0.022 : 0.035, cat ? 0.22 : 0.1, 4, 8]} />
            </mesh>
          </group>
        </group>
        {/* 다리 넷 */}
        <group ref={legs}>
          {[
            [-0.08, 0.13],
            [0.08, 0.13],
            [-0.08, -0.13],
            [0.08, -0.13],
          ].map(([x, z], i) => (
            <group key={i} position={[x, 0.12, z]}>
              <mesh position={[0, -0.06, 0]} material={i < 2 ? m.fur2 : m.fur}>
                <capsuleGeometry args={[0.032, 0.08, 4, 8]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      {say && (
        <Html key={say.n} position={[0, 0.85, 0]} center distanceFactor={8} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div className="pet-say">{say.text}</div>
        </Html>
      )}
    </group>
  )
}

export function Pets({ me }: { me: MutableRefObject<CookieState | null> }) {
  return (
    <group>
      {PETS.map((p) => (
        <Pet key={p.id} def={p} me={me} />
      ))}
    </group>
  )
}
