// ☃️ 눈싸움: 눈밭 안에서 F 를 누르면 바라보는 쪽으로 눈덩이를 던진다. 점수는 없다 (그냥 재미).
// - 과녁 눈사람 3개를 맞히면 흔들리고, 접속한 동료를 맞히면 그 사람 화면에 "퍽!"
// - 실시간: 던질 때 {k:'ball'} 를 방송하면 다른 사람 화면에도 같은 눈덩이가 날아간다.
//   맞았는지는 맞은 사람 화면이 판단하고 {k:'hit'} 를 방송해 던진 사람에게 "명중!"을 알린다.
// 화면(React)과 3D 장면이 같이 쓰는 작은 저장소. 서버·DB 에는 아무것도 남기지 않는다.

import type { CookieState } from './Cookie'
import { SPOT, addCircle, at } from './world'

export const FIELD_R = 3.8 // 눈밭 반지름 (이 안에서만 던질 수 있다)
export const THROW_COOLDOWN = 0.45 // 초
const SPEED = 9.5
const LIFT = 3.2
export const GRAVITY = 9.8
const BODY_R = 0.42 // 쿠키 몸통 반지름 (맞았다고 보는 거리)
const BODY_H = 1.35
export const TARGET_R = 0.5
const TARGET_H = 1.6

const [FX, , FZ] = at(SPOT.field)
export const FIELD = { x: FX, z: FZ }
export const inSnowField = (x: number, z: number) => Math.hypot(x - FX, z - FZ) < FIELD_R

/** 과녁 눈사람 3개: 눈밭 바깥쪽 가장자리에 (눈 요새·눈덩이 더미와 떨어지게) */
export const TARGETS = [-1.0, 0, 1.0].map((d) => {
  const a = SPOT.field.a + d
  return { x: FX + Math.cos(a) * 3.4, z: FZ + Math.sin(a) * 3.4, face: Math.atan2(FX - (FX + Math.cos(a)), FZ - (FZ + Math.sin(a))) }
})
for (const t of TARGETS) addCircle(t.x, t.z, 0.45)

export type Ball = { owner: number; ownerName: string; mine: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; done: boolean }
export type Splat = { x: number; y: number; z: number; age: number }
export type SnowMsg = { k: 'ball'; x: number; z: number; rot: number; by: number; name: string } | { k: 'hit'; by: number; name: string }
export type Body = { id: number; name: string; s: CookieState }

export const snow = {
  balls: [] as Ball[],
  splats: [] as Splat[],
  wobble: TARGETS.map(() => 0), // 과녁이 맞은 뒤 흔들림 (초)
  peers: new Map<number, Body>(), // 실시간 접속한 사람들 (connectionId → 쿠키 상태)
  me: null as Body | null,
  send: null as ((m: SnowMsg) => void) | null, // 실시간이면 방송
  say: null as ((text: string) => void) | null, // 내 쿠키 말풍선
  hitAt: 0, // 내가 맞은 시각 (performance.now) → 화면에 눈 범벅
  onHit: null as (() => void) | null,
}

/** 눈덩이 하나를 띄운다 (내가 던진 것 또는 방송으로 받은 것) */
export function spawnBall(x: number, z: number, rot: number, owner: number, ownerName: string, mine: boolean) {
  const dx = Math.sin(rot)
  const dz = Math.cos(rot)
  snow.balls.push({ owner, ownerName, mine, x: x + dx * 0.35, y: 1.0, z: z + dz * 0.35, vx: dx * SPEED, vy: LIFT, vz: dz * SPEED, done: false })
  if (snow.balls.length > 40) snow.balls.shift()
}

/** 내가 던진다: 화면에 띄우고 실시간이면 방송 */
export function throwBall(me: Body) {
  const { x, z, rot } = me.s
  spawnBall(x, z, rot, me.id, me.name, true)
  snow.send?.({ k: 'ball', x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, rot: Math.round(rot * 1000) / 1000, by: me.id, name: me.name })
}

/** 방송으로 받은 메시지 */
export function receive(m: SnowMsg) {
  if (m.k === 'ball') {
    if (m.by !== snow.me?.id) spawnBall(m.x, m.z, m.rot, m.by, m.name, false)
  } else if (m.k === 'hit' && m.by === snow.me?.id) {
    snow.say?.(`명중! 🎯 ${m.name}님`)
  }
}

const splat = (x: number, y: number, z: number) => {
  snow.splats.push({ x, y, z, age: 0 })
  if (snow.splats.length > 24) snow.splats.shift()
}

const hits = (b: Ball, x: number, z: number, r: number, h: number) => b.y < h && Math.hypot(b.x - x, b.z - z) < r

/** 한 프레임 진행: 날아가고, 부딪히면 눈이 튄다 */
export function stepSnow(dt: number) {
  for (const s of snow.splats) s.age += dt
  snow.splats = snow.splats.filter((s) => s.age < 0.6)
  snow.wobble = snow.wobble.map((w) => Math.max(0, w - dt))
  for (const b of snow.balls) {
    if (b.done) continue
    b.vy -= GRAVITY * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt
    // 과녁 눈사람
    const ti = TARGETS.findIndex((t) => hits(b, t.x, t.z, TARGET_R, TARGET_H))
    if (ti >= 0) {
      b.done = true
      splat(b.x, b.y, b.z)
      snow.wobble[ti] = 0.7
      if (b.mine) snow.say?.(['명중! ☃️', '퍽! 정확해 🎯', '눈사람 KO ⛄'][Math.floor(Math.random() * 3)])
      continue
    }
    // 나 (남이 던진 것만)
    const me = snow.me
    if (me && !b.mine && b.owner !== me.id && hits(b, me.s.x, me.s.z, BODY_R, BODY_H + me.s.y)) {
      b.done = true
      splat(b.x, b.y, b.z)
      snow.hitAt = performance.now()
      snow.onHit?.()
      snow.say?.(`퍽! 🥶 ${b.ownerName}님 눈덩이`)
      snow.send?.({ k: 'hit', by: b.owner, name: me.name })
      continue
    }
    // 다른 사람 (보이기만: 맞았는지는 그 사람 화면이 정한다)
    let peerHit = false
    for (const p of snow.peers.values()) {
      if (p.id === b.owner) continue
      if (hits(b, p.s.x, p.s.z, BODY_R, BODY_H)) {
        peerHit = true
        break
      }
    }
    if (peerHit || b.y <= 0.05) {
      b.done = true
      splat(b.x, Math.max(0.08, b.y), b.z)
    }
  }
  snow.balls = snow.balls.filter((b) => !b.done)
}
