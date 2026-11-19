import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { M, archShape, blobs, rng } from './materials'

type V3 = [number, number, number]

// ── 지붕: 두 장의 판 + 두툼한 눈 + 처마 끝 눈방울 ─────────────────
export function Roof({ w, h, rise, d, mat, over = 0.22 }: { w: number; h: number; rise: number; d: number; mat: THREE.Material; over?: number }) {
  const parts = useMemo(() => {
    const a = Math.atan2(rise, w / 2)
    const slope = w / 2 / Math.cos(a) + over
    const t = 0.1 // 지붕판 두께
    const ts = 0.16 // 눈 두께
    const depth = d + over * 2
    const sides = [1, -1].map((sx) => {
      const dir = new THREE.Vector2(Math.cos(a) * sx, -Math.sin(a))
      const nrm = new THREE.Vector2(Math.sin(a) * sx, Math.cos(a))
      const apex = new THREE.Vector2(0, h + rise)
      const mid = apex.clone().addScaledVector(dir, slope / 2)
      const board = mid.clone().addScaledVector(nrm, t / 2)
      const snow = mid.clone().addScaledVector(nrm, t + ts / 2)
      const eave = apex.clone().addScaledVector(dir, slope).addScaledVector(nrm, t + ts * 0.4)
      return { sx, rot: -a * sx, board, snow, eave, apex, dir, nrm }
    })
    // 처마를 따라 늘어진 눈방울 + 앞뒤 박공 가장자리의 눈방울 (레퍼런스의 물결 모양 눈)
    const pts: [number, number, number, number][] = []
    const r = rng(Math.round(w * 100 + d * 10 + rise))
    for (const s of sides) {
      for (let z = -depth / 2; z <= depth / 2 + 0.01; z += 0.2) {
        pts.push([s.eave.x + s.dir.x * 0.02, s.eave.y - 0.04, z, 0.1 + r() * 0.05])
      }
      for (const zf of [depth / 2, -depth / 2]) {
        for (let k = 0.08; k <= slope; k += 0.2) {
          const p = s.apex.clone().addScaledVector(s.dir, k).addScaledVector(s.nrm, t + ts * 0.5)
          pts.push([p.x, p.y - 0.03, zf, 0.09 + r() * 0.04])
        }
      }
    }
    return { sides, slope, t, ts, depth, drips: blobs(pts, 7) }
  }, [w, h, rise, d, over])

  return (
    <group>
      {parts.sides.map((s) => (
        <group key={s.sx}>
          <mesh position={[s.board.x, s.board.y, 0]} rotation={[0, 0, s.rot]} castShadow receiveShadow material={mat}>
            <boxGeometry args={[parts.slope, parts.t, parts.depth]} />
          </mesh>
          <mesh position={[s.snow.x, s.snow.y, 0]} rotation={[0, 0, s.rot]} castShadow receiveShadow material={M.snow}>
            <boxGeometry args={[parts.slope + 0.02, parts.ts, parts.depth + 0.06]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={parts.drips} material={M.snow} castShadow />
    </group>
  )
}

// ── 아치 창: 테두리 + 빛나는 유리 + 창살 ───────────────────────────
export function ArchWindow({ w = 0.42, h = 0.62, position, rotation = [0, 0, 0], frame = M.trim }: { w?: number; h?: number; position: V3; rotation?: V3; frame?: THREE.Material }) {
  const geo = useMemo(() => {
    const outer = new THREE.ShapeGeometry(archShape(w + 0.1, h + 0.08), 16)
    outer.translate(0, -0.04, 0)
    return { outer, glass: new THREE.ShapeGeometry(archShape(w, h), 16) }
  }, [w, h])
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo.outer} material={frame} position={[0, 0, 0.005]} />
      <mesh geometry={geo.glass} material={M.glow} position={[0, 0, 0.012]} />
      <mesh position={[0, h * 0.45, 0.02]} material={frame}>
        <boxGeometry args={[0.03, h * 0.9, 0.01]} />
      </mesh>
      <mesh position={[0, h * 0.42, 0.02]} material={frame}>
        <boxGeometry args={[w, 0.03, 0.01]} />
      </mesh>
      {/* 창턱 눈 */}
      <mesh position={[0, -0.05, 0.05]} material={M.snow}>
        <boxGeometry args={[w + 0.16, 0.05, 0.1]} />
      </mesh>
    </group>
  )
}

// ── 문 ─────────────────────────────────────────────────────────
export function Door({ position, mat = M.woodDark, w = 0.48, h = 0.82 }: { position: V3; mat?: THREE.Material; w?: number; h?: number }) {
  const geo = useMemo(() => {
    const frame = new THREE.ShapeGeometry(archShape(w + 0.1, h + 0.06), 16)
    frame.translate(0, -0.03, 0)
    return { frame, door: new THREE.ShapeGeometry(archShape(w, h), 16), glass: new THREE.ShapeGeometry(archShape(w * 0.5, w * 0.35), 12) }
  }, [w, h])
  return (
    <group position={position}>
      <mesh geometry={geo.frame} material={M.trim} position={[0, 0, 0.004]} />
      <mesh geometry={geo.door} material={mat} position={[0, 0, 0.01]} />
      <mesh geometry={geo.glass} material={M.glowSoft} position={[0, h - w * 0.45, 0.016]} />
      <mesh position={[w * 0.3, h * 0.42, 0.03]} material={M.gold}>
        <sphereGeometry args={[0.025, 8, 6]} />
      </mesh>
      {/* 계단 */}
      <mesh position={[0, 0.04, 0.18]} material={M.stone} receiveShadow castShadow>
        <boxGeometry args={[w + 0.3, 0.08, 0.3]} />
      </mesh>
    </group>
  )
}

// ── 리스 (빨간 리본) ─────────────────────────────────────────────
export function Wreath({ position, scale = 1 }: { position: V3; scale?: number }) {
  const berries = useMemo(() => {
    const pts: [number, number, number, number][] = []
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3
      pts.push([Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.05, 0.028])
    }
    return blobs(pts, 6)
  }, [])
  return (
    <group position={position} scale={scale}>
      <mesh material={M.wreath} castShadow>
        <torusGeometry args={[0.17, 0.065, 8, 20]} />
      </mesh>
      <mesh geometry={berries} material={M.berry} />
      <Bow position={[0, -0.17, 0.07]} />
    </group>
  )
}

export function Bow({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.07 * s, 0, 0]} rotation={[0, 0, (Math.PI / 2) * s]} material={M.ribbon}>
          <coneGeometry args={[0.055, 0.13, 8]} />
        </mesh>
      ))}
      <mesh material={M.ribbon}>
        <sphereGeometry args={[0.035, 8, 6]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={`t${s}`} position={[0.035 * s, -0.08, 0]} rotation={[0, 0, 0.35 * s]} material={M.ribbon}>
          <boxGeometry args={[0.035, 0.13, 0.01]} />
        </mesh>
      ))}
    </group>
  )
}

