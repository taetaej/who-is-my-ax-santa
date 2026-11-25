import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RecordBoard } from './Boards'
import type { CookieState } from './Cookie'
import { game } from './game'
import { M, rng } from './materials'
import { SpotLabel } from './Spots'
import { ARENA, FORTS, ROLL, ROLL_ROCKS } from './world'

// 🪐 바깥 링 놀이 구역: ⚔️ 눈싸움장, ⛄ 눈굴리기장 (움직임 계산은 Player · snowball.ts · rolling.ts)

const FLAG_RED = new THREE.MeshStandardMaterial({ color: '#d2392f', roughness: 0.7, side: THREE.DoubleSide })
const FLAG_BLUE = new THREE.MeshStandardMaterial({ color: '#2f62b0', roughness: 0.7, side: THREE.DoubleSide })
const POLE = new THREE.MeshStandardMaterial({ color: '#f6f1e7', roughness: 0.5 })
const PACKED = new THREE.MeshStandardMaterial({ color: '#e6eefb', roughness: 0.9 })
const ROCK = new THREE.MeshStandardMaterial({ color: '#6f6a86', roughness: 1, flatShading: true })

/** 둘레를 따라 낮은 눈 둔덕 */
function bank(cx: number, cz: number, r: number, seed: number, gapAt?: number) {
  const rand = rng(seed)
  const parts: THREE.BufferGeometry[] = []
  const n = Math.floor((Math.PI * 2 * r) / 0.9)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    if (gapAt !== undefined && Math.abs(((a - gapAt + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35) continue
    const g = new THREE.SphereGeometry(1, 8, 5)
    const s = 0.45 + rand() * 0.25
    g.scale(s * 1.3, s * 0.55, s)
    g.rotateY(-a)
    g.translate(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r)
    parts.push(g)
  }
  return mergeGeometries(parts)!
}

/** 눈덩이 더미 (피라미드) */
function pile(x: number, z: number) {
  const parts: THREE.BufferGeometry[] = []
  const layers = [
    [-0.12, 0, -0.12],
    [0.12, 0, -0.12],
    [-0.12, 0, 0.12],
    [0.12, 0, 0.12],
    [0, 0.17, 0],
  ]
  for (const [dx, dy, dz] of layers) {
    const g = new THREE.SphereGeometry(0.12, 10, 8)
    g.translate(x + dx, 0.12 + dy, z + dz)
    parts.push(g)
  }
  return mergeGeometries(parts)!
}

/** ⚔️ 눈싸움장: 둥근 눈 둔덕 안에 눈 요새 네 개, 요새 뒤마다 눈덩이 더미, 빨강·파랑 깃발 */
export function Arena() {
  const geo = useMemo(() => {
    const toCenter = Math.atan2(-ARENA.z, -ARENA.x) // 마을 쪽(입구)은 비운다
    const walls: THREE.BufferGeometry[] = []
    const piles: THREE.BufferGeometry[] = []
    for (const f of FORTS) {
      // 벽 + 위쪽 톱니
      const w = new THREE.BoxGeometry(f.hw * 2, f.h, f.hd * 2)
      w.translate(0, f.h / 2, 0)
      const teeth: THREE.BufferGeometry[] = [w]
      for (let k = -2; k <= 2; k++) {
        const t = new THREE.BoxGeometry(0.32, 0.22, f.hd * 2)
        t.translate(k * 0.5, f.h + 0.11, 0)
        teeth.push(t)
      }
      const g = mergeGeometries(teeth)!
      g.rotateY(f.rot)
      g.translate(f.x, 0, f.z)
      walls.push(g)
      // 요새 뒤(바깥쪽)에 눈덩이 더미
      const ox = f.x - ARENA.x
      const oz = f.z - ARENA.z
      const d = Math.hypot(ox, oz)
      piles.push(pile(f.x + (ox / d) * 0.9, f.z + (oz / d) * 0.9))
    }
    return { bank: bank(ARENA.x, ARENA.z, ARENA.r + 0.3, 31, toCenter), walls: mergeGeometries(walls)!, piles: mergeGeometries(piles)! }
  }, [])
  const flags = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2
        return { x: ARENA.x + Math.cos(a) * (ARENA.r - 0.4), z: ARENA.z + Math.sin(a) * (ARENA.r - 0.4), red: i % 2 === 0 }
      }),
    [],
  )
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ARENA.x, 0.012, ARENA.z]} material={PACKED} receiveShadow>
        <circleGeometry args={[ARENA.r, 48]} />
      </mesh>
      <mesh geometry={geo.bank} material={M.snowShade} castShadow receiveShadow />
      <mesh geometry={geo.walls} material={M.snow} castShadow receiveShadow />
      <mesh geometry={geo.piles} material={M.snow} castShadow />
      {flags.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <mesh position={[0, 0.9, 0]} material={POLE}>
            <cylinderGeometry args={[0.035, 0.035, 1.8, 6]} />
          </mesh>
          <mesh position={[0, 1.55, 0.2]} rotation={[0, Math.PI / 2, 0]} material={f.red ? FLAG_RED : FLAG_BLUE}>
            <planeGeometry args={[0.42, 0.28]} />
          </mesh>
        </group>
      ))}
      <SpotLabel position={[ARENA.x, 2.6, ARENA.z]} text="⚔️ AX 눈싸움장" />
    </group>
  )
}

