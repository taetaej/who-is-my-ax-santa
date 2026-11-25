import { Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { M, rng } from './materials'
import { ISLAND_EDGE } from './world'

// 🪐 산타 행성: 우주에 떠 있는 눈 덮인 섬. 하늘은 별·은하수·성운, 멀리 고리 행성·지구·달, 가끔 별똥별.
// 섬 밑은 보랏빛 바위 절벽과 빛나는 얼음 수정, 주변엔 작은 떠다니는 바위섬.

export const SPACE_FOG = '#2a2350'

/** 하늘 구: 위는 깊은 남색, 지평선 쪽은 보라·분홍 빛 (카메라를 따라다닌다) */
function SkyDome() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(300, 40, 20)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const top = new THREE.Color('#05071a')
    const mid = new THREE.Color('#1c1845')
    const low = new THREE.Color('#4a2a6e')
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / 300 // -1..1
      if (h > 0.08) c.copy(mid).lerp(top, Math.min(1, (h - 0.08) / 0.6))
      else c.copy(low).lerp(mid, Math.max(0, (h + 0.25) / 0.33))
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])
  return (
    <mesh ref={ref} geometry={geo} renderOrder={-2}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

/** 부드러운 빛 얼룩 텍스처 (성운·행성 빛무리) */
function glowTexture(inner: string, outer: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.45, outer)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const NEBULAE = [
  { p: [-120, 70, -190], s: 190, a: 'rgba(255,120,200,0.55)', b: 'rgba(120,60,200,0.18)' },
  { p: [150, 40, -160], s: 160, a: 'rgba(90,200,255,0.45)', b: 'rgba(40,80,200,0.15)' },
  { p: [20, 120, -230], s: 240, a: 'rgba(180,140,255,0.35)', b: 'rgba(80,40,160,0.12)' },
  { p: [-200, 20, 60], s: 150, a: 'rgba(255,170,120,0.35)', b: 'rgba(160,60,120,0.12)' },
] as const

function Nebulae() {
  const mats = useMemo(
    () => NEBULAE.map((n) => new THREE.SpriteMaterial({ map: glowTexture(n.a, n.b), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })),
    [],
  )
  return (
    <group>
      {NEBULAE.map((n, i) => (
        <sprite key={i} position={n.p as unknown as THREE.Vector3Tuple} scale={[n.s, n.s * 0.6, 1]} material={mats[i]} renderOrder={-1} />
      ))}
    </group>
  )
}

/** 멀리 떠 있는 행성들: 고리 행성, 푸른 지구, 달 */
function Planets() {
  const ringed = useRef<THREE.Group>(null)
  const earth = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ringed.current) ringed.current.rotation.y += dt * 0.01
    if (earth.current) earth.current.rotation.y += dt * 0.03
  })
  const glow = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture('rgba(140,200,255,0.6)', 'rgba(60,120,255,0.15)'), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }), [])
  const earthMat = useMemo(() => {
    // 바다 + 대충 그린 대륙 + 구름 띠
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#2a6fd1'
    g.fillRect(0, 0, 256, 128)
    const r = rng(9)
    g.fillStyle = '#4fae6a'
    for (let i = 0; i < 26; i++) {
      g.beginPath()
      g.ellipse(r() * 256, 20 + r() * 88, 8 + r() * 22, 5 + r() * 14, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = 'rgba(255,255,255,0.75)'
    for (let i = 0; i < 30; i++) g.fillRect(r() * 256, r() * 128, 10 + r() * 40, 2 + r() * 3)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: t, fog: false })
  }, [])
  return (
    <group>
      {/* 고리 행성 (왼쪽 위 멀리) */}
      <group ref={ringed} position={[-140, 85, -150]} rotation={[0.35, 0, 0.3]}>
        <mesh>
          <sphereGeometry args={[22, 40, 24]} />
          <meshBasicMaterial color="#f0a86a" fog={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.3, 0, 0]}>
          <ringGeometry args={[29, 44, 80]} />
          <meshBasicMaterial color="#f7d6a8" transparent opacity={0.55} side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>
      {/* 푸른 지구 (오른쪽 위) */}
      <mesh ref={earth} position={[160, 60, -120]} material={earthMat}>
        <sphereGeometry args={[16, 40, 24]} />
      </mesh>
      <sprite position={[160, 60, -121]} scale={[52, 52, 1]} material={glow} renderOrder={-1} />
      {/* 달 (지구 옆) */}
      <mesh position={[128, 82, -104]}>
        <sphereGeometry args={[4.5, 24, 16]} />
        <meshBasicMaterial color="#d9d6e4" fog={false} />
      </mesh>
      {/* 작은 보라 행성 (뒤쪽 낮게) */}
      <mesh position={[40, 18, -220]}>
        <sphereGeometry args={[9, 32, 20]} />
        <meshBasicMaterial color="#9b7be0" fog={false} />
      </mesh>
    </group>
  )
}