// ── 처마 아래 가랜드 + 전구 ───────────────────────────────────────
export function Garland({ from, to, sag = 0.18, bulbs = true }: { from: V3; to: V3; sag?: number; bulbs?: boolean }) {
  const { tube, lights } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const pts: THREE.Vector3[] = []
    const n = 3 // 늘어진 고리 개수
    for (let i = 0; i <= n * 8; i++) {
      const t = i / (n * 8)
      const p = a.clone().lerp(b, t)
      p.y -= Math.abs(Math.sin(t * Math.PI * n)) * sag
      pts.push(p)
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    const lights: { p: THREE.Vector3; m: number }[] = []
    if (bulbs) for (let i = 1; i < 14; i++) lights.push({ p: curve.getPoint(i / 14), m: i % 4 })
    return { tube: new THREE.TubeGeometry(curve, 48, 0.045, 6), lights }
  }, [from, to, sag, bulbs])
  return (
    <group>
      <mesh geometry={tube} material={M.wreath} />
      {lights.map((l, i) => (
        <mesh key={i} position={[l.p.x, l.p.y - 0.05, l.p.z + 0.02]} material={M.bulbs[l.m]}>
          <sphereGeometry args={[0.032, 8, 6]} />
        </mesh>
      ))}
    </group>
  )
}

