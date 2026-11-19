import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { CookieState } from './Cookie'
import { CAROL } from '../carol'
import { TextSign } from './TextSign'
import * as THREE from 'three'
import { Batch } from './Batch'
import { Fade } from './Fade'
import { M, blobs, gableBody, rng } from './materials'
import { ArchWindow, Door, Garland, Lamp, Present, Roof, Wreath } from './props'
import { AWARDS_ROT, COCOA_SIZE, inCarol, FIRE_SEATS, POST_SIZE, SPOT, addCircle, addRotBox, at, faceCenter, polar, type V3 } from './world'

// 마을의 놀이 장소들. 각 장소는 앞면(+z)이 광장 쪽을 본다.

/** 장소 이름표 (머리 위에 떠 있는 팻말) */
export function SpotLabel({ position, text }: { position: V3; text: string }) {
  return (
    <FarLabel position={position} className="spot-label">
      {text}
    </FarLabel>
  )
}

/** 떠 있는 이름표. 카메라가 가까이 다가간 시점(불멍, 전시, 케이크 등)에서는 화면을 가려서 숨긴다 */
export function FarLabel({ position, className, children, hideWithin = 6.5 }: { position: V3; className: string; children: ReactNode; hideWithin?: number }) {
  const el = useRef<HTMLDivElement>(null)
  const p = useMemo(() => new THREE.Vector3(...position), [position[0], position[1], position[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ camera }) => {
    if (el.current) el.current.style.opacity = camera.position.distanceTo(p) < hideWithin ? '0' : '1'
  })
  return (
    <Html position={position} center distanceFactor={10} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={el} className={className} style={{ transition: 'opacity 0.3s' }}>
        {children}
      </div>
    </Html>
  )
}

function Placed({ spot, r, children }: { spot: { a: number; r: number }; r: number; children: ReactNode }) {
  const [x, , z] = at(spot)
  return (
    <Fade x={x} z={z} r={r}>
      <group position={[x, 0, z]} rotation={[0, faceCenter(spot.a), 0]}>
        {children}
      </group>
    </Fade>
  )
}

// ── 📮 산타 우체국 (소개서) ──────────────────────────────────────
function PostOffice() {
  const { w, d } = POST_SIZE
  const h = 1.75
  const rise = 1.05
  const body = useMemo(() => gableBody(w, h, rise, d), [w, d])
  const front = d / 2 + 0.001
  return (
    <group>
      <Batch>
        <mesh geometry={body} material={M.red} castShadow receiveShadow />
        <mesh position={[0, 0.07, 0]} material={M.stone} receiveShadow>
          <boxGeometry args={[w + 0.14, 0.14, d + 0.14]} />
        </mesh>
        <Roof w={w} h={h} rise={rise} d={d} mat={M.roofSlate} />
        <Door position={[0, 0, front]} mat={M.doorRed} w={0.6} h={0.95} />
        <ArchWindow position={[-0.95, 0.45, front]} w={0.5} h={0.7} />
        <ArchWindow position={[0.95, 0.45, front]} w={0.5} h={0.7} />
        <ArchWindow position={[0, h + 0.1, front]} w={0.36} h={0.5} />
        {/* 간판 */}
        <mesh position={[0, 1.35, front + 0.05]} material={M.trimWood} castShadow>
          <boxGeometry args={[1.5, 0.32, 0.06]} />
        </mesh>
        <mesh position={[0, 1.35, front + 0.085]} material={M.glowSoft}>
          <boxGeometry args={[1.36, 0.2, 0.01]} />
        </mesh>
        {/* 빨간 우체통 */}
        <group position={[0.95 + 0.45, 0, front + 0.55]}>
          <mesh position={[0, 0.3, 0]} material={M.iron}>
            <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
          </mesh>
          <mesh position={[0, 0.72, 0]} material={M.doorRed} castShadow>
            <boxGeometry args={[0.42, 0.42, 0.36]} />
          </mesh>
          <mesh position={[0, 0.93, 0]} rotation={[0, 0, Math.PI / 2]} material={M.doorRed} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.42, 14, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh position={[0, 0.8, 0.185]} material={M.iron}>
            <boxGeometry args={[0.26, 0.04, 0.01]} />
          </mesh>
          <mesh position={[0, 1.08, 0]} material={M.snow} scale={[1, 0.35, 0.85]}>
            <sphereGeometry args={[0.22, 10, 6]} />
          </mesh>
        </group>
        {/* 편지 더미 */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-1.35 + i * 0.05, 0.05 + i * 0.05, front + 0.5]} rotation={[0, i * 0.4, 0]} material={i % 2 ? M.trim : M.kraftLight} castShadow>
            <boxGeometry args={[0.32, 0.04, 0.22]} />
          </mesh>
        ))}
        {[1, -1].map((sx) => (
          <mesh key={sx} position={[(w / 2 + 0.05) * sx, 0.02, 0]} scale={[0.35, 0.18, d / 2 + 0.1]} material={M.snow} receiveShadow>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
        ))}
      </Batch>
      <Wreath position={[0, h - 0.05, front + 0.04]} scale={0.9} />
      <Garland from={[-w / 2 - 0.05, h - 0.06, front + 0.06]} to={[w / 2 + 0.05, h - 0.06, front + 0.06]} sag={0.14} />
      <TextSign lines={[{ text: '📮 AX 우편함', size: 0.15, color: '#6a3b10', weight: 900, kr: true }]} w={1.4} h={0.26} position={[0, 1.35, front + 0.11]} bg="#ffe6b0" radius={0.04} glow />
    </group>
  )
}

