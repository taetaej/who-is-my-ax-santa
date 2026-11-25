import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { game } from './game'
import { M, rng } from './materials'
import { SpotLabel } from './Spots'
import { ARENA, ISLAND_EDGE, LANTERNS, ROCKET, ROLL, SCOPE, ZONE_PATHS, addCircle, onDecor, onPath, onSledRun, type V3 } from './world'

// 🪐 넓어진 산타 행성 꾸미기: 옛 울타리 자리의 등불 기둥, 놀이 구역으로 가는 등불 돌길,
// 🚀 산타 로켓 발사대, 🔭 별 망원경, 빛나는 얼음 수정 덤불.

const GLOW_WARM = new THREE.MeshStandardMaterial({ color: '#ffe0a0', emissive: '#ffb04a', emissiveIntensity: 2.4, toneMapped: false })
const GLOW_CYAN = new THREE.MeshStandardMaterial({ color: '#b8f4ff', emissive: '#4fd8ff', emissiveIntensity: 1.8, roughness: 0.15, toneMapped: false })
const GLOW_PINK = new THREE.MeshStandardMaterial({ color: '#ffd0f0', emissive: '#ff6ad0', emissiveIntensity: 1.6, roughness: 0.15, toneMapped: false })
const ROCKET_WHITE = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.35, metalness: 0.2 })
const ROCKET_RED = new THREE.MeshStandardMaterial({ color: '#c8302a', roughness: 0.4, metalness: 0.2 })
const METAL = new THREE.MeshStandardMaterial({ color: '#8b93a8', roughness: 0.35, metalness: 0.7 })
const WINDOW = new THREE.MeshStandardMaterial({ color: '#bfe9ff', emissive: '#7fd0ff', emissiveIntensity: 1.4, toneMapped: false })

/** 🏮 등불 기둥: 짙은 나무 기둥 위에 따뜻한 등 (옛 울타리 자리) */
function Lanterns() {
  const geo = useMemo(() => {
    const posts: THREE.BufferGeometry[] = []
    const lights: THREE.BufferGeometry[] = []
    for (const l of LANTERNS) {
      const p = new THREE.CylinderGeometry(0.07, 0.09, 1.5, 8)
      p.translate(l.x, 0.75, l.z)
      posts.push(p)
      const cap = new THREE.ConeGeometry(0.2, 0.16, 6)
      cap.translate(l.x, 1.82, l.z)
      posts.push(cap)
      const lamp = new THREE.SphereGeometry(0.13, 10, 8)
      lamp.translate(l.x, 1.62, l.z)
      lights.push(lamp)
    }
    return { posts: mergeGeometries(posts.map((g) => g.toNonIndexed()))!, lights: mergeGeometries(lights)! }
  }, [])
  return (
    <group>
      <mesh geometry={geo.posts} material={M.woodDark} castShadow />
      <mesh geometry={geo.lights} material={GLOW_WARM} />
    </group>
  )
}

/** 놀이 구역으로 가는 돌길: 디딤돌 + 길가 지팡이 사탕 등불 */
function Paths() {
  const geo = useMemo(() => {
    const r = rng(61)
    const stones: THREE.BufferGeometry[] = []
    const poles: THREE.BufferGeometry[] = []
    const lights: THREE.BufferGeometry[] = []
    let k = 0
    for (const path of ZONE_PATHS) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]
        const b = path[i]
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        const ux = (b.x - a.x) / len
        const uz = (b.z - a.z) / len
        for (let d = 0.4; d < len; d += 0.75) {
          const side = (Math.floor(d / 0.75) % 2 ? 1 : -1) * 0.14
          const g = new THREE.CylinderGeometry(0.24 + r() * 0.05, 0.26, 0.06, 8)
          g.translate(a.x + ux * d - uz * side, 0.03, a.z + uz * d + ux * side)
          stones.push(g.toNonIndexed())
          // 4m 마다 길 양쪽 번갈아 등불
          if (k++ % 6 === 3) {
            const s = (k % 12 < 6 ? 1 : -1) * 1.0
            const x = a.x + ux * d - uz * s
            const z = a.z + uz * d + ux * s
            const pole = new THREE.CylinderGeometry(0.045, 0.05, 1.3, 6)
            pole.translate(x, 0.65, z)
            poles.push(pole.toNonIndexed())
            const lamp = new THREE.SphereGeometry(0.11, 10, 8)
            lamp.translate(x, 1.36, z)
            lights.push(lamp)
            addCircle(x, z, 0.12)
          }
        }
      }
    }
    return { stones: mergeGeometries(stones)!, poles: mergeGeometries(poles)!, lights: mergeGeometries(lights)! }
  }, [])
  return (
    <group>
      <mesh geometry={geo.stones} material={M.stone} receiveShadow />
      <mesh geometry={geo.poles} material={M.trim} castShadow />
      <mesh geometry={geo.lights} material={GLOW_WARM} />
    </group>
  )
}