// ── 병솔 트리 (눈 덮인 침엽수) ────────────────────────────────────
export function PineTree({ position, height = 2, seed = 1 }: { position: V3; height?: number; seed?: number }) {
  const geo = useMemo(() => {
    const r = rng(seed)
    const tiers = 6
    const green: THREE.BufferGeometry[] = []
    const snowPts: [number, number, number, number][] = []
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers
      const rad = height * 0.36 * (1 - t * 0.82)
      const hh = height * 0.3
      const y = height * 0.12 + t * height * 0.72
      const g = new THREE.ConeGeometry(rad, hh, 10, 1, true)
      g.translate(0, y + hh / 2, 0)
      green.push(g)
      // 가지 끝에 얹힌 눈
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + r() * 0.6
        const rr = rad * (0.55 + r() * 0.35)
        snowPts.push([Math.cos(a) * rr, y + hh * (0.18 + r() * 0.25), Math.sin(a) * rr, 0.045 + r() * 0.05])
      }
    }
    const top = new THREE.ConeGeometry(height * 0.08, height * 0.2, 8)
    top.translate(0, height * 0.94, 0)
    green.push(top)
    const trunk = new THREE.CylinderGeometry(height * 0.04, height * 0.05, height * 0.2, 6)
    trunk.translate(0, height * 0.1, 0)
    return { green: mergeGeometries(green)!, snow: blobs(snowPts, 6), trunk }
  }, [height, seed])
  return (
    <group position={position}>
      <mesh geometry={geo.trunk} material={M.woodDark} castShadow />
      <mesh geometry={geo.green} material={seed % 2 ? M.pine : M.pineDark} castShadow receiveShadow />
      <mesh geometry={geo.snow} material={M.snow} castShadow />
    </group>
  )
}

// ── 광장의 큰 트리: 장식 공, 전구, 별 ─────────────────────────────
export function BigTree({ position = [0, 0, 0] as V3 }: { position?: V3 }) {
  const deco = useMemo(() => {
    const r = rng(7)
    const ornaments: { p: V3; m: number }[] = []
    const lights: { p: V3; m: number }[] = []
    const H = 5.2
    for (let i = 0; i < 46; i++) {
      const t = 0.12 + r() * 0.72
      const a = r() * Math.PI * 2
      const rad = H * 0.34 * (1 - t * 0.85) * 0.95
      ornaments.push({ p: [Math.cos(a) * rad, H * t + 0.3, Math.sin(a) * rad], m: i % 3 })
    }
    // 나선형 전구 줄
    for (let i = 0; i < 120; i++) {
      const t = 0.1 + (i / 120) * 0.78
      const a = i * 0.42
      const rad = H * 0.34 * (1 - t * 0.85) * 1.0
      lights.push({ p: [Math.cos(a) * rad, H * t + 0.35, Math.sin(a) * rad], m: i % 4 })
    }
    return { ornaments, lights, H }
  }, [])
  return (
    <group position={position}>
      <PineTree position={[0, 0, 0]} height={deco.H} seed={11} />
      {deco.ornaments.map((o, i) => (
        <mesh key={i} position={o.p} material={M.ornaments[o.m]} castShadow>
          <sphereGeometry args={[0.1, 12, 10]} />
        </mesh>
      ))}
      {deco.lights.map((l, i) => (
        <mesh key={`l${i}`} position={l.p} material={M.bulbs[l.m]}>
          <sphereGeometry args={[0.04, 6, 5]} />
        </mesh>
      ))}
      <Star position={[0, deco.H + 0.25, 0]} />
      <pointLight position={[0, 3, 0]} color="#ffc270" intensity={18} distance={9} decay={2} />
    </group>
  )
}

function Star({ position }: { position: V3 }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.16 : 0.38
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 })
    g.translate(0, 0, -0.05)
    return g
  }, [])
  return (
    <mesh position={position} geometry={geo}>
      <meshStandardMaterial color="#ffe08a" emissive="#ffc23a" emissiveIntensity={3.5} toneMapped={false} />
    </mesh>
  )
}

// ── 가로등 ─────────────────────────────────────────────────────
export function Lamp({ position, light = false }: { position: V3; light?: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.08, 0]} material={M.iron} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 0.16, 8]} />
      </mesh>
      <mesh position={[0, 0.9, 0]} material={M.iron} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 1.6, 8]} />
      </mesh>
      <mesh position={[0, 1.82, 0]} material={M.glow}>
        <boxGeometry args={[0.2, 0.26, 0.2]} />
      </mesh>
      <mesh position={[0, 2.0, 0]} material={M.iron} castShadow>
        <coneGeometry args={[0.2, 0.16, 4]} />
      </mesh>
      <mesh position={[0, 2.08, 0]} material={M.snow}>
        <sphereGeometry args={[0.09, 8, 6]} />
      </mesh>
      {light && <pointLight position={[0, 1.8, 0]} color="#ffb860" intensity={5} distance={5} decay={2} />}
    </group>
  )
}

