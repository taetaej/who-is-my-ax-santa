import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { DIG_HITS, GLINT_RANGE, SPOTS, spot, type Kind, type Spot } from '../treasure'
import type { CookieState } from './Cookie'
import { M, rng } from './materials'
import { onSledRun, resolve } from './world'
import { Bow, Present } from './props'

// 🎀 보물찾기: 마을 곳곳에 숨은 선물 (진짜와 꽝이 똑같이 생겼다).
// - hidden: 아직 열 수 있는 자리. 장소에 어울리는 모양(상자·양말·쿠키 통·꾸러미·눈더미·오너먼트·얼음)
// - duds: 내가 열어 본 꽝 → 빈 상자로 남는다 (나에게만)
// - glow: 구제 기간에 남은 진짜 → 둥실 + 후광 + 반짝
// - 가까이 가면(GLINT_RANGE) 살짝 반짝인다. 눈더미·얼음은 E 를 누를 때마다 깎여 나간다 (dig)
// - burst: 방금 연 자리에서 터지는 반짝이 (진짜는 금빛, 꽝은 회색 연기)

export type Burst = { spot: string; kind: 'gift' | 'dud'; key: number }

export function GiftBoxes({
  hidden,
  duds,
  glow,
  dig,
  me,
  burst,
}: {
  hidden: readonly string[]
  duds: readonly string[]
  glow: readonly string[]
  dig: MutableRefObject<Map<string, number>>
  me: MutableRefObject<CookieState | null>
  burst: Burst | null
}) {
  const glowSet = useMemo(() => new Set(glow), [glow])
  // 가까운 자리 (0.3초마다 다시 계산, 바뀔 때만 다시 그린다)
  const [near, setNear] = useState<string[]>([])
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.3) return
    last.current = clock.elapsedTime
    const m = me.current
    const next = m
      ? hidden.filter((id) => {
          const s = spot(id)
          return !!s && Math.hypot(s.x - m.x, s.z - m.z) < GLINT_RANGE
        })
      : []
    if (next.join() !== near.join()) setNear(next)
  })

  return (
    <group>
      {hidden.map((id) => {
        const s = spot(id)
        return s ? <Hidden key={id} s={s} index={SPOTS.indexOf(s)} glow={glowSet.has(id)} glint={near.includes(id)} dig={dig} /> : null
      })}
      {duds.map((id) => {
        const s = spot(id)
        return s ? <EmptyBox key={id} s={s} /> : null
      })}
      {burst && <BurstFx key={burst.key} burst={burst} />}
    </group>
  )
}

function Hidden({ s, index, glow, glint, dig }: { s: Spot; index: number; glow: boolean; glint: boolean; dig: MutableRefObject<Map<string, number>> }) {
  const ref = useRef<THREE.Group>(null)
  const cover = useRef<THREE.Group>(null) // 눈더미·얼음 (파낼수록 작아진다)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index * 0.7
    if (ref.current) {
      ref.current.position.y = glow ? 0.25 + Math.sin(t * 2.4) * 0.12 : 0
      if (s.kind === 'ornament') ref.current.rotation.z = Math.sin(t * 1.3) * 0.12 // 바람에 살랑
    }
    if (cover.current) {
      const left = 1 - (dig.current.get(s.id) ?? 0) / DIG_HITS
      const k = THREE.MathUtils.lerp(cover.current.scale.x, Math.max(0.25, left), 0.2)
      cover.current.scale.set(k, k, k)
    }
  })
  return (
    <group position={[s.x, 0, s.z]} rotation={[0, index * 1.37, 0]}>
      <group ref={ref}>
        <Shape kind={s.kind} m={index} y={s.y ?? 0} cover={cover} />
      </group>
      {glint && !glow && <Sparkles count={7} scale={[0.9, 0.9, 0.9]} position={[0, (s.y ?? 0) + 0.45, 0]} size={3} speed={0.6} color="#fff3c4" />}
      {glow && (
        <>
          {/* 진짜 조명은 늘어날수록 모든 재질을 다시 컴파일해서 느려진다 → 밝은 후광 + 블룸으로 빛나 보이게 */}
          <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.38, 0.62, 32]} />
            <meshBasicMaterial color={[3, 2.3, 0.8]} toneMapped={false} transparent opacity={0.85} />
          </mesh>
          <Sparkles count={14} scale={[1.1, 1.3, 1.1]} position={[0, 0.7, 0]} size={4} speed={0.5} color="#ffe28a" />
        </>
      )}
    </group>
  )
}