/** 별똥별: 몇 초에 한 번씩 하늘을 가로지른다 */
function ShootingStars() {
  const ref = useRef<THREE.Mesh>(null)
  const state = useRef({ t: 0, next: 3, from: new THREE.Vector3(), dir: new THREE.Vector3() })
  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    const s = state.current
    s.t += dt
    if (s.t > s.next) {
      s.t = 0
      s.next = 4 + Math.random() * 6
      s.from.set(-150 + Math.random() * 300, 70 + Math.random() * 60, -160 - Math.random() * 60)
      s.dir.set(-1 - Math.random(), -0.45, 0.2).normalize()
    }
    const k = s.t / 0.9
    m.visible = k < 1
    if (k < 1) {
      m.position.copy(s.from).addScaledVector(s.dir, k * 110)
      m.lookAt(m.position.clone().add(s.dir))
      ;(m.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI)
    }
  })
  return (
    <mesh ref={ref} visible={false}>
      <boxGeometry args={[0.5, 0.5, 18]} />
      <meshBasicMaterial color="#fff6d8" transparent fog={false} toneMapped={false} />
    </mesh>
  )
}

/** 🌌 오로라: 하늘 높이 출렁이는 초록·분홍 빛의 띠 */
function Aurora() {
  const ref = useRef<THREE.Group>(null)
  const ribbons = useMemo(() => {
    return [
      { y: 70, z: -150, x: -40, w: 260, h: 40, rot: 0.15, a: '#5dffb0', b: '#7a5cff' },
      { y: 85, z: -170, x: 60, w: 220, h: 34, rot: -0.2, a: '#ff7ad8', b: '#5dc8ff' },
    ].map((r) => {
      const g = new THREE.PlaneGeometry(r.w, r.h, 64, 1)
      const pos = g.attributes.position
      const colors = new Float32Array(pos.count * 3)
      const ca = new THREE.Color(r.a)
      const cb = new THREE.Color(r.b)
      const c = new THREE.Color()
      for (let i = 0; i < pos.count; i++) {
        const u = (pos.getX(i) / r.w + 0.5) * Math.PI * 4
        pos.setZ(i, Math.sin(u) * 12)
        const top = pos.getY(i) > 0
        c.copy(ca).lerp(cb, top ? 0.8 : 0).multiplyScalar(top ? 0.15 : 1) // 아래는 밝고 위로 갈수록 흐려진다
        colors.set([c.r, c.g, c.b], i * 3)
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      return { g, r }
    })
  }, [])
  useFrame(({ clock }) => {
    ref.current?.children.forEach((m, i) => {
      ;((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(clock.elapsedTime * 0.5 + i * 2) * 0.12
    })
  })
  return (
    <group ref={ref}>
      {ribbons.map(({ g, r }, i) => (
        <mesh key={i} geometry={g} position={[r.x, r.y, r.z]} rotation={[0.25, r.rot, 0]} renderOrder={-1}>
          <meshBasicMaterial vertexColors transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  )
}

/** 섬: 눈 덮인 윗면 + 가장자리 눈 둔덕 + 아래로 좁아지는 바위 절벽 + 빛나는 얼음 수정 + 떠다니는 바위섬 */
function Island() {
  const geo = useMemo(() => {
    const r = rng(21)
    // 절벽: 위가 넓고 아래로 뾰족해지는 바위 (꼭짓점을 흔들어 울퉁불퉁하게)
    const cliff = new THREE.CylinderGeometry(ISLAND_EDGE + 0.4, 4, 26, 72, 8, true)
    const pos = cliff.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y > 12.9) continue // 윗가장자리는 매끈하게 (눈과 맞닿는다)
      const k = 0.75 + r() * 0.5
      pos.setX(i, pos.getX(i) * k)
      pos.setZ(i, pos.getZ(i) * k)
      pos.setY(i, y + (r() - 0.5) * 1.6)
    }
    cliff.translate(0, -13.05, 0)
    cliff.computeVertexNormals()
    // 가장자리 눈 둔덕 (뚝 끊기지 않게)
    const lips: THREE.BufferGeometry[] = []
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2
      const s = 1.3 + r() * 0.9
      const g = new THREE.SphereGeometry(1, 10, 6)
      g.scale(s * 1.4, s * 0.45, s)
      g.rotateY(-a)
      g.translate(Math.cos(a) * (ISLAND_EDGE - 0.6), 0, Math.sin(a) * (ISLAND_EDGE - 0.6))
      lips.push(g)
    }
    // 절벽에 박힌 얼음 수정
    const crystals: THREE.BufferGeometry[] = []
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2
      const y = -1.5 - r() * 12
      const rad = (ISLAND_EDGE + 0.4) * (1 - (-y / 26) * 0.85) + 0.2
      const g = new THREE.OctahedronGeometry(0.5 + r() * 1.1, 0)
      g.scale(0.6, 1.8, 0.6)
      g.rotateZ((r() - 0.5) * 1.2)
      g.translate(Math.cos(a) * rad, y, Math.sin(a) * rad)
      crystals.push(g)
    }
    // 떠다니는 작은 바위섬 (눈 모자)
    const rocks: THREE.BufferGeometry[] = []
    const caps: THREE.BufferGeometry[] = []
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2
      if (Math.abs(a - Math.PI / 2) < 0.5) continue // 입구 쪽 시야는 비운다
      const rad = 72 + r() * 50
      const y = -22 + r() * 30
      const s = 2.5 + r() * 5
      const rock = new THREE.ConeGeometry(s, s * 1.8, 7)
      rock.rotateX(Math.PI)
      rock.translate(Math.cos(a) * rad, y - s * 0.9, Math.sin(a) * rad)
      rocks.push(rock)
      const cap = new THREE.CylinderGeometry(s * 1.02, s * 0.95, s * 0.35, 7)
      cap.translate(Math.cos(a) * rad, y + s * 0.1, Math.sin(a) * rad)
      caps.push(cap)
    }
    return { cliff, lips: mergeGeometries(lips)!, crystals: mergeGeometries(crystals)!, rocks: mergeGeometries(rocks)!, caps: mergeGeometries(caps)! }
  }, [])
  const floaters = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (floaters.current) floaters.current.position.y = Math.sin(clock.elapsedTime * 0.4) * 0.8
  })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={M.snow} receiveShadow>
        <circleGeometry args={[ISLAND_EDGE + 0.4, 96]} />
      </mesh>
      <mesh geometry={geo.lips} material={M.snowShade} receiveShadow castShadow />
      <mesh geometry={geo.cliff}>
        <meshStandardMaterial color="#5b4a7a" roughness={1} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.crystals}>
        <meshStandardMaterial color="#9ff0ff" emissive="#4fd8ff" emissiveIntensity={1.6} roughness={0.2} toneMapped={false} />
      </mesh>
      <group ref={floaters}>
        <mesh geometry={geo.rocks}>
          <meshStandardMaterial color="#5b4a7a" roughness={1} flatShading />
        </mesh>
        <mesh geometry={geo.caps} material={M.snow} />
      </group>
    </group>
  )
}

export function SpaceBackdrop() {
  return (
    <group>
      <SkyDome />
      <Stars radius={180} depth={60} count={5000} factor={6} saturation={0.4} fade speed={0.6} />
      <Nebulae />
      <Aurora />
      <Planets />
      <ShootingStars />
      <Island />
    </group>
  )
}