// ── 눈사람 (모자, 목도리) ────────────────────────────────────────
export function Snowman({ position, rotation = 0, scale = 1 }: { position: V3; rotation?: number; scale?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh position={[0, 0.42, 0]} material={M.snow} castShadow receiveShadow>
        <sphereGeometry args={[0.48, 20, 16]} />
      </mesh>
      <mesh position={[0, 1.08, 0]} material={M.snow} castShadow>
        <sphereGeometry args={[0.34, 20, 16]} />
      </mesh>
      <mesh position={[0, 1.6, 0]} material={M.snow} castShadow>
        <sphereGeometry args={[0.26, 20, 16]} />
      </mesh>
      {/* 목도리 */}
      <mesh position={[0, 1.36, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.scarf} castShadow>
        <torusGeometry args={[0.22, 0.07, 8, 20]} />
      </mesh>
      <mesh position={[0.12, 1.2, 0.22]} rotation={[0.2, 0, 0.15]} material={M.scarf}>
        <boxGeometry args={[0.12, 0.32, 0.05]} />
      </mesh>
      {/* 모자 */}
      <mesh position={[0, 1.83, 0]} material={M.coal} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 20]} />
      </mesh>
      <mesh position={[0, 2.02, 0]} material={M.coal} castShadow>
        <cylinderGeometry args={[0.19, 0.2, 0.36, 20]} />
      </mesh>
      <mesh position={[0, 1.9, 0]} material={M.ribbon}>
        <cylinderGeometry args={[0.205, 0.205, 0.07, 20]} />
      </mesh>
      {/* 얼굴 */}
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 1.66, 0.23]} material={M.coal}>
          <sphereGeometry args={[0.03, 8, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 1.6, 0.3]} rotation={[Math.PI / 2, 0, 0]} material={M.carrot}>
        <coneGeometry args={[0.035, 0.18, 8]} />
      </mesh>
      {[1.0, 1.12, 0.6, 0.42].map((y, i) => (
        <mesh key={i} position={[0, y, (i < 2 ? 0.33 : 0.47) - Math.abs(y - 1.06) * 0.1]} material={M.coal}>
          <sphereGeometry args={[0.035, 8, 6]} />
        </mesh>
      ))}
      {/* 나뭇가지 팔 */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.42 * s, 1.18, 0]} rotation={[0, 0, -0.9 * s]} material={M.woodDark}>
          <cylinderGeometry args={[0.018, 0.025, 0.5, 5]} />
        </mesh>
      ))}
    </group>
  )
}

// ── 선물 상자 ───────────────────────────────────────────────────
export function Present({ position, size = 0.35, m = 0, rotation = 0 }: { position: V3; size?: number; m?: number; rotation?: number }) {
  const ribbon = m === 3 ? M.gold : M.ribbon
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, size / 2, 0]} material={M.presents[m % 4]} castShadow receiveShadow>
        <boxGeometry args={[size, size, size]} />
      </mesh>
      <mesh position={[0, size / 2, 0]} material={ribbon}>
        <boxGeometry args={[size * 0.16, size + 0.01, size + 0.01]} />
      </mesh>
      <mesh position={[0, size / 2, 0]} material={ribbon}>
        <boxGeometry args={[size + 0.01, size + 0.01, size * 0.16]} />
      </mesh>
      <Bow position={[0, size + 0.03, 0]} scale={size * 2.2} />
    </group>
  )
}

// ── 포인세티아 화분 ─────────────────────────────────────────────
export function Poinsettia({ position }: { position: V3 }) {
  const leaves = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 7; i++) {
      const g = new THREE.ConeGeometry(0.05, 0.2, 4)
      g.rotateZ(Math.PI / 2)
      g.translate(0.1, 0, 0)
      g.rotateZ(0.35)
      g.rotateY((i / 7) * Math.PI * 2)
      parts.push(g)
    }
    return mergeGeometries(parts)!
  }, [])
  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]} material={M.pot} castShadow>
        <cylinderGeometry args={[0.13, 0.1, 0.2, 10]} />
      </mesh>
      <mesh position={[0, 0.22, 0]} material={M.wreath}>
        <sphereGeometry args={[0.13, 8, 6]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} geometry={leaves} material={M.berry} castShadow />
    </group>
  )
}