// ── ☕ 핫초코 포차 ──────────────────────────────────────────────
function Steam({ position }: { position: V3 }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ref.current?.children.forEach((c, i) => {
      const k = (t * 0.5 + i / 3) % 1
      c.position.y = k * 0.6
      c.scale.setScalar(0.6 + k)
      ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k)
    })
  })
  return (
    <group ref={ref} position={position}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function CocoaStall() {
  const { w, d } = COCOA_SIZE
  const stripes = 9
  return (
    <group>
      <Batch>
        {/* 카운터 */}
        <mesh position={[0, 0.5, 0]} material={M.kraft} castShadow receiveShadow>
          <boxGeometry args={[w, 1.0, d]} />
        </mesh>
        <mesh position={[0, 1.03, 0.05]} material={M.woodDark} castShadow>
          <boxGeometry args={[w + 0.1, 0.06, d + 0.2]} />
        </mesh>
        {/* 기둥 */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.06), 1.3, sz * (d / 2 - 0.06)]} material={M.trimWood} castShadow>
              <boxGeometry args={[0.08, 2.6, 0.08]} />
            </mesh>
          )),
        )}
        {/* 줄무늬 차양 */}
        {Array.from({ length: stripes }, (_, k) => (
          <mesh key={k} position={[-w / 2 - 0.1 + (k + 0.5) * ((w + 0.2) / stripes), 2.55, 0.25]} rotation={[0.38, 0, 0]} material={k % 2 ? M.trim : M.ribbon} castShadow>
            <boxGeometry args={[(w + 0.2) / stripes, 0.04, d + 0.9]} />
          </mesh>
        ))}
        <mesh position={[0, 2.66, -0.05]} rotation={[0.38, 0, 0]} material={M.snow} scale={[1, 0.25, 1]}>
          <boxGeometry args={[w + 0.1, 0.2, d + 0.6]} />
        </mesh>
        {/* 냄비 */}
        <mesh position={[-0.6, 1.2, -0.1]} material={M.iron} castShadow>
          <cylinderGeometry args={[0.24, 0.2, 0.28, 16]} />
        </mesh>
        <mesh position={[-0.6, 1.33, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.22, 16]} />
          <meshStandardMaterial color="#5a2e15" roughness={0.4} />
        </mesh>
        {/* 머그컵 줄 */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0.0 + i * 0.22, 1.13, 0.3]} material={[M.trim, M.ribbon, M.presents[0], M.trim, M.presents[1]][i]} castShadow>
            <cylinderGeometry args={[0.07, 0.065, 0.14, 12]} />
          </mesh>
        ))}
        {/* 마시멜로 병 */}
        <mesh position={[0.95, 1.2, -0.25]} material={M.ice}>
          <cylinderGeometry args={[0.12, 0.12, 0.28, 12]} />
        </mesh>
      </Batch>
      <Steam position={[-0.6, 1.4, -0.1]} />
      {/* 간판 */}
      <group position={[0, 2.95, d / 2 + 0.55]} rotation={[-0.15, 0, 0]}>
        <mesh material={M.woodDark} castShadow>
          <boxGeometry args={[1.5, 0.42, 0.06]} />
        </mesh>
        <TextSign lines={[{ text: '☕ AX CAFE', size: 0.22, color: '#ffe2a8', weight: 900 }]} w={1.44} h={0.38} position={[0, 0, 0.035]} glow />
      </group>
      <Garland from={[-w / 2, 2.3, d / 2 + 0.2]} to={[w / 2, 2.3, d / 2 + 0.2]} sag={0.12} />
      <pointLight position={[0, 2.0, 0.4]} color="#ffb860" intensity={4} distance={5} decay={2} />
      <Present position={[-1.55, 0, 0.6]} m={0} size={0.3} rotation={0.3} />
      <Present position={[-1.6, 0, 0.15]} m={3} size={0.22} rotation={-0.4} />
    </group>
  )
}

