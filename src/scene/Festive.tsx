import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MOTTO } from '../team'
import { M, rng } from './materials'
import { Wreath } from './props'
import { TextSign } from './TextSign'
import { ARCH_Z, LAMP_ANGLES, LAMP_R, PLAZA_R, SPOT, addCircle, polar, type V3 } from './world'

// 크리스마스 분위기 소품: 트리에서 뻗어 나가는 전구 줄, 입구 아치, 길가 지팡이 사탕, 가로등 리스, 밤하늘 별

/** 색깔별로 작은 구를 하나로 합친 전구들 (드로우콜 4개) */
function BulbSet({ points, size = 0.045 }: { points: { p: THREE.Vector3; m: number }[]; size?: number }) {
  const geos = useMemo(
    () =>
      M.bulbs.map((_, m) => {
        const parts = points.filter((b) => b.m === m).map((b) => new THREE.SphereGeometry(size, 6, 5).translate(b.p.x, b.p.y, b.p.z))
        return parts.length ? mergeGeometries(parts)! : null
      }),
    [points, size],
  )
  const ref = useRef<THREE.Group>(null)
  // 색깔별로 번갈아 조금씩 밝아졌다 어두워졌다
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ref.current?.children.forEach((c, i) => ((c as THREE.Mesh).visible = Math.sin(t * 1.6 + i * 1.7) > -0.75))
  })
  return (
    <group ref={ref}>
      {geos.map((g, m) => g && <mesh key={m} geometry={g} material={M.bulbs[m]} />)}
    </group>
  )
}

/** 축 늘어진 전구 줄 한 가닥 */
function strand(a: THREE.Vector3, b: THREE.Vector3, sag: number, n: number, offset = 0) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const p = a.clone().lerp(b, t)
    p.y -= Math.sin(t * Math.PI) * sag
    pts.push(p)
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const bulbs = Array.from({ length: n }, (_, i) => ({ p: curve.getPoint((i + 0.5) / n), m: (i + offset) % 4 }))
  return { wire: new THREE.TubeGeometry(curve, 24, 0.012, 4), bulbs }
}

function TreeStrings() {
  const { wire, bulbs } = useMemo(() => {
    const top = new THREE.Vector3(0, 4.3, 0)
    const wires: THREE.BufferGeometry[] = []
    const all: { p: THREE.Vector3; m: number }[] = []
    LAMP_ANGLES.forEach((a, i) => {
      const [x, , z] = polar(a, LAMP_R)
      const s = strand(top, new THREE.Vector3(x, 1.95, z), 0.55, 16, i)
      wires.push(s.wire)
      all.push(...s.bulbs)
    })
    return { wire: mergeGeometries(wires)!, bulbs: all }
  }, [])
  return (
    <group>
      <mesh geometry={wire} material={M.iron} />
      <BulbSet points={bulbs} size={0.05} />
    </group>
  )
}

// ── 지팡이 사탕 ───────────────────────────────────────────────
const caneMat = (() => {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#fbf7f0'
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = '#d0221d'
  // 비스듬한 줄무늬
  for (let k = -64; k < 128; k += 32) {
    g.beginPath()
    g.moveTo(k, 0)
    g.lineTo(k + 16, 0)
    g.lineTo(k + 16 - 32, 64)
    g.lineTo(k - 32, 64)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(10, 1)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 })
})()

const caneGeo = (() => {
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(0, 0.75, 0)]
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI
    pts.push(new THREE.Vector3(0.12 - Math.cos(a) * 0.12, 0.75 + Math.sin(a) * 0.12, 0))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 8)
})()

function CandyCanes() {
  const canes = useMemo(() => {
    const out: { p: V3; rot: number }[] = []
    // 캐롤 무대 길은 객석 벤치가 있어서 뺀다
    for (const sp of [SPOT.post, SPOT.cocoa, SPOT.fire, SPOT.field]) {
      for (const rr of [PLAZA_R + 1.4, PLAZA_R + 3.0]) {
        for (const side of [-1, 1]) {
          const ox = -Math.sin(sp.a) * 0.75 * side
          const oz = Math.cos(sp.a) * 0.75 * side
          const [x, , z] = polar(sp.a, rr)
          out.push({ p: [x + ox, 0, z + oz], rot: -sp.a + (side > 0 ? Math.PI : 0) })
        }
      }
    }
    return out
  }, [])
  return (
    <group>
      {canes.map((c, i) => (
        <mesh key={i} geometry={caneGeo} material={caneMat} position={c.p} rotation={[0, c.rot, 0]} castShadow />
      ))}
    </group>
  )
}