// ── 둥근 울타리 (받침 가장자리) ──────────────────────────────────
export function FenceRing({ radius, from = 0, to = Math.PI * 2, gap = 0.22 }: { radius: number; from?: number; to?: number; gap?: number }) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const n = Math.floor(((to - from) * radius) / gap)
    for (let i = 0; i <= n; i++) {
      const a = from + (i / n) * (to - from)
      const picket = new THREE.BoxGeometry(0.12, 0.6, 0.04)
      const tip = new THREE.ConeGeometry(0.085, 0.1, 4)
      tip.rotateY(Math.PI / 4)
      tip.translate(0, 0.35, 0)
      const p = mergeGeometries([picket.toNonIndexed(), tip.toNonIndexed()])!
      p.translate(0, 0.3, 0)
      p.rotateY(-a + Math.PI / 2)
      p.translate(Math.cos(a) * radius, 0, Math.sin(a) * radius)
      parts.push(p)
    }
    // 가로대 두 줄
    for (const y of [0.18, 0.44]) {
      const rail = new THREE.TorusGeometry(radius - 0.04, 0.025, 4, 160, to - from)
      rail.rotateX(Math.PI / 2)
      rail.rotateY(-from)
      rail.translate(0, y, 0)
      parts.push(rail.toNonIndexed())
    }
    return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!
  }, [radius, from, to, gap])
  return <mesh geometry={geo} material={M.trim} castShadow receiveShadow />
}

// ── 아치형 나무 다리 ────────────────────────────────────────────
export function Bridge({ position, rotation = 0, length = 2.4 }: { position: V3; rotation?: number; length?: number }) {
  const geo = useMemo(() => {
    const arch = (t: number) => Math.sin(t * Math.PI) * 0.42
    const planks: THREE.BufferGeometry[] = []
    const rails: THREE.BufferGeometry[] = []
    const n = 14
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = (t - 0.5) * length
      const y = arch(t) + 0.1
      const slope = Math.cos(t * Math.PI) * 0.42 * Math.PI / length
      const b = new THREE.BoxGeometry(length / n + 0.01, 0.06, 0.9)
      b.rotateZ(Math.atan(slope))
      b.translate(x, y, 0)
      planks.push(b)
      // 난간 기둥
      if (i % 2 === 0) {
        for (const z of [0.42, -0.42]) {
          const post = new THREE.BoxGeometry(0.05, 0.36, 0.05)
          post.translate(x, y + 0.2, z)
          rails.push(post)
        }
      }
    }
    for (const z of [0.42, -0.42]) {
      const pts = Array.from({ length: 20 }, (_, i) => {
        const t = i / 19
        return new THREE.Vector3((t - 0.5) * length, arch(t) + 0.48, z)
      })
      rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.03, 5).toNonIndexed())
    }
    return {
      planks: mergeGeometries(planks.map((g) => g.toNonIndexed()))!,
      rails: mergeGeometries(rails.map((g) => (g.index ? g.toNonIndexed() : g)))!,
    }
  }, [length])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={geo.planks} material={M.wood} castShadow receiveShadow />
      <mesh geometry={geo.rails} material={M.woodDark} castShadow />
    </group>
  )
}

// ── 벤치 ───────────────────────────────────────────────────────
export function Bench({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.32, 0]} material={M.wood} castShadow>
        <boxGeometry args={[1.0, 0.06, 0.32]} />
      </mesh>
      <mesh position={[0, 0.56, -0.15]} rotation={[-0.15, 0, 0]} material={M.wood} castShadow>
        <boxGeometry args={[1.0, 0.24, 0.05]} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]} material={M.iron}>
          <boxGeometry args={[0.05, 0.32, 0.3]} />
        </mesh>
      ))}
      <mesh position={[0, 0.37, 0]} material={M.snow}>
        <boxGeometry args={[0.9, 0.04, 0.26]} />
      </mesh>
    </group>
  )
}