// ── 🔥 모닥불 ────────────────────────────────────────────────────
function Fire() {
  const flames = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    flames.current?.children.forEach((c, i) => {
      c.scale.y = 1 + Math.sin(t * (7 + i * 2.3) + i) * 0.25
      c.rotation.y = t * (0.5 + i * 0.2)
    })
    if (light.current) light.current.intensity = 14 + Math.sin(t * 13) * 2 + Math.sin(t * 7.3) * 1.6
  })
  return (
    <group>
      <group ref={flames}>
        {[[0, 0], [0.18, 0.08], [-0.16, 0.1], [0.02, -0.17]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.38, z]}>
            <coneGeometry args={[0.16 - i * 0.02, i === 0 ? 0.75 : 0.5, 8]} />
            <meshStandardMaterial color="#ffb347" emissive={i === 0 ? '#ffd27a' : '#ff6a1a'} emissiveIntensity={3} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[0, 0.9, 0]} color="#ff9a4a" intensity={14} distance={9} decay={1.5} />
    </group>
  )
}

function Bonfire() {
  const [x, , z] = at(SPOT.fire)
  const ring = useMemo(() => {
    const pts: [number, number, number, number][] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      pts.push([Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62, 0.15])
    }
    return blobs(pts, 6)
  }, [])
  return (
    <group position={[x, 0, z]}>
      <Batch>
        <mesh geometry={ring} material={M.stone} castShadow receiveShadow />
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.12, 0]} rotation={[0, (i / 3) * Math.PI, Math.PI / 2]} material={M.woodDark} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.85, 8]} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} material={M.stoneDark} receiveShadow>
          <circleGeometry args={[2.4, 32]} />
        </mesh>
      </Batch>
      <Fire />
      {/* 통나무 의자 (앉는 자리) */}
      <Batch>
        {FIRE_SEATS.map((s, i) => (
          <group key={i} position={[s.x - x, 0, s.z - z]} rotation={[0, s.rot, 0]}>
            <mesh position={[0, 0.16, 0]} rotation={[0, 0, Math.PI / 2]} material={M.wood} castShadow receiveShadow>
              <cylinderGeometry args={[0.16, 0.16, 0.7, 10]} />
            </mesh>
            <mesh position={[0, 0.31, 0]} material={M.snow} scale={[1, 0.25, 0.45]}>
              <sphereGeometry args={[0.28, 10, 6]} />
            </mesh>
          </group>
        ))}
      </Batch>
    </group>
  )
}

// ── ❄️ 눈밭 (눈 요새, 눈덩이 더미) ────────────────────────────────
const FORTS = (() => {
  const [cx, , cz] = at(SPOT.field)
  const base = faceCenter(SPOT.field.a)
  const list = [
    { lx: -1.8, lz: 0.9, rot: 0.25 },
    { lx: 1.6, lz: -1.4, rot: -0.3 },
    { lx: 0.2, lz: 2.4, rot: 0.05 },
  ].map((f) => {
    const cos = Math.cos(base)
    const sin = Math.sin(base)
    return { x: cx + f.lx * cos + f.lz * sin, z: cz - f.lx * sin + f.lz * cos, rot: base + f.rot }
  })
  for (const f of list) addRotBox(f.x, f.z, f.rot, 0.95, 0.3)
  return list
})()