// ── 입구 아치: 마을이 커진 만큼 크게. 돌 받침 + 지팡이 사탕 기둥 + 둥근 아치 + 금별 + 남색 간판 ──
const ARCH_W = 4.6 // 기둥 사이
const ARCH_H = 3.6 // 기둥 높이 (아치가 시작하는 곳)
const ARCH_R = ARCH_W / 2 // 둥근 아치 반지름
for (const sx of [-1, 1]) addCircle((sx * ARCH_W) / 2, ARCH_Z, 0.45)

const pillarGeo = new THREE.CylinderGeometry(0.2, 0.22, ARCH_H, 16)
pillarGeo.translate(0, ARCH_H / 2 + 0.55, 0)
const arcGeo = new THREE.TorusGeometry(ARCH_R, 0.16, 12, 40, Math.PI)
const garlandGeo = new THREE.TorusGeometry(ARCH_R, 0.26, 8, 48, Math.PI)
const NAVY = new THREE.MeshStandardMaterial({ color: '#1f2350', roughness: 0.6 })
const PINE = new THREE.MeshStandardMaterial({ color: '#2f7a52', roughness: 0.9 })
const STAR = new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffc23a', emissiveIntensity: 3, toneMapped: false })
const starGeo = (() => {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.2 : 0.46
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i) shape.lineTo(x, y)
    else shape.moveTo(x, y)
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }).translate(0, 0, -0.06)
})()

const ARCH_LINES = [
  { text: 'AX VILLAGE', size: 0.42, color: '#ffffff', weight: 900 },
  { text: '2026 · SANTA PLANET', size: 0.14, color: '#ffd86b', weight: 800 },
]
const MOTTO_LINES = [{ text: `“${MOTTO}”`, size: 0.17, color: '#2f2950', weight: 900, hand: true }]

/** 앞뒤 양면 간판 (뒤에서 봐도 글씨가 바로 읽히게) */
function TwoSided({ y, d, w, h, lines, glow, bg }: { y: number; d: number; w: number; h: number; lines: typeof ARCH_LINES; glow?: boolean; bg?: string }) {
  return (
    <>
      <TextSign lines={lines} w={w} h={h} position={[0, y, d]} glow={glow} bg={bg} radius={bg ? 0.05 : 0} />
      <TextSign lines={lines} w={w} h={h} position={[0, y, -d]} rotation={[0, Math.PI, 0]} glow={glow} bg={bg} radius={bg ? 0.05 : 0} />
    </>
  )
}