const MAX_LEFT = 12
const tmp = new THREE.Object3D()

/** ⛄ 눈굴리기장: 보송한 눈밭, 바위 세 개, 기록판. 내가 굴린 눈덩이는 끝난 자리에 남는다 */
export function RollField({ boards = false }: { boards?: boolean; me?: MutableRefObject<CookieState | null> }) {
  const geo = useMemo(() => {
    const rocks: THREE.BufferGeometry[] = []
    const caps: THREE.BufferGeometry[] = []
    for (const r of ROLL_ROCKS) {
      const g = new THREE.DodecahedronGeometry(r.r, 0)
      g.scale(1, 0.75, 1)
      g.translate(r.x, r.r * 0.55, r.z)
      rocks.push(g)
      const c = new THREE.SphereGeometry(r.r * 0.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)
      c.scale(1, 0.4, 1)
      c.translate(r.x, r.r * 0.95, r.z)
      caps.push(c)
    }
    const toCenter = Math.atan2(-ROLL.z, -ROLL.x)
    return { bank: bank(ROLL.x, ROLL.z, ROLL.r + 0.3, 47, toCenter), rocks: mergeGeometries(rocks)!, caps: mergeGeometries(caps)! }
  }, [])
  const left = useRef<THREE.InstancedMesh>(null)
  const ballGeo = useMemo(() => new THREE.SphereGeometry(1, 20, 14), [])
  useFrame(() => {
    const m = left.current
    if (!m) return
    const list = game.leftBalls.slice(-MAX_LEFT)
    m.count = list.length
    list.forEach((b, i) => {
      tmp.position.set(b.x, b.r * 0.92, b.z)
      tmp.scale.setScalar(b.r)
      tmp.rotation.set(b.rx, 0, b.rz)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  const sign = { x: ROLL.x - Math.cos(-0.85) * (ROLL.r + 1.2) + 1.6, z: ROLL.z - Math.sin(-0.85) * (ROLL.r + 1.2) + 1.2 }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROLL.x, 0.012, ROLL.z]} material={M.snow} receiveShadow>
        <circleGeometry args={[ROLL.r, 48]} />
      </mesh>
      <mesh geometry={geo.bank} material={M.snowShade} castShadow receiveShadow />
      <mesh geometry={geo.rocks} material={ROCK} castShadow receiveShadow />
      <mesh geometry={geo.caps} material={M.snow} />
      <instancedMesh ref={left} args={[ballGeo, M.snow, MAX_LEFT]} castShadow receiveShadow frustumCulled={false} />
      <SpotLabel position={[ROLL.x, 2.6, ROLL.z]} text="⛄ AX 눈굴리기장" />
      {boards && <RecordBoard kind="roll" footer="40초 동안 굴려서 크게! 바위 조심" position={[sign.x, 0, sign.z]} rotation={-0.5} />}
    </group>
  )
}