const PILES = (() => {
  const r = rng(77)
  const [cx, , cz] = at(SPOT.field)
  return Array.from({ length: 4 }, (_, i) => {
    const a = i * 1.7 + r()
    const p = { x: cx + Math.cos(a) * 2.6, z: cz + Math.sin(a) * 2.6 }
    addCircle(p.x, p.z, 0.3)
    return p
  })
})()

function SnowField() {
  const [cx, , cz] = at(SPOT.field)
  const fort = useMemo(() => {
    const pts: [number, number, number, number][] = []
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6 - row; i++) {
        pts.push([-0.8 + row * 0.16 + i * 0.32, 0.16 + row * 0.24, 0, 0.2])
      }
    }
    return blobs(pts, 8)
  }, [])
  const pile = useMemo(
    () =>
      blobs(
        [
          [0, 0.09, 0, 0.11],
          [0.18, 0.09, 0.05, 0.11],
          [0.08, 0.09, 0.18, 0.11],
          [0.09, 0.25, 0.08, 0.11],
        ],
        8,
      ),
    [],
  )
  return (
    <group>
      <Batch>
        {/* 푹신한 눈밭 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, cz]} material={M.snow} receiveShadow>
          <circleGeometry args={[3.8, 40]} />
        </mesh>
        {FORTS.map((f, i) => (
          <mesh key={i} geometry={fort} position={[f.x, 0, f.z]} rotation={[0, f.rot, 0]} material={M.snow} castShadow receiveShadow />
        ))}
        {PILES.map((p, i) => (
          <mesh key={i} geometry={pile} position={[p.x, 0, p.z]} material={M.snowShade} castShadow />
        ))}
      </Batch>
      {/* 깃발 */}
      {FORTS.slice(0, 2).map((f, i) => (
        <group key={i} position={[f.x, 0.75, f.z]}>
          <mesh material={M.woodDark}>
            <cylinderGeometry args={[0.02, 0.02, 0.9, 6]} />
          </mesh>
          <mesh position={[0.15, 0.3, 0]} material={i ? M.presents[0] : M.ribbon}>
            <boxGeometry args={[0.3, 0.2, 0.01]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── 📋 마니또 게시판 ─────────────────────────────────────────────
function Board() {
  const notes = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 6 }, (_, i) => ({
      x: -0.42 + (i % 3) * 0.42 + (r() - 0.5) * 0.08,
      y: 0.95 + Math.floor(i / 3) * 0.32 + (r() - 0.5) * 0.05,
      rot: (r() - 0.5) * 0.3,
      m: [M.trim, M.glowSoft, M.kraftLight][i % 3],
    }))
  }, [])
  return (
    <Batch>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.75, 0]} material={M.woodDark} castShadow>
          <boxGeometry args={[0.08, 1.5, 0.08]} />
        </mesh>
      ))}
      <mesh position={[0, 1.1, 0]} material={M.kraft} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.8, 0.06]} />
      </mesh>
      <mesh position={[0, 1.58, 0]} rotation={[0, 0, 0]} material={M.roofRed} castShadow>
        <boxGeometry args={[1.5, 0.08, 0.3]} />
      </mesh>
      <mesh position={[0, 1.64, 0]} material={M.snow} scale={[1, 0.3, 1]}>
        <boxGeometry args={[1.45, 0.12, 0.28]} />
      </mesh>
      {notes.map((n, i) => (
        <mesh key={i} position={[n.x, n.y, 0.035]} rotation={[0, 0, n.rot]} material={n.m}>
          <boxGeometry args={[0.28, 0.22, 0.005]} />
        </mesh>
      ))}
    </Batch>
  )
}

// ── 🎵 모닥불 캐롤: 스피커 두 대 + 김민지 앨범 입간판. 불가에 모이면 다같이 리듬을 탄다 ─────
// 모닥불 기준 상대 위치 (x: 화면 오른쪽, z: 화면 아래). 불 뒤편(화면 위쪽)에 둬서 불을 가리지 않는다
const FIRE_AT = at(SPOT.fire)
const SPEAKERS = [
  { dx: -2.75, dz: -0.9 },
  { dx: 0.5, dz: -2.85 },
].map(({ dx, dz }) => {
  const x = FIRE_AT[0] + dx
  const z = FIRE_AT[2] + dz
  addCircle(x, z, 0.4)
  return { x, z, rot: Math.atan2(FIRE_AT[0] - x, FIRE_AT[2] - z) } // 불 쪽을 본다
})
const STANDEE = (() => {
  const x = FIRE_AT[0] + 2.45
  const z = FIRE_AT[2] - 2.25
  addRotBox(x, z, 0.35, 0.7, 0.25)
  return { x, z, rot: 0.35 }
})()

