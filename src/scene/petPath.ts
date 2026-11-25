import { groundY, resolve } from './world'

// 🐈🐕 고양이·강아지가 걷는 길 (그리기와 따로: 테스트에서도 쓴다)

/** 씨앗이 같으면 늘 같은 순서 (모두의 화면에서 같은 길) */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const SEG = 9 // 한 걸음(이동 + 쉬기) 초
const SPEED = 0.85 // m/초
const TOUR = 50 // 갔다가 되돌아오는 걸음 수 (100 걸음마다 처음으로)

// ── 걸어 다닐 수 있는 자리: 마을 안(광장 연못 밖 ~ 등불 기둥 안), 부딪히는 물건·언덕이 없는 곳 ──
const free = (x: number, z: number) => {
  const q = resolve(x, z, 0.35)
  return Math.hypot(q.x - x, q.z - z) < 1e-3 && groundY(x, z) === 0
}
// 부딪히는 물건들은 각 장면이 그려질 때 등록되므로, 처음 쓸 때(펫이 그려질 때) 한 번만 계산한다
let SAFE_CACHE: { x: number; z: number }[] | null = null
const safeSpots = () => (SAFE_CACHE ??= (() => {
  const out: { x: number; z: number }[] = []
  for (let x = -16; x <= 16; x += 1.1)
    for (let z = -16; z <= 16; z += 1.1) {
      const r = Math.hypot(x, z)
      if (r > 5.6 && r < 15.4 && free(x, z)) out.push({ x, z })
    }
  return out
})())
const clearLine = (a: { x: number; z: number }, b: { x: number; z: number }) => {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3)
  for (let i = 1; i < n; i++) if (!free(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false
  return true
}

/** 펫마다 정해진 길: 무작위 걸음 TOUR 개를 갔다가 그대로 되돌아온다 (끊김 없이 반복) */
export function tour(seed: number) {
  const rand = rng(seed)
  const SAFE = safeSpots()
  if (!SAFE.length) return [{ x: 8, z: 8 }]
  const path = [SAFE[Math.floor(rand() * SAFE.length)]]
  for (let i = 0; i < TOUR; i++) {
    const cur = path[path.length - 1]
    const near = SAFE.filter((p) => {
      const d = Math.hypot(p.x - cur.x, p.z - cur.z)
      return d > 1.4 && d < 4.2 && clearLine(cur, p)
    })
    path.push(near.length ? near[Math.floor(rand() * near.length)] : cur)
  }
  return [...path, ...path.slice(1, -1).reverse()]
}

/** 지금 시각의 자리·방향·걷는 중인지 */
export function poseAt(path: { x: number; z: number }[], t: number, offset: number) {
  const tt = t + offset
  const n = Math.floor(tt / SEG)
  const f = tt - n * SEG
  const a = path[((n % path.length) + path.length) % path.length]
  const b = path[(((n + 1) % path.length) + path.length) % path.length]
  const d = Math.hypot(b.x - a.x, b.z - a.z)
  const walk = d / SPEED
  const heading = d > 0.01 ? Math.atan2(b.x - a.x, b.z - a.z) : 0
  if (f < walk) {
    const k = f / walk
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, rot: heading, walking: true }
  }
  return { x: b.x, z: b.z, rot: heading, walking: false }
}