const iceMat = new THREE.MeshStandardMaterial({ color: '#bfe6fb', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 })
const glassMat = new THREE.MeshStandardMaterial({ color: '#e8f6ff', roughness: 0.05, transparent: true, opacity: 0.35 })
const cuffMat = new THREE.MeshStandardMaterial({ color: '#fbfdff', roughness: 0.95 })
const sackMats = [M.presents[2], M.presents[0], M.wood] // 흰색·초록·갈색: 주변에 섞이는 색
const sockMats = [M.presents[2], M.presents[0]]
const QUIET = [0, 2] // 상자 색: 초록, 크림 (빨강·금색은 너무 눈에 띈다)

function Shape({ kind, m, y, cover }: { kind: Kind; m: number; y: number; cover: MutableRefObject<THREE.Group | null> }) {
  switch (kind) {
    case 'box':
      return <Present position={[0, 0, 0]} size={0.32} m={QUIET[m % 2]} />
    case 'sock': // 크리스마스 양말 (누워 있음)
      return (
        <group position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2 - 0.15]}>
          <mesh position={[0, 0.1, 0]} material={sockMats[m % 2]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.34, 12]} />
          </mesh>
          <mesh position={[0.08, -0.1, 0]} rotation={[0, 0, Math.PI / 2]} material={sockMats[m % 2]} castShadow>
            <capsuleGeometry args={[0.1, 0.14, 4, 10]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={cuffMat}>
            <cylinderGeometry args={[0.12, 0.12, 0.09, 12]} />
          </mesh>
        </group>
      )
    case 'jar': // 쿠키 통
      return (
        <group>
          <mesh position={[0, 0.2, 0]} material={glassMat}>
            <cylinderGeometry args={[0.17, 0.17, 0.4, 16]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[(i % 2) * 0.08 - 0.04, 0.05 + i * 0.075, 0]} rotation={[Math.PI / 2 - 0.3 + i * 0.2, 0, 0]} material={M.pot}>
              <cylinderGeometry args={[0.07, 0.07, 0.025, 12]} />
            </mesh>
          ))}
          <mesh position={[0, 0.43, 0]} material={M.ribbon}>
            <cylinderGeometry args={[0.18, 0.18, 0.06, 16]} />
          </mesh>
          <Bow position={[0, 0.48, 0]} scale={0.9} />
        </group>
      )
    case 'bundle': // 리본 묶은 꾸러미
      return (
        <group>
          <mesh position={[0, 0.2, 0]} scale={[1, 0.85, 1]} material={sackMats[m % 3]} castShadow>
            <sphereGeometry args={[0.24, 14, 10]} />
          </mesh>
          <mesh position={[0, 0.42, 0]} material={sackMats[m % 3]}>
            <coneGeometry args={[0.09, 0.14, 10]} />
          </mesh>
          <Bow position={[0, 0.4, 0.04]} scale={1.1} />
        </group>
      )
    case 'snow': // 눈더미에 완전히 파묻힘 (위장 눈더미와 똑같이 생겼다)
      return (
        <group>
          <group ref={cover}>
            <Mound size={moundSize(m)} />
          </group>
          <Present position={[0, 0, 0]} size={0.26} m={QUIET[m % 2]} />
        </group>
      )
    case 'ice': // 얼음 속에 얼어 있는 선물
      return (
        <group>
          <Present position={[0, 0.03, 0]} size={0.26} m={QUIET[m % 2]} />
          <group ref={cover}>
            <mesh position={[0, 0.22, 0]} rotation={[0.05, 0.3, -0.04]} material={iceMat}>
              <boxGeometry args={[0.55, 0.45, 0.5]} />
            </mesh>
          </group>
        </group>
      )
    case 'ornament': // 나뭇가지에 매달린 오너먼트
      return (
        <group position={[0, y, 0]}>
          <mesh position={[0, 0.16, 0]} material={M.gold}>
            <cylinderGeometry args={[0.004, 0.004, 0.3, 4]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={M.gold}>
            <cylinderGeometry args={[0.035, 0.035, 0.05, 8]} />
          </mesh>
          <mesh position={[0, -0.12, 0]} material={M.ornaments[m % 3]} castShadow>
            <sphereGeometry args={[0.14, 16, 12]} />
          </mesh>
        </group>
      )
  }
}