function Speaker() {
  const cone = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    // 쿵짝쿵짝 우퍼가 들썩
    const t = clock.elapsedTime
    cone.current?.scale.setScalar(1 + Math.max(0, Math.sin(t * 8.4)) * 0.12)
  })
  return (
    <group>
      <Batch>
        <mesh position={[0, 0.55, 0]} material={M.coal} castShadow>
          <boxGeometry args={[0.6, 1.1, 0.48]} />
        </mesh>
        <mesh position={[0, 0.82, 0.245]} material={M.stoneDark}>
          <circleGeometry args={[0.1, 14]} />
        </mesh>
        <mesh position={[0, 1.12, 0]} material={M.snow} scale={[1, 0.3, 0.85]}>
          <sphereGeometry args={[0.33, 10, 6]} />
        </mesh>
      </Batch>
      <group ref={cone} position={[0, 0.42, 0.245]}>
        <mesh material={M.stoneDark}>
          <circleGeometry args={[0.2, 18]} />
        </mesh>
        <mesh position={[0, 0, 0.01]} material={M.gold}>
          <circleGeometry args={[0.06, 12]} />
        </mesh>
      </group>
      {/* 스피커 위 작은 전구 */}
      <mesh position={[0, 1.02, 0.25]} material={M.bulbs[0]}>
        <sphereGeometry args={[0.035, 8, 6]} />
      </mesh>
    </group>
  )
}

function AlbumStandee() {
  return (
    <group>
      <Batch>
        {[-0.5, 0.5].map((px) => (
          <mesh key={px} position={[px, 0.75, -0.08]} rotation={[-0.12, 0, 0]} material={M.woodDark} castShadow>
            <boxGeometry args={[0.07, 1.6, 0.07]} />
          </mesh>
        ))}
        <mesh position={[0, 1.35, 0]} rotation={[-0.12, 0, 0]} material={M.coal} castShadow>
          <boxGeometry args={[1.3, 1.3, 0.06]} />
        </mesh>
        <mesh position={[0, 2.04, -0.02]} material={M.snow} scale={[1, 0.3, 1]}>
          <boxGeometry args={[1.32, 0.12, 0.16]} />
        </mesh>
      </Batch>
      <group position={[0, 1.35, 0]} rotation={[-0.12, 0, 0]}>
        <TextSign
          w={1.24}
          h={1.24}
          position={[0, 0, 0.035]}
          bg="#1b2448"
          radius={0.04}
          glow
          lines={[
            { text: '✦ NEW ALBUM ✦', size: 0.08, color: '#ffcf4a', weight: 900, gap: 0.02 },
            { text: '🎄', size: 0.3 },
            { text: CAROL.by, size: 0.16, color: '#ffffff', weight: 900 },
            { text: CAROL.title, size: 0.095, color: '#ffd9a0', weight: 800, gap: 0.03 },
            { text: '🔥 불멍 회의실 가까이 오면 크게 들려요', size: 0.05, color: '#b9c6ea', weight: 600 },
          ]}
        />
      </group>
      <pointLight position={[0, 1.6, 0.9]} color="#ffd9a0" intensity={2.5} distance={3} decay={2} />
    </group>
  )
}