/** 🚀 산타 로켓: 빨강·흰 줄무늬 몸통, 둥근 창, 날개 셋, 꼭대기 별. 발사 버튼을 누르면 덜덜 떨며 연기 */
function Rocket() {
  const body = useRef<THREE.Group>(null)
  const smoke = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const k = t - game.rocketAt
    const shaking = k >= 0 && k < 2.6
    if (body.current) {
      body.current.position.x = shaking ? Math.sin(t * 60) * 0.04 : 0
      body.current.position.y = shaking ? Math.min(0.25, k * 0.15) : Math.max(0, body.current.position.y - 0.02)
    }
    if (smoke.current) {
      smoke.current.visible = k >= 0 && k < 3.2
      smoke.current.children.forEach((c, i) => {
        const p = ((t * 0.9 + i * 0.21) % 1) // 0..1
        c.position.set(Math.cos(i * 2.4) * (0.4 + p * 1.6), 0.25 + p * 0.6, Math.sin(i * 2.4) * (0.4 + p * 1.6))
        c.scale.setScalar(0.25 + p * 0.6)
      })
    }
  })
  return (
    <group position={[ROCKET.x, 0, ROCKET.z]}>
      {/* 발사대: 둥근 금속판 + 빛나는 테두리 */}
      <mesh position={[0, 0.08, 0]} material={METAL} receiveShadow>
        <cylinderGeometry args={[ROCKET.r, ROCKET.r + 0.15, 0.16, 32]} />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]} material={GLOW_CYAN}>
        <ringGeometry args={[ROCKET.r - 0.25, ROCKET.r - 0.12, 48]} />
      </mesh>
      <group ref={body}>
        <group position={[0, 0.16, 0]}>
          {/* 몸통: 흰색 + 빨간 띠 */}
          <mesh position={[0, 2.0, 0]} material={ROCKET_WHITE} castShadow>
            <cylinderGeometry args={[0.85, 0.95, 3.4, 24]} />
          </mesh>
          {[1.0, 2.9].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={ROCKET_RED}>
              <cylinderGeometry args={[0.9, 0.92, 0.32, 24]} />
            </mesh>
          ))}
          <mesh position={[0, 4.4, 0]} material={ROCKET_RED} castShadow>
            <coneGeometry args={[0.85, 1.4, 24]} />
          </mesh>
          <mesh position={[0, 5.25, 0]} material={M.gold}>
            <octahedronGeometry args={[0.22, 0]} />
          </mesh>
          {/* 둥근 창 (마을 쪽) */}
          {[2.05, 3.45].map((y) => (
            <group key={y} position={[0, y, 0]} rotation={[0, Math.atan2(-ROCKET.x, -ROCKET.z), 0]}>
              <mesh position={[0, 0, 0.86]} material={WINDOW}>
                <circleGeometry args={[0.3, 20]} />
              </mesh>
              <mesh position={[0, 0, 0.855]} material={METAL}>
                <ringGeometry args={[0.3, 0.38, 20]} />
              </mesh>
            </group>
          ))}
          {/* 날개 셋 */}
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]}>
              <mesh position={[0, 0.65, 1.05]} material={ROCKET_RED} castShadow>
                <boxGeometry args={[0.12, 1.3, 0.7]} />
              </mesh>
            </group>
          ))}
          {/* 엔진 */}
          <mesh position={[0, 0.12, 0]} material={METAL}>
            <cylinderGeometry args={[0.55, 0.7, 0.3, 16]} />
          </mesh>
        </group>
      </group>
      <group ref={smoke} visible={false}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} material={M.snowShade}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}
      </group>
      <SpotLabel position={[0, 6.4, 0]} text="🚀 산타 로켓 발사대" />
    </group>
  )
}

