import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MOTTO } from '../team'
import { M, rng } from './materials'
import { Wreath } from './props'
import { TextSign } from './TextSign'
import { ARCH_Z, LAMP_ANGLES, LAMP_R, PLAZA_R, SPOT, addCircle, polar, type V3 } from './world'

// 크리스마스 분위기 소품: 트리에서 뻗어 나가는 전구 줄, 울타리 전구, 길가 지팡이 사탕, 가로등 리스, 밤하늘 별

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

// ── 입구 아치: AX VILLAGE 2026 + 팀 명언 ─────────────────────────
const ARCH_W = 3.4
for (const sx of [-1, 1]) addCircle((sx * ARCH_W) / 2, ARCH_Z, 0.3)

const pillarGeo = new THREE.CylinderGeometry(0.16, 0.18, 3.3, 14)
pillarGeo.translate(0, 1.65, 0)

const ARCH_LINES = [
  { text: 'AX VILLAGE', size: 0.44, color: '#ffffff', weight: 900 },
  { text: '❄  2026  ❄', size: 0.17, color: '#ffe1a8', weight: 800 },
]
const MOTTO_LINES = [{ text: `“${MOTTO}”`, size: 0.17, color: '#5a3a14', weight: 900, hand: true }]

/** 앞뒤 양면 간판 (뒤에서 봐도 글씨가 바로 읽히게) */
function TwoSided({ y, d, w, h, lines, glow }: { y: number; d: number; w: number; h: number; lines: typeof ARCH_LINES; glow?: boolean }) {
  return (
    <>
      <TextSign lines={lines} w={w} h={h} position={[0, y, d]} glow={glow} />
      <TextSign lines={lines} w={w} h={h} position={[0, y, -d]} rotation={[0, Math.PI, 0]} glow={glow} />
    </>
  )
}

function EntranceArch() {
  const lights = useMemo(() => {
    const pts: { p: THREE.Vector3; m: number }[] = []
    // 기둥을 감는 전구 + 간판 둘레
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 18; i++) {
        const a = i * 0.9
        pts.push({ p: new THREE.Vector3((sx * ARCH_W) / 2 + Math.cos(a) * 0.2, 0.2 + i * 0.17, Math.sin(a) * 0.2), m: i % 4 })
      }
    }
    for (let i = 0; i <= 22; i++) pts.push({ p: new THREE.Vector3(-1.9 + (i / 22) * 3.8, 4.08, 0.12), m: i % 4 })
    return pts
  }, [])
  return (
    // 카메라 시선이 아치 문 안쪽으로 지나가서 가리지 않는다 (반투명 처리 안 함)
    <group position={[0, 0, ARCH_Z]}>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[(sx * ARCH_W) / 2, 0, 0]}>
          <mesh geometry={pillarGeo} material={caneMat} castShadow />
          <mesh position={[0, 3.35, 0]} material={M.gold}>
            <sphereGeometry args={[0.22, 14, 10]} />
          </mesh>
          <mesh position={[0, 0.1, 0]} material={M.snow} scale={[1, 0.35, 1]}>
            <sphereGeometry args={[0.45, 12, 8]} />
          </mesh>
        </group>
      ))}
      {/* 간판 */}
      <mesh position={[0, 3.55, 0]} material={M.ribbon} castShadow>
        <boxGeometry args={[3.9, 0.95, 0.14]} />
      </mesh>
      <mesh position={[0, 4.06, 0]} material={M.snow} scale={[1, 0.35, 1]}>
        <boxGeometry args={[3.95, 0.22, 0.3]} />
      </mesh>
      {/* 명언 현판 */}
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 2.95, 0]} material={M.iron}>
          <cylinderGeometry args={[0.008, 0.008, 0.3, 4]} />
        </mesh>
      ))}
      <mesh position={[0, 2.62, 0]} material={M.kraftLight} castShadow>
        <boxGeometry args={[2.3, 0.38, 0.05]} />
      </mesh>
      <TwoSided y={3.55} d={0.075} w={3.8} h={0.9} lines={ARCH_LINES} glow />
      <TwoSided y={2.62} d={0.03} w={2.25} h={0.34} lines={MOTTO_LINES} />
      <BulbSet points={lights} size={0.05} />
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