function EntranceArch() {
  const star = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (star.current) star.current.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.5
  })
  const top = ARCH_H + 0.55 // 아치가 시작하는 높이
  const lights = useMemo(() => {
    const pts: { p: THREE.Vector3; m: number }[] = []
    // 기둥을 감는 전구
    for (const sx of [-1, 1])
      for (let i = 0; i < 22; i++) {
        const a = i * 0.9
        pts.push({ p: new THREE.Vector3((sx * ARCH_W) / 2 + Math.cos(a) * 0.25, 0.7 + i * 0.16, Math.sin(a) * 0.25), m: i % 4 })
      }
    // 둥근 아치를 따라 앞뒤 두 줄
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * Math.PI
      for (const z of [0.3, -0.3]) pts.push({ p: new THREE.Vector3(Math.cos(a) * (ARCH_R + 0.05), top + Math.sin(a) * (ARCH_R + 0.05), z), m: (i + (z > 0 ? 0 : 2)) % 4 })
    }
    return pts
  }, [top])
  return (
    // 카메라 시선이 아치 문 안쪽으로 지나가서 가리지 않는다 (반투명 처리 안 함)
    <group position={[0, 0, ARCH_Z]}>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[(sx * ARCH_W) / 2, 0, 0]}>
          {/* 돌 받침 + 눈 */}
          <mesh position={[0, 0.28, 0]} material={M.stone} castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.56, 0.8]} />
          </mesh>
          <mesh position={[0, 0.6, 0]} material={M.snow} scale={[1, 0.3, 1]}>
            <boxGeometry args={[0.86, 0.3, 0.86]} />
          </mesh>
          <mesh geometry={pillarGeo} material={caneMat} castShadow />
          {/* 기둥 머리: 금 테 + 금 구슬 */}
          <mesh position={[0, top, 0]} material={M.gold}>
            <cylinderGeometry args={[0.3, 0.26, 0.16, 16]} />
          </mesh>
          {/* 리스 + 빨간 리본 */}
          <group position={[0, 2.6, 0.24]}>
            <mesh material={PINE}>
              <torusGeometry args={[0.32, 0.1, 8, 20]} />
            </mesh>
            <mesh position={[0, -0.3, 0.06]} material={M.ribbon}>
              <boxGeometry args={[0.24, 0.14, 0.06]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* 둥근 아치: 빨간 테 + 초록 소나무 가지 */}
      <mesh geometry={garlandGeo} material={PINE} position={[0, top, 0]} castShadow />
      <mesh geometry={arcGeo} material={M.ribbon} position={[0, top, 0]} castShadow />
      {/* 꼭대기 금별 */}
      <mesh ref={star} geometry={starGeo} material={STAR} position={[0, top + ARCH_R + 0.55, 0]} />
      {/* 남색 간판 (금테) */}
      <mesh position={[0, top + 0.55, 0]} material={M.gold} castShadow>
        <boxGeometry args={[3.5, 1.05, 0.12]} />
      </mesh>
      <mesh position={[0, top + 0.55, 0]} material={NAVY}>
        <boxGeometry args={[3.36, 0.92, 0.16]} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, top + 1.25, 0]} material={M.iron}>
          <cylinderGeometry args={[0.012, 0.012, 0.42, 4]} />
        </mesh>
      ))}
      {/* 명언 현판 */}
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, top - 0.2, 0]} material={M.iron}>
          <cylinderGeometry args={[0.01, 0.01, 0.3, 4]} />
        </mesh>
      ))}
      <mesh position={[0, top - 0.55, 0]} material={M.gold} castShadow>
        <boxGeometry args={[2.5, 0.44, 0.05]} />
      </mesh>
      <TwoSided y={top + 0.55} d={0.085} w={3.3} h={0.88} lines={ARCH_LINES} glow />
      <TwoSided y={top - 0.55} d={0.03} w={2.42} h={0.36} lines={MOTTO_LINES} bg="#fbfbfe" />
      <BulbSet points={lights} size={0.055} />
      {/* 아치 아래를 비추는 따뜻한 빛 */}
      <pointLight position={[0, top - 0.4, 1.2]} color="#ffc080" intensity={10} distance={9} decay={1.8} />
    </group>
  )
}

function LampWreaths() {
  return (
    <group>
      {LAMP_ANGLES.map((a) => {
        const [x, , z] = polar(a, LAMP_R)
        return (
          <group key={a} position={[x, 0, z]} rotation={[0, Math.atan2(x, z), 0]}>
            <Wreath position={[0, 1.25, 0.06]} scale={0.55} />
          </group>
        )
      })}
    </group>
  )
}

/** 저녁 하늘의 별 (카메라를 따라다니는 하늘 구 안쪽) */
function Stars() {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const r = rng(21)
    const n = 500
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2
      const el = 0.25 + r() * 1.2 // 수평선 위로만
      const R = 160
      pos.set([Math.cos(a) * Math.cos(el) * R, Math.sin(el) * R, Math.sin(a) * Math.cos(el) * R], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  return (
    <points ref={ref} geometry={geo} renderOrder={-1}>
      <pointsMaterial color="#fff6dc" size={1.1} sizeAttenuation={false} fog={false} transparent opacity={0.85} depthWrite={false} />
    </points>
  )
}

export function Festive() {
  return (
    <group>
      <TreeStrings />
      <CandyCanes />
      <LampWreaths />
      <Stars />
      <EntranceArch />
    </group>
  )
}
