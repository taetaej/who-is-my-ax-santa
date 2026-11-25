// ☃️ 눈싸움: 마을 눈밭이나 ⚔️ 눈싸움장 안에서 F 를 누르면 바라보는 쪽으로 눈덩이를 던진다.
//   F 를 꾹 누를수록(최대 0.9초) 멀리·세게 날아가고 더 아프다 (gameRules.damageOf).
// - 과녁 눈사람 3개를 맞히면 흔들리고, 접속한 동료를 맞히면 그 사람 체력이 깎인다 (다 깎이면 기절)
// - 눈 요새 벽은 눈덩이를 막는다
// - 실시간: 던질 때 {k:'ball'} 를 방송하면 다른 사람 화면에도 같은 눈덩이가 날아간다.
//   맞았는지는 맞은 사람 화면이 판단하고 {k:'hit', dmg, ko} 를 방송해 던진 사람에게 "명중!"/"KO!"를 알린다.
//   쓰러진 동료를 깨우면 {k:'revive'} 를 보낸다.
// 화면(React)과 3D 장면이 같이 쓰는 작은 저장소. 서버·DB 에는 아무것도 남기지 않는다.

import { damageOf } from '../gameRules'
import { emotes } from './emote'
import { markPicked, POWER_INFO, type PowerKind } from './powerups'
import { launch } from './rocket'
import type { CookieState } from './Cookie'
import { FORTS, SPOT, addCircle, at, inArena } from './world'

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
/** 눈덩이를 던질 수 있는 곳: 마을 눈밭, ⚔️ 눈싸움장 */
export const canThrow = (x: number, z: number) => inSnowField(x, z) || inArena(x, z)

/** 과녁 눈사람 3개: 눈밭 바깥쪽 가장자리에 (눈 요새·눈덩이 더미와 떨어지게) */
export const TARGETS = [-1.0, 0, 1.0].map((d) => {
  const a = SPOT.field.a + d
  return { x: FX + Math.cos(a) * 3.4, z: FZ + Math.sin(a) * 3.4, face: Math.atan2(FX - (FX + Math.cos(a)), FZ - (FZ + Math.sin(a))) }
})
for (const t of TARGETS) addCircle(t.x, t.z, 0.45)

export type Ball = { owner: number; ownerName: string; mine: boolean; power: number; big: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; done: boolean }
export type Splat = { x: number; y: number; z: number; age: number }
export type SnowMsg =
  | { k: 'ball'; x: number; z: number; rot: number; by: number; name: string; p?: number; big?: boolean }
  | { k: 'hit'; by: number; name: string; dmg?: number; ko?: boolean; byName?: string } // name = 맞은 사람, byName = 던진 사람
  | { k: 'pick'; pad: number; cycle: number; name: string; kind: PowerKind } // ⚔️ 아이템을 누가 먹었다
  | { k: 'streak'; name: string; n: number } // 🔥 연속 기절시킴
  | { k: 'revive'; to: number; by: number; name: string }
  | { k: 'rocket'; name: string } // 🚀 누가 WithSet 호를 쐈다 (src/scene/rocket.ts)
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
  /** 내가 맞았다: 체력을 깎고 기절했는지 알려 준다. null 을 돌려주면 지금은 안 맞는다 (기절 중·막 일어남) */
  hurt: null as ((dmg: number, by: { id: number; name: string }) => { ko: boolean } | null) | null,
  /** ⚔️ 눈싸움 소식 (기절·연속 KO·아이템): 화면 위 소식판에 한 줄 */
  feed: null as ((text: string) => void) | null,
  /** 내가 던진 게 맞았다 (XP) */
  scored: null as ((ko: boolean) => void) | null,
  /** 동료가 나를 깨웠다 */
  revived: null as ((byName: string) => void) | null,
}

/** 눈덩이 하나를 띄운다 (내가 던진 것 또는 방송으로 받은 것) */
export function spawnBall(x: number, z: number, rot: number, owner: number, ownerName: string, mine: boolean, power = 0, big = false) {
  const dx = Math.sin(rot)
  const dz = Math.cos(rot)
  const sp = SPEED * (0.85 + 0.55 * power)
  snow.balls.push({ owner, ownerName, mine, power, big, x: x + dx * 0.35, y: 1.0, z: z + dz * 0.35, vx: dx * sp, vy: LIFT * (0.7 + 0.35 * power), vz: dz * sp, done: false })
  if (snow.balls.length > 40) snow.balls.shift()
}