/** 🔭 별 망원경: 세 다리 위 긴 통이 하늘(고리 행성 쪽)을 본다 */
function Telescope() {
  return (
    <group position={[SCOPE.x, 0, SCOPE.z]} rotation={[0, 0.6, 0]}>
      <mesh position={[0, 0.06, 0]} material={M.stoneDark} receiveShadow>
        <cylinderGeometry args={[SCOPE.r, SCOPE.r + 0.1, 0.12, 24]} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.35, 0.65, Math.sin(a) * 0.35]} rotation={[Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]} material={M.woodDark}>
            <cylinderGeometry args={[0.04, 0.05, 1.3, 6]} />
          </mesh>
        )
      })}
      <group position={[0, 1.35, 0]} rotation={[0.9, 0, 0]}>
        <mesh material={M.gold} castShadow>
          <cylinderGeometry args={[0.16, 0.12, 1.6, 16]} />
        </mesh>
        <mesh position={[0, 0.82, 0]} material={WINDOW}>
          <cylinderGeometry args={[0.165, 0.165, 0.04, 16]} />
        </mesh>
      </group>
      <SpotLabel position={[0, 2.6, 0]} text="🔭 별 망원경" />
    </group>
  )
}

/** 💎 빛나는 얼음 수정 덤불: 바깥 링 여기저기 (길·놀이 구역은 비운다) */
const CRYSTALS = (() => {
  const r = rng(88)
  const out: { x: number; z: number; s: number; pink: boolean }[] = []
  for (let i = 0; i < 200 && out.length < 18; i++) {
    const a = r() * Math.PI * 2
    const rad = 19 + r() * (ISLAND_EDGE - 22)
    const x = Math.cos(a) * rad
    const z = Math.sin(a) * rad
    const s = 0.6 + r() * 0.7
    const pink = r() < 0.35
    if (Math.abs(x) < 4.5 && z > 0) continue
    if (onPath(x, z, 1.8) || onDecor(x, z) || onSledRun(x, z)) continue
    if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 1.5 || Math.hypot(x - ROLL.x, z - ROLL.z) < ROLL.r + 1.5) continue
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 5)) continue
    out.push({ x, z, s, pink })
  }
  for (const c of out) addCircle(c.x, c.z, c.s * 0.7)
  return out
})()
/** 수정 자리 (나무를 피해 세우도록 Village 가 쓴다) */
export const onCrystal = (x: number, z: number) => CRYSTALS.some((c) => Math.hypot(c.x - x, c.z - z) < c.s + 1.2)

function Crystals() {
  const geo = useMemo(() => {
    const r = rng(89)
    const cyan: THREE.BufferGeometry[] = []
    const pink: THREE.BufferGeometry[] = []
    for (const c of CRYSTALS) {
      for (let k = 0; k < 5; k++) {
        const g = new THREE.OctahedronGeometry(c.s * (0.3 + r() * 0.35), 0)
        g.scale(0.55, 1.9, 0.55)
        g.rotateZ((r() - 0.5) * 0.9)
        g.rotateX((r() - 0.5) * 0.6)
        g.translate(c.x + (r() - 0.5) * c.s, c.s * 0.5, c.z + (r() - 0.5) * c.s)
        ;(c.pink ? pink : cyan).push(g)
      }
    }
    return { cyan: cyan.length ? mergeGeometries(cyan) : null, pink: pink.length ? mergeGeometries(pink) : null }
  }, [])
  return (
    <group>
      {geo.cyan && <mesh geometry={geo.cyan} material={GLOW_CYAN} castShadow />}
      {geo.pink && <mesh geometry={geo.pink} material={GLOW_PINK} castShadow />}
    </group>
  )
}

/** 길 시작점 이정표 */
function Signs() {
  const at = (p: { x: number; z: number }[], y: number): V3 => [p[0].x, y, p[0].z]
  return (
    <>
      <SpotLabel position={at(ZONE_PATHS[0], 2.3)} text="⚔️ 눈싸움장 · ⛄ 눈굴리기장 →" />
      <SpotLabel position={at(ZONE_PATHS[2], 2.3)} text="← 🛷 썰매 산" />
    </>
  )
}

export function Decor() {
  return (
    <group>
      <Lanterns />
      <Paths />
      <Rocket />
      <Telescope />
      <Crystals />
      <Signs />
    </group>
  )
}