// ── 눈더미 ── 선물이 든 것과 위장용(아무것도 없음)이 똑같이 생겼다. 크기만 조금씩 다르다
const moundGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)
const moundSize = (i: number) => 0.85 + ((i * 37) % 10) * 0.04
function Mound({ size = 1 }: { size?: number }) {
  return <mesh geometry={moundGeo} scale={[0.55 * size, 0.34 * size, 0.5 * size]} material={M.snow} castShadow receiveShadow />
}

/** 위장 눈더미 20개: 마을 안 빈 땅에 흩어 둔다 (숨은 자리·건물·나무와 겹치지 않게) */
export function DecoyMounds() {
  const list = useMemo(() => {
    const rand = rng(77)
    const out: { x: number; z: number; rot: number; size: number }[] = []
    for (let tries = 0; out.length < 20 && tries < 600; tries++) {
      const a = rand() * Math.PI * 2
      const rad = 6.8 + rand() * 9
      const x = Math.cos(a) * rad
      const z = Math.sin(a) * rad
      const p = resolve(x, z, 0.6)
      if (Math.hypot(p.x - x, p.z - z) > 0.01) continue // 건물·나무·울타리와 겹침
      if (z > 15 && Math.abs(x) < 2.2) continue // 대문 길은 비운다
      if (onSledRun(x, z)) continue // 🛷 썰매 길도
      if (SPOTS.some((s) => Math.hypot(s.x - x, s.z - z) < 1.3)) continue
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 1.6)) continue
      out.push({ x, z, rot: rand() * 6, size: 0.85 + rand() * 0.4 })
    }
    return out
  }, [])
  return (
    <group>
      {list.map((d, i) => (
        <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]}>
          <Mound size={d.size} />
        </group>
      ))}
    </group>
  )
}

/** 열어 본 꽝: 뚜껑이 열린 빈 상자 (나에게만) */
function EmptyBox({ s }: { s: Spot }) {
  return (
    <group position={[s.x, 0, s.z]} rotation={[0, s.x * 3, 0]}>
      <mesh position={[0, 0.12, 0]} material={M.kraftLight}>
        <boxGeometry args={[0.36, 0.24, 0.36]} />
      </mesh>
      <mesh position={[0, 0.245, 0]} material={M.coal}>
        <boxGeometry args={[0.32, 0.01, 0.32]} />
      </mesh>
      <mesh position={[0.3, 0.03, 0.1]} rotation={[0, 0.5, 0]} material={M.kraftLight}>
        <boxGeometry args={[0.38, 0.05, 0.38]} />
      </mesh>
    </group>
  )
}

/** 방금 연 자리에서 터지는 조각들 (1.6초) */
function BurstFx({ burst }: { burst: Burst }) {
  const s = spot(burst.spot)
  const ref = useRef<THREE.Group>(null)
  const start = useRef<number | null>(null)
  const parts = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2
        return { vx: Math.cos(a) * (0.8 + (i % 3) * 0.4), vz: Math.sin(a) * (0.8 + (i % 4) * 0.3), vy: 2.2 + (i % 5) * 0.5, m: i % 4 }
      }),
    [],
  )
  const mats = useMemo(
    () =>
      burst.kind === 'gift'
        ? [M.bulbs[1], M.bulbs[0], M.glow, M.bulbs[2]]
        : [new THREE.MeshStandardMaterial({ color: '#9aa0a8', transparent: true, opacity: 0.7 })],
    [burst.kind],
  )
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime
    const t = clock.elapsedTime - start.current
    const g = ref.current
    if (!g) return
    g.visible = t < 1.6
    g.children.forEach((c, i) => {
      const p = parts[i]
      c.position.set(p.vx * t, (s?.y ?? 0) + 0.4 + p.vy * t - 4.5 * t * t, p.vz * t)
      c.rotation.set(t * 6 + i, t * 4, 0)
    })
  })
  if (!s) return null
  return (
    <group ref={ref} position={[s.x, 0, s.z]}>
      {parts.map((p, i) => (
        <mesh key={i} material={mats[p.m % mats.length]}>
          {burst.kind === 'gift' ? <boxGeometry args={[0.07, 0.07, 0.015]} /> : <sphereGeometry args={[0.06, 6, 5]} />}
        </mesh>
      ))}
    </group>
  )
}