/** 내가 던진다: 화면에 띄우고 실시간이면 방송 */
export function throwBall(me: Body, power = 0, big = false) {
  const { x, z, rot } = me.s
  const p = Math.round(Math.max(0, Math.min(1, power)) * 100) / 100
  spawnBall(x, z, rot, me.id, me.name, true, p, big)
  snow.send?.({ k: 'ball', x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, rot: Math.round(rot * 1000) / 1000, by: me.id, name: me.name, p, ...(big ? { big } : {}) })
}

/** 방송으로 받은 메시지 */
export function receive(m: SnowMsg) {
  if (m.k === 'ball') {
    if (m.by !== snow.me?.id) spawnBall(m.x, m.z, m.rot, m.by, m.name, false, m.p ?? 0, !!m.big)
  } else if (m.k === 'hit') {
    if (m.by === snow.me?.id) {
      snow.say?.(m.ko ? `KO! 🏆 ${m.name}님 기절 😵` : `명중! 🎯 ${m.name}님`)
      snow.scored?.(!!m.ko)
    }
    if (m.ko) snow.feed?.(`💥 ${m.byName ?? '누군가'} → ${m.name} KO!`)
  } else if (m.k === 'pick') {
    markPicked(m.pad, m.cycle)
    snow.feed?.(`${POWER_INFO[m.kind].icon} ${m.name}님이 ${POWER_INFO[m.kind].name} 획득!`)
  } else if (m.k === 'streak') {
    snow.feed?.(`🔥 ${m.name}님 ${m.n >= 3 ? `${m.n}연속` : '더블'} KO!!`)
  } else if (m.k === 'rocket') {
    if (launch()) emotes.toast?.(`🚀 ${m.name}님이 2027 WithSet 호를 쐈어요! 가보자고!!`)
  } else if (m.k === 'revive' && m.to === snow.me?.id) {
    snow.revived?.(m.name)
  }
}

const splat = (x: number, y: number, z: number) => {
  snow.splats.push({ x, y, z, age: 0 })
  if (snow.splats.length > 24) snow.splats.shift()
}

const hits = (b: Ball, x: number, z: number, r: number, h: number) => b.y < h && Math.hypot(b.x - x, b.z - z) < r
/** 눈 요새 벽에 막혔는지 */
const blocked = (b: Ball) =>
  FORTS.some((f) => {
    if (b.y > f.h + 0.25) return false
    const c = Math.cos(f.rot)
    const sn = Math.sin(f.rot)
    const dx = b.x - f.x
    const dz = b.z - f.z
    return Math.abs(dx * c - dz * sn) < f.hw + 0.08 && Math.abs(dx * sn + dz * c) < f.hd + 0.08
  })

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
    // 눈 요새 벽
    if (blocked(b)) {
      b.done = true
      splat(b.x, b.y, b.z)
      continue
    }
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
      const dmg = damageOf(b.power, b.big)
      const res = snow.hurt ? snow.hurt(dmg, { id: b.owner, name: b.ownerName }) : { ko: false }
      if (!res) continue // 기절 중이거나 막 일어났다: 맞아도 아무 일 없음
      snow.hitAt = performance.now()
      snow.onHit?.()
      if (!res.ko) snow.say?.(`퍽! 🥶 ${b.ownerName}님 눈덩이 -${dmg}`)
      snow.send?.({ k: 'hit', by: b.owner, byName: b.ownerName, name: me.name, dmg, ko: res.ko })
      if (res.ko) snow.feed?.(`💥 ${b.ownerName} → ${me.name} KO!`)
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

// 개발 중 확인용: 콘솔에서 __snow 로 눈덩이를 띄워 볼 수 있다 (배포 빌드에는 들어가지 않는다)
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __snow: typeof snow; __spawnBall: typeof spawnBall }).__snow = snow
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __spawnBall: typeof spawnBall }).__spawnBall = spawnBall