function Notes({ position }: { position: V3 }) {
  return (
    <Html position={position} center distanceFactor={10} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div className="notes">
        {['♪', '♫', '♬', '♪', '♩'].map((n, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.7}s`, left: `${i * 18 - 36}px` }}>
            {n}
          </span>
        ))}
      </div>
    </Html>
  )
}

/** 모닥불 위에 "🎧 N명 듣는 중" (나 + 불가에 모인 다른 사람) */
export function CarolCount({ others, me }: { others: number; me: MutableRefObject<CookieState | null> }) {
  const [mine, setMine] = useState(false)
  useFrame(() => {
    const s = me.current
    const v = !!s && inCarol(s.x, s.z)
    if (v !== mine) setMine(v)
  })
  const n = others + (mine ? 1 : 0)
  if (n === 0) return null
  return (
    <Html position={[FIRE_AT[0], 2.75, FIRE_AT[2]]} center distanceFactor={10} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className="spot-count">🎧 {n}명 같이 듣는 중</div>
    </Html>
  )
}

function FireCarol() {
  return (
    <group>
      {SPEAKERS.map((sp, i) => (
        <group key={i} position={[sp.x, 0, sp.z]} rotation={[0, sp.rot, 0]}>
          <Speaker />
        </group>
      ))}
      <group position={[STANDEE.x, 0, STANDEE.z]} rotation={[0, STANDEE.rot, 0]}>
        <AlbumStandee />
      </group>
      <Notes position={[FIRE_AT[0], 1.6, FIRE_AT[2]]} />
    </group>
  )
}

// ── 🎄 메시지 트리 = 광장 큰 트리. 답이 하나 걸릴 때마다 카드 오너먼트가 하나씩 늘어난다 ──────
export type TreeInfo = { total: number; todayCount: number; question: string }

const CARD_COLORS = [M.ribbon, M.gold, M.presents[0], M.trim, M.presents[1], M.ornaments[2]]

/** 광장 큰 트리(메시지 트리)에 답 카드를 건다. 오늘 걸린 카드는 반짝인다 */
function MessageTreeCards({ info }: { info: TreeInfo | null }) {
  const H = 5.2 // BigTree 높이와 같게
  const total = Math.min(info?.total ?? 0, 120)
  const today = Math.min(info?.todayCount ?? 0, total)
  // 해바라기 씨 배열(황금각)로 원뿔 표면에 고르게
  const cards = useMemo(
    () =>
      Array.from({ length: total }, (_, i) => {
        const t = 0.1 + ((i * 0.6180339) % 1) * 0.72
        const a = i * 2.39996
        const rad = H * 0.34 * (1 - t * 0.85) + 0.1
        return { p: [Math.cos(a) * rad, H * t + 0.3, Math.sin(a) * rad] as V3, rot: -a + Math.PI / 2, m: i % CARD_COLORS.length, glow: i >= total - today }
      }),
    [total, today],
  )
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    // 카드가 바람에 살랑살랑
    const t = clock.elapsedTime
    ref.current?.children.forEach((c, i) => (c.rotation.z = Math.sin(t * 1.5 + i) * 0.12))
  })
  return (
    <group>
      <group ref={ref}>
        {cards.map((c, i) => (
          <group key={i} position={c.p} rotation={[0, c.rot, 0]}>
            <mesh position={[0, -0.1, 0]} material={c.glow ? M.glow : CARD_COLORS[c.m]} castShadow>
              <boxGeometry args={[0.17, 0.22, 0.012]} />
            </mesh>
            <mesh material={M.gold}>
              <cylinderGeometry args={[0.004, 0.004, 0.05, 4]} />
            </mesh>
          </group>
        ))}
      </group>
      <FarLabel position={[0, 2.5, 2.4]} className="spot-label tree-label">
        🎄 메시지 트리 {info ? <span className="count">{info.total}</span> : null}
        {info && <div className="q">Q. {info.question}</div>}
      </FarLabel>
    </group>
  )
}

// ── 🏆 AX 어워즈 투표소: 금빛 트로피 + 투표함 ─────────────────────
function AwardsBooth() {
  const trophy = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (trophy.current) trophy.current.rotation.y = clock.elapsedTime * 0.8
  })
  return (
    <group>
      <Batch>
        {/* 단상 */}
        <mesh position={[0, 0.45, 0]} material={M.ribbon} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.9, 0.8]} />
        </mesh>
        <mesh position={[0, 0.92, 0]} material={M.gold}>
          <boxGeometry args={[1.66, 0.06, 0.86]} />
        </mesh>
        {/* 투표함 */}
        <mesh position={[0.35, 1.17, 0]} material={M.trim} castShadow>
          <boxGeometry args={[0.55, 0.45, 0.42]} />
        </mesh>
        <mesh position={[0.35, 1.4, 0]} material={M.coal}>
          <boxGeometry args={[0.3, 0.012, 0.05]} />
        </mesh>
        <mesh position={[0.35, 1.17, 0.212]} material={M.ribbon}>
          <boxGeometry args={[0.3, 0.12, 0.005]} />
        </mesh>
        {/* 투표 용지 */}
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[-0.4 + k * 0.03, 0.96 + k * 0.006, 0.1]} rotation={[0, k * 0.25, 0]} material={M.kraftLight}>
            <boxGeometry args={[0.24, 0.006, 0.3]} />
          </mesh>
        ))}
        {/* 레드카펫 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 1.4]} material={M.ribbon} receiveShadow>
          <planeGeometry args={[1.0, 2.0]} />
        </mesh>
      </Batch>
      {/* 빙글빙글 트로피 */}
      <group ref={trophy} position={[-0.35, 0.95, -0.1]}>
        <mesh position={[0, 0.06, 0]} material={M.woodDark}>
          <boxGeometry args={[0.22, 0.12, 0.22]} />
        </mesh>
        <mesh position={[0, 0.22, 0]} material={M.gold}>
          <cylinderGeometry args={[0.03, 0.05, 0.2, 10]} />
        </mesh>
        <mesh position={[0, 0.42, 0]} material={M.gold} castShadow>
          <cylinderGeometry args={[0.16, 0.06, 0.26, 14, 1, true]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.17, 0.44, 0]} rotation={[0, 0, Math.PI / 2]} material={M.gold}>
            <torusGeometry args={[0.06, 0.015, 6, 12, Math.PI]} />
          </mesh>
        ))}
        <mesh position={[0, 0.7, 0]} material={M.glow}>
          <octahedronGeometry args={[0.07, 0]} />
        </mesh>
      </group>
      <pointLight position={[0, 1.8, 0.8]} color="#ffd27a" intensity={4} distance={4} decay={2} />
      <TextSign lines={[{ text: '🏆 AX AWARDS 2026', size: 0.16, color: '#ffd98a', weight: 900 }]} w={1.5} h={0.34} position={[0, 0.5, 0.405]} bg="#5a0f0c" radius={0.04} />
    </group>
  )
}

export function Spots({ tree }: { tree: TreeInfo | null }) {
  const cocoaFront = polar(SPOT.cocoa.a, SPOT.cocoa.r - 2.0)
  const postFront = polar(SPOT.post.a, SPOT.post.r - 2.0)
  return (
    <group>
      <Placed spot={SPOT.post} r={2.0}>
        <PostOffice />
      </Placed>
      <Placed spot={SPOT.cocoa} r={1.6}>
        <CocoaStall />
      </Placed>
      <Fade x={at(SPOT.board)[0]} z={at(SPOT.board)[2]} r={0.9}>
        <group position={at(SPOT.board)}>
          <Board />
        </group>
      </Fade>
      <Fade x={at(SPOT.awards)[0]} z={at(SPOT.awards)[2]} r={1.2}>
        <group position={at(SPOT.awards)} rotation={[0, AWARDS_ROT, 0]}>
          <AwardsBooth />
        </group>
      </Fade>
      <Bonfire />
      <FireCarol />
      <MessageTreeCards info={tree} />
      <SnowField />
      <Lamp position={[cocoaFront[0] + 1.6, 0, cocoaFront[2]]} light />
      <Lamp position={[postFront[0] - 1.8, 0, postFront[2]]} light />

      <SpotLabel position={polar(SPOT.post.a, SPOT.post.r, 3.6)} text="📮 AX 우편함 · 소개서" />
      <SpotLabel position={polar(SPOT.cocoa.a, SPOT.cocoa.r, 3.3)} text="☕ AX 카페" />
      <SpotLabel position={polar(SPOT.fire.a, SPOT.fire.r, 2.2)} text="🔥 불멍 회의실 · 🎵 캐롤" />
      <SpotLabel position={polar(SPOT.field.a, SPOT.field.r, 1.9)} text="❄️ 눈밭" />
      <SpotLabel position={polar(SPOT.awards.a, SPOT.awards.r, 2.6)} text="🏆 AX 어워즈 투표소" />
      <SpotLabel position={polar(SPOT.board.a, SPOT.board.r, 2.15)} text="📋 마니또 게시판" />
      <SpotLabel position={polar(Math.PI, 2.7, 0.9)} text="🧊 얼음 연못" />
    </group>
  )
}
