import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { Look } from '../look'
import { Cookie, newCookieState, popOn, type CookieState } from './Cookie'
import { CLIMB_SPEED, POWER_MAX, POWER_TAP, READY_SECS, alongPath, bump, newRide, pickLane, shiftLane, sledDistance, stepDown, type Ride } from './sledRide'
import { game } from './game'
import { api } from '../api'
import { launch, rocket } from './rocket'

const ROCKET_LINES = [
  '3… 2… 1… 🚀 2027 WithSet 가보자고!!',
  '🚀 WithSet 호 발사! 목적지는 2027년 🌏',
  '🚀 AX팀 내년도 가보자고!! 🔥',
  '🚀 WithSet, 세상 밖으로 쏘아 올려!',
  '🚀 염원 한 스푼 추가요 ✨ 2027 WithSet!',
]
import { EMOTES, EMOTE_COOLDOWN, PUSH_SPEED, REACT_RANGE, emoteOf, emotes, type EmoteId } from './emote'
import type { Treasure } from './Village'
import { DIG_HITS, OPEN_RANGE, GLINT_RANGE, nearestSpot, needsDig } from '../treasure'
import { THROW_COOLDOWN, canThrow, snow, throwBall } from './snowball'
import { AMMO_MAX, AMMO_REFILL, CHARGE_SECS, HP_MAX, KO_WINDOW_MIN, REGEN_AFTER, REGEN_PER_SEC, REVIVE_HP, REVIVE_TAPS, SAFE_SECS, koSecs } from '../gameRules'
import { CRACK, ROLL_SECS, ballCm, growBall, rollSpeed } from './rolling'
import {
  AWARDS_ROT,
  COCOA_SIZE,
  ELF,
  FIRE_SEATS,
  PARTY,
  POST_SIZE,
  SLED_DIR,
  SLED_ROT,
  SPAWN,
  SPOT,
  actionAt,
  at,
  carolLevel,
  facadeView,
  groundY,
  ROLL,
  ROLL_ROCKS,
  inGallery,
  inRoll,
  onIce,
  polar,
  resolve,
  sledLocal,
  sledPoint,
} from './world'

// 내 쿠키: 방향키/WASD 이동, Shift 달리기, Space 인사, E 상호작용(앉기·눕기·핫초코·썰매…), 눈밭에서 F 눈덩이, 1~8 반응.
// 카메라는 화면 기준 고정 각도로 따라온다 (↑ 가 화면 위쪽).

const WALK = 3.2
const RUN = 5.6
const KEYS: Record<string, 'up' | 'down' | 'left' | 'right' | 'run' | 'rotL' | 'rotR'> = {
  KeyQ: 'rotL', // 🎥 카메라 왼쪽으로 돌기
  KeyR: 'rotR', // 🎥 카메라 오른쪽으로 돌기
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
}

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

type V = [number, number, number]
const FIRE = at(SPOT.fire)

/** 지금 있는 곳에 맞는 카메라 위치와 바라볼 곳. slow = 천천히 넘어가는 연출용 시점 */
function viewFor(s: CookieState, talking: boolean, overview: boolean, orbit: number): { cam: V; look: V; slow?: boolean } {
  // 🗺️ 마을 전경: 처음 들어올 때 화면처럼 마을 위를 천천히 한 바퀴 돈다 (움직일 수는 있다)
  if (overview) return { cam: [Math.cos(orbit - camView.yaw) * 66 * camView.zoom, 24 * camView.zoom, Math.sin(orbit - camView.yaw) * 66 * camView.zoom], look: [0, -3, 0], slow: true }
  // 🧝 엘프와 대화: 엘프 얼굴 쪽으로 다가간다
  if (talking) {
    // 나와 엘프가 함께 잡히도록 비스듬히, 둘 사이를 본다
    const mx = (s.x + ELF.x) / 2
    const mz = (s.z + ELF.z) / 2
    // 대화창이 화면 아래를 덮으니, 아래쪽을 보게 해서 두 캐릭터가 화면 위쪽에 오게 한다
    return { cam: [mx + 1.9, 2.3, mz + 3.6], look: [mx, 0.25, mz + 0.3], slow: true }
  }
  // 🛷 썰매: 언덕 위쪽 뒤에서 내려가는 쪽을 본다
  if (s.pose === 'sled' || groundY(s.x, s.z) > 0.25)
    return { cam: [s.x - SLED_DIR.x * 4.2, s.y + 2.4, s.z - SLED_DIR.z * 4.2 + 0.6], look: [s.x + SLED_DIR.x * 2.5, s.y * 0.5 + 0.2, s.z + SLED_DIR.z * 2.5] }
  // ❄️ 눈밭에 누우면: 바로 위에서 내려다본다 (스노우엔젤이 잘 보이게)
  if (s.pose === 'lie') return { cam: [s.x, 5.0, s.z + 1.0], look: [s.x, 0, s.z - 0.1], slow: true }
  // 🔥 불가에 앉으면: 자리 뒤 낮은 곳에서 불을 바라본다
  if (s.pose === 'sit') {
    const dx = s.x - FIRE[0]
    const dz = s.z - FIRE[2]
    const d = Math.hypot(dx, dz) || 1
    return { cam: [s.x + (dx / d) * 3.4, 2.5, s.z + (dz / d) * 3.4], look: [FIRE[0], 0.6, FIRE[2]], slow: true }
  }
  // 📜 연대기 전시 앞: 정면으로 낮게 다가가 글씨를 읽게
  if (inGallery(s.x, s.z)) return { cam: [s.x, 2.9, s.z + 3.9], look: [s.x, 1.7, s.z - 2.2], slow: true }
  // 🎂 파티 테이블 앞: 케이크를 가까이
  if (Math.hypot(s.x - PARTY.x, s.z - PARTY.z) < 2.4) return { cam: [s.x + 0.3, 2.8, s.z + 3.6], look: [PARTY.x, 1.15, PARTY.z], slow: true }
  // 🏪 건물 앞: ☕ AX 카페, 📮 AX 우편함은 정면에서, 🏆 투표소는 트로피 쪽에서
  for (const [spot, d, lookY, camY] of [
    [SPOT.cocoa, COCOA_SIZE.d / 2 + 0.55, 1.9, 2.4], // 카페는 차양 위 간판까지 보이게
    [SPOT.post, POST_SIZE.d / 2 + 0.5, 1.3, 3.3], // 우편함은 내 머리 너머로 간판이 보이게
  ] as const) {
    const [fx, , fz] = polar(spot.a, spot.r - d)
    if (Math.hypot(s.x - fx, s.z - fz) < 2.4) {
      const [cx, , cz] = at(spot)
      return { ...facadeView(cx, cz, -Math.cos(spot.a), -Math.sin(spot.a), d + 4.4, lookY, camY), slow: true }
    }
  }
  {
    const [bx, , bz] = at(SPOT.awards)
    const ux = Math.sin(AWARDS_ROT)
    const uz = Math.cos(AWARDS_ROT)
    if (Math.hypot(s.x - (bx + ux * 1.2), s.z - (bz + uz * 1.2)) < 2.2) return { ...facadeView(bx, bz, ux, uz, 4.0, 0.9), slow: true }
  }
  // 🎄 큰 트리(메시지 트리) 앞쪽: 트리를 올려다본다
  if (Math.hypot(s.x, s.z) < 4.6 && s.z > 0.8) return { cam: [s.x * 0.7, 2.1, s.z + 4.4], look: [0, 2.8, 0], slow: true }
  // 평소: 내 뒤 위에서 따라간다. 🎥 마우스 끌기·Q/R 로 돌리고, 위아래로 끌어 높이, 휠로 멀리/가까이 (camView)
  const r = CAM_DIST * camView.zoom
  const p = camView.pitch
  const y = Math.max(groundY(s.x, s.z) + 0.6, s.y + Math.sin(p) * r)
  const lookUp = Math.max(0, (CAM_PITCH - p) * 2.2) // 낮게 볼수록 앞을 더 멀리, 높게 본다
  return {
    cam: [s.x + Math.sin(camView.yaw) * Math.cos(p) * r, y, s.z + Math.cos(camView.yaw) * Math.cos(p) * r],
    look: [s.x - Math.sin(camView.yaw) * lookUp * 2, 0.7 + lookUp, s.z - Math.cos(camView.yaw) * lookUp * 2],
  }
}

/** 🎥 평소 시점 기본값: 뒤 위에서 (예전 고정 시점과 같은 거리·높이) */
const CAM_DIST = Math.hypot(7.5, 9.5)
const CAM_PITCH = Math.atan2(7.5, 9.5)
export const camView = {
  yaw: 0, // 0 = 남쪽(입구 쪽)에서 북쪽을 본다
  pitch: CAM_PITCH, // 위에서 내려다보는 각도 (0.12 ~ 1.3)
  zoom: 1, // 거리 배율 (0.45 ~ 1.9)
  facing: 0, // 지금 카메라가 바라보는 방향 (미니맵 시야 부채꼴)
  reset() {
    this.yaw = 0
    this.pitch = CAM_PITCH
    this.zoom = 1
  },
}
const clampPitch = (p: number) => Math.max(0.12, Math.min(1.3, p))
const clampZoom = (z: number) => Math.max(0.45, Math.min(1.9, z))

export type PanelAction = 'letter' | 'manito' | 'tree' | 'awards' | 'elf'

export function Player({
  name,
  seed,
  look,
  enabled,
  onPrompt,
  onOpen,
  onCarol,
  talkingToElf,
  overview,
  share,
  treasure,
  dig,
  onTreasure,
}: {
  name: string
  seed: number
  look?: Look | null
  enabled: MutableRefObject<boolean>
  onPrompt: (text: string | null) => void
  onOpen: (panel: PanelAction) => void // 우편함·게시판·트리에서 E → 창 열기
  onCarol?: (level: number) => void // 캐롤 무대와의 거리 → 0~1 볼륨
  talkingToElf?: boolean // 엘프와 대화 중이면 엘프를 클로즈업
  overview?: boolean // 마을 전경 보기
  share?: MutableRefObject<CookieState | null> // 실시간 공유용으로 내 상태를 밖에 알려준다
  treasure?: MutableRefObject<Treasure | null> // 🎀 보물찾기
  dig?: MutableRefObject<Map<string, number>> // 눈더미·얼음 판 횟수
  onTreasure?: (spot: string) => void
}) {
  const treasureCb = useRef(onTreasure)
  treasureCb.current = onTreasure
  const glinted = useRef(new Set<string>()) // "뭔가 반짝인다…?" 는 자리마다 한 번만
  const state = useRef(newCookieState(SPAWN.x, SPAWN.z, SPAWN.rot))
  if (share) share.current = state.current
  // 개발 중 확인용: 콘솔에서 __me.x = … 로 순간이동 (배포 빌드에는 들어가지 않는다)
  if (import.meta.env.DEV) (window as unknown as { __me: CookieState }).__me = state.current
  const held = useRef(new Set<string>())
  const vel = useRef({ x: 0, z: 0 })
  const jumpAt = useRef(-10)
  const sayUntil = useRef(0)
  const posedAt = useRef(0)
  const warmed = useRef(false)
  const knock = useRef({ x: 0, z: 0 }) // 🫸 밀린 속도 (점점 줄어든다)
  const emotedAt = useRef(-10)
  // ⚔️ 눈싸움: F 를 누르기 시작한 시각, 눈덩이 다시 뭉치는 시계, 쓰러진 동료 깨우기 (누구 · 몇 번)
  const chargeFrom = useRef<number | null>(null)
  const refill = useRef(0)
  const reviveTaps = useRef<{ id: number; n: number; at: number } | null>(null)
  // ⛄ 눈굴리기: 시작 시각, 눈덩이 반지름, 바위에 깨진 시각
  const roll = useRef<{ t0: number; r: number; crackAt: number } | null>(null)
  // 🛷 썰매: up = 언덕 오르기, ready = 꼭대기에서 출발 준비, down = 내려가기
  const ride = useRef<Ride | null>(null)
  const wasOnIce = useRef(false)
  const prompt = useRef<string | null>(null)
  const open = useRef(onOpen)
  open.current = onOpen
  const carol = useRef(-1)
  const talking = useRef(false)
  talking.current = !!talkingToElf
  const overviewRef = useRef(false)
  const orbit = useRef(Math.PI / 2)
  overviewRef.current = !!overview
  const { camera, clock, gl } = useThree()
  const camTarget = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const lookTmp = useMemo(() => new THREE.Vector3(), [])

  const say = (text: string, secs = 2.2) => {
    state.current.say = text
    sayUntil.current = clock.elapsedTime + secs
  }
  // ☃️ 눈싸움: 눈덩이 저장소에 나를 알려 둔다 (맞았는지 판단, 말풍선)
  const thrownAt = useRef(-10)
  snow.me = { id: seed, name, s: state.current }
  snow.say = (text) => say(text, 1.6)
  useEffect(
    () => () => {
      snow.me = null
      snow.say = null
    },
    [],
  )

  // 💬 반응: 가까운 동료가 있으면 그 사람에게
  function emote(id: EmoteId) {
    const s = state.current
    const t = clock.elapsedTime
    const def = emoteOf(id)
    if (!def || t - emotedAt.current < EMOTE_COOLDOWN) return
    emotedAt.current = t
    let to: { id: number; name: string; s: CookieState } | null = null
    let best = REACT_RANGE
    for (const p of snow.peers.values()) {
      const d = Math.hypot(p.s.x - s.x, p.s.z - s.z)
      if (d < best) {
        best = d
        to = p
      }
    }
    s.emote = { id, n: (s.emote?.n ?? 0) + 1, to: to?.id ?? null }
    popOn(s, def.icon)
    if (to) {
      popOn(to.s, def.icon)
      s.rot = Math.atan2(to.s.x - s.x, to.s.z - s.z) // 그 사람 쪽을 본다
    }
    say(to ? def.to(to.name) : def.say[Math.floor(Math.random() * def.say.length)], 2)
    if (id === 'hi' || id === 'fire') {
      if (s.pose === 'stand') jumpAt.current = t
      s.waveUntil = t + 1.4
    }
  }
  const emoteRef = useRef(emote)
  emoteRef.current = emote
  // 누가 나에게 반응을 보냈을 때
  function got(from: { id: number; name: string; x: number; z: number }, id: EmoteId) {
    const s = state.current
    const def = emoteOf(id)
    if (!def) return
    emotes.toast?.(def.got(from.name))
    if (id === 'move' && !ride.current) {
      standUp()
      const dx = s.x - from.x
      const dz = s.z - from.z
      const d = Math.hypot(dx, dz) || 1
      knock.current = { x: (dx / d) * PUSH_SPEED, z: (dz / d) * PUSH_SPEED }
      say(['으악 밀려났다 😵', '헉 비켜드릴게요 🙇', '왜 밀어요ㅋㅋ 😤'][Math.floor(Math.random() * 3)], 1.8)
    } else if (id === 'heart') say('💗 두근', 1.6)
    else if (id === 'skull') say('💀 …(영혼 가출)', 1.6)
  }
  const gotRef = useRef(got)
  gotRef.current = got
  useEffect(() => {
    emotes.fire = (id) => enabled.current && emoteRef.current(id)
    emotes.onGot = (from, id) => gotRef.current(from, id)
    return () => {
      emotes.fire = null
      emotes.onGot = null
    }
  }, [enabled])

  const standUp = () => {
    const s = state.current
    if (s.pose === 'stand' || s.pose === 'ko') return
    if (s.pose === 'lie') s.z += 0.5 // 누웠던 자리에서 일어나 앞으로
    s.pose = 'stand'
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!enabled.current || typing(e)) return
      const k = KEYS[e.code]
      if (k) {
        held.current.add(k)
        e.preventDefault()
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        const t = clock.elapsedTime
        // 🛷 꼭대기에서 Space 연타 = 출발 힘 모으기
        const r = ride.current
        if (r?.phase === 'ready') {
          r.power = Math.min(POWER_MAX, r.power + POWER_TAP)
          r.taps += 1
          const n = Math.round((r.power / POWER_MAX) * 5)
          say(`💪 ${'●'.repeat(n)}${'○'.repeat(5 - n)}`, 1)
          return
        }
        if (r) return
        if (state.current.pose === 'stand') jumpAt.current = t
        state.current.waveUntil = t + 1.6
        say('안녕! 👋')
      }
      if (e.code === 'KeyE' && !e.repeat) interact()
      if (e.code === 'KeyF' && !e.repeat) startCharge()
      // 💬 숫자키 1~8: 반응
      const n = /^Digit([1-8])$/.exec(e.code)
      if (n && !e.repeat) emoteRef.current(EMOTES[Number(n[1]) - 1].id)
    }
    const up = (e: KeyboardEvent) => {
      const k = KEYS[e.code]
      if (k) held.current.delete(k)
      if (e.code === 'Space' && !typing(e)) e.preventDefault()
      if (e.code === 'KeyF') throwSnow()
    }
    const blur = () => {
      held.current.clear()
      chargeFrom.current = null
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // F 를 누르면 모으기 시작, 떼면 던진다 (오래 누를수록 세게)
  function startCharge() {
    const s = state.current
    if (s.pose !== 'stand' || ride.current || roll.current || !canThrow(s.x, s.z)) return
    if (game.ammo < 1) return say('눈덩이가 없어요! 잠깐 기다리면 뭉쳐져요 ❄️', 1.4)
    chargeFrom.current = clock.elapsedTime
  }
  function throwSnow() {
    const from = chargeFrom.current
    chargeFrom.current = null
    game.charge = -1
    const s = state.current
    if (from === null || s.pose !== 'stand' || !canThrow(s.x, s.z) || game.ammo < 1) return
    const t = clock.elapsedTime
    if (t - thrownAt.current < THROW_COOLDOWN) return
    thrownAt.current = t
    s.waveUntil = t + 0.35 // 팔을 휘두른다
    game.ammo -= 1
    throwBall({ id: seed, name, s }, Math.min(1, (t - from) / CHARGE_SECS))
  }

  // ⚔️ 내가 맞았다: 체력을 깎고, 다 깎이면 기절 (10분 안에 또 기절하면 1분)
  function hurt(dmg: number, by: { id: number; name: string }): { ko: boolean } | null {
    const s = state.current
    const t = clock.elapsedTime
    if (s.pose === 'ko' || t < game.safeUntil || ride.current) return null
    game.hp = Math.max(0, game.hp - dmg)
    game.hurtAt = t
    popOn(s, `-${dmg}`)
    if (roll.current) {
      roll.current.r *= 0.8 // 맞으면 굴리던 눈덩이도 조금 부서진다
    }
    if (game.hp > 0) return { ko: false }
    const now = Date.now()
    game.kos = [...game.kos.filter((k) => now - k < KO_WINDOW_MIN * 60_000), now]
    game.koSecs = koSecs(game.kos.length)
    game.koUntil = t + game.koSecs
    game.koBy = by.name
    chargeFrom.current = null
    if (roll.current) finishRoll(false)
    standUp()
    s.pose = 'ko'
    s.cup = false
    held.current.clear()
    vel.current = { x: 0, z: 0 }
    say(`😵 ${by.name}님한테 당했다…`, 2.5)
    return { ko: true }
  }
  function wakeUp(text: string, hp: number) {
    const s = state.current
    s.pose = 'stand'
    game.koUntil = 0
    game.hp = hp
    game.safeUntil = clock.elapsedTime + SAFE_SECS
    jumpAt.current = clock.elapsedTime
    say(text, 2)
  }
  const hurtRef = useRef(hurt)
  hurtRef.current = hurt
  const wakeRef = useRef(wakeUp)
  wakeRef.current = wakeUp
  useEffect(() => {
    snow.hurt = (dmg, by) => hurtRef.current(dmg, by)
    snow.scored = (ko) => game.gainXp?.(ko ? 'ko' : 'hit')
    snow.revived = (by) => {
      if (state.current.pose === 'ko') wakeRef.current(`${by}님이 깨워 줬다! 🙌`, REVIVE_HP)
    }
    return () => {
      snow.hurt = null
      snow.scored = null
      snow.revived = null
    }
  }, [])

  /** 가까이 쓰러진 동료 (깨울 수 있는 사람) */
  function downedNear() {
    const s = state.current
    for (const p of snow.peers.values()) if (p.s.pose === 'ko' && Math.hypot(p.s.x - s.x, p.s.z - s.z) < 1.4) return p
    return null
  }

  // ⛄ 눈굴리기 끝: 기록을 올리고 눈덩이는 그 자리에 남긴다
  function finishRoll(record = true) {
    const rl = roll.current
    const s = state.current
    if (!rl) return
    roll.current = null
    game.roll = null
    const r = rl.r
    s.ball = 0
    const cm = ballCm(r)
    const ahead = 0.28 + r
    game.leftBalls = [...game.leftBalls.slice(-11), { x: s.x + Math.sin(s.rot) * ahead, z: s.z + Math.cos(s.rot) * ahead, r, rx: Math.random() * 6, rz: Math.random() * 6 }]
    if (!record) return
    say(`⛄ ${cm}cm! ${cm >= 200 ? '거대하다!! 😲' : cm >= 120 ? '꽤 큰데? 😎' : '귀엽다 ☃️'}`, 2.4)
    game.finish.roll?.(cm)
  }

  function interact() {
    const s = state.current
    if (ride.current || s.pose === 'ko') return
    if (s.pose !== 'stand') return standUp()
    if (roll.current) return finishRoll()
    // 😵 쓰러진 동료 깨우기: E 를 여러 번
    const down = downedNear()
    if (down) {
      const t = clock.elapsedTime
      const rv = reviveTaps.current
      const n = rv && rv.id === down.id && t - rv.at < 2 ? rv.n + 1 : 1
      reviveTaps.current = { id: down.id, n, at: t }
      jumpAt.current = t
      if (n < REVIVE_TAPS) return say(`${down.name}님 일어나요! 👋 (${n}/${REVIVE_TAPS})`, 1)
      reviveTaps.current = null
      snow.send?.({ k: 'revive', to: down.id, by: seed, name })
      game.gainXp?.('revive')
      return say(`${down.name}님 구조 완료! 🙌`, 1.6)
    }
    const tr = treasure?.current
    const sp = tr ? nearestSpot(s.x, s.z, tr.hidden) : null
    if (sp && tr) {
      if (tr.mine) return say('숨은 선물은 1인 1개! 양보해요 🎄')
      const hits = dig?.current.get(sp.id) ?? 0
      if (needsDig(sp.kind) && hits < DIG_HITS - 1) {
        dig?.current.set(sp.id, hits + 1)
        jumpAt.current = clock.elapsedTime
        return say(sp.kind === 'ice' ? `쨍! 🧊 (${hits + 1}/${DIG_HITS})` : `파바박 ❄️ (${hits + 1}/${DIG_HITS})`)
      }
      dig?.current.delete(sp.id)
      held.current.clear()
      treasureCb.current?.(sp.id)
      return
    }
    const here = actionAt(s.x, s.z)
    if (!here) return
    switch (here.action) {
      case 'letter':
      case 'manito':
      case 'tree':
      case 'awards':
      case 'elf':
        held.current.clear()
        open.current(here.action)
        break
      case 'cake':
        say(['냠냠 🍰 맛있다!', '🎂 파티다~!', '🍓 딸기 내 거!', '🎉 2026 수고했어 AX!'][Math.floor(Math.random() * 4)])
        jumpAt.current = clock.elapsedTime
        break
      case 'cocoa':
        if (s.cup) say('벌써 들고 있어요 ☕')
        else {
          s.cup = true
          say('핫초코 받았다! ☕')
        }
        break
      case 'sit': {
        let best = FIRE_SEATS[0]
        for (const seat of FIRE_SEATS) if (Math.hypot(seat.x - s.x, seat.z - s.z) < Math.hypot(best.x - s.x, best.z - s.z)) best = seat
        s.x = best.x
        s.z = best.z
        s.rot = best.rot
        s.pose = 'sit'
        posedAt.current = clock.elapsedTime
        warmed.current = false
        vel.current = { x: 0, z: 0 }
        break
      }
      case 'sled':
        // 타는 곳에서 꼭대기까지 언덕길을 따라 올라간다 (영차영차)
        {
          const here = sledLocal(s.x, s.z)
          // 꼭대기에 이미 있는 썰매들과 가장 먼 줄로 간다
          const taken = [...snow.peers.values()].filter((p) => p.s.pose === 'sled').map((p) => sledLocal(p.s.x, p.s.z)).filter((q) => q.s < 0.6).map((q) => q.w)
          ride.current = newRide(here.s, clock.elapsedTime, here.w, pickLane(taken))
        }
        s.cup = false
        say('영차영차 🧗', 1.6)
        break
      case 'roll':
        roll.current = { t0: clock.elapsedTime, r: 0.15, crackAt: -10 }
        s.cup = false
        say('영차! 눈덩이 굴리기 시작 ⛄', 1.6)
        break
      case 'arena':
        break
      case 'rocket':
        jumpAt.current = clock.elapsedTime
        if (!launch()) {
          say('🚀 WithSet 호 비행 중! 다음 로켓 준비할게요 🔧', 2)
          break
        }
        say(ROCKET_LINES[Math.floor(Math.random() * ROCKET_LINES.length)], 2.8)
        snow.send?.({ k: 'rocket', name: snow.me?.name ?? '' })
        api.rocketWish().then((r) => (rocket.wishes = r.wishes), () => {})
        break
      case 'scope':
        say(['🔭 지구가 보인다! AX팀 안녕~ 👋', '🔭 고리 행성 옆에 썰매가…?!', '🔭 별똥별이다! 소원 빌어요 ✨', '🔭 달에도 눈이 오나 봐 ❄️'][Math.floor(Math.random() * 4)], 2.6)
        break
      case 'lie':
        s.pose = 'lie'
        s.rot = 0 // 머리가 화면 위쪽, 얼굴이 하늘을 보게
        posedAt.current = clock.elapsedTime
        vel.current = { x: 0, z: 0 }
        say('스노우엔젤 ❄️')
        break
    }
  }

  const setPrompt = (p: string | null) => {
    if (p !== prompt.current) {
      prompt.current = p
      onPrompt(p)
    }
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const s = state.current
    const t = clock.elapsedTime
    const h = enabled.current ? held.current : new Set<string>()
    let dx = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0)
    let dz = (h.has('down') ? 1 : 0) - (h.has('up') ? 1 : 0)
    // 방향키는 화면 기준: 카메라가 돌아가 있으면(전경 회전 등) 그만큼 돌려서 ↑ 가 늘 화면 위쪽이 되게
    {
      const yaw = Math.atan2(camera.position.x - lookTarget.x, camera.position.z - lookTarget.z)
      const c = Math.cos(yaw)
      const sn = Math.sin(yaw)
      ;[dx, dz] = [dx * c + dz * sn, -dx * sn + dz * c]
    }
    const len = Math.hypot(dx, dz)

    // 🛷 썰매 타는 중: 정해진 길을 따라 움직인다 (←→ 로 살짝 방향)
    const r = ride.current
    if (!r) game.sledCharge = null
    if (r) {
      if (r.phase === 'up') {
        // 🪜 계단으로 올라가 꼭대기 다리를 건넌다
        r.climb += dt * CLIMB_SPEED
        const q = alongPath(r.path, r.climb)
        r.s = q.s
        r.w = q.w
        const p = sledPoint(q.s, q.w)
        s.x = p.x
        s.z = p.z
        if (q.ds || q.dw) s.rot = Math.atan2(SLED_DIR.x * q.ds - SLED_DIR.z * q.dw, SLED_DIR.z * q.ds + SLED_DIR.x * q.dw)
        s.speed = 3
        if (q.done) {
          r.phase = 'ready'
          r.at = t
          s.pose = 'sled'
          s.rot = SLED_ROT
          s.speed = 0
          say('Space 연타!! 💪💪', 1.4)
        }
      } else if (r.phase === 'ready') {
        // ←→ 로 출발 줄 옮기기 (옆 사람 옆에 붙어서 출발하면 쿵쿵 범퍼카)
        shiftLane(r, dt, Math.max(-1, Math.min(1, dx * -SLED_DIR.z + dz * SLED_DIR.x)))
        const p = sledPoint(r.s, r.w)
        s.x = p.x
        s.z = p.z
        if (t - r.at > READY_SECS) {
          r.phase = 'down'
          say(r.power >= POWER_MAX ? '풀파워 출발!! 🚀' : '출발~! 🛷', 1.2)
        }
      } else {
        // 방향키: 내려가는 방향의 옆으로
        const side = Math.max(-1, Math.min(1, dx * -SLED_DIR.z + dz * SLED_DIR.x))
        // 다른 썰매와 쿵
        for (const p of snow.peers.values()) {
          if (p.s.pose !== 'sled') continue
          if (bump(r, sledLocal(p.s.x, p.s.z), t)) {
            popOn(s, '💥')
            say(['쿵! 💥', '비켜어어 💥', '범퍼카냐ㅋㅋ 💥'][Math.floor(Math.random() * 3)], 1.2)
          }
        }
        const res = stepDown(r, dt, side)
        const p = sledPoint(r.s, r.w)
        s.x = p.x
        s.z = p.z
        s.rot = SLED_ROT + side * 0.25 + r.wv * 0.08
        if (r.v > 4 && !r.wow) {
          r.wow = true
          say(['와아아아~ 🎢', '꺄아아악 ❄️', '슝~~~ 🛷'][Math.floor(Math.random() * 3)], 1.6)
        }
        if (r.air > 0.3 && s.say?.startsWith('슈') !== true) say('슈우웅~ 🚀', 0.8)
        if (r.pillowed) {
          popOn(s, '💥')
          say(['통! 🎈', '뽀잉~ 🎈', '으악 튕겼다 💫'][Math.floor(Math.random() * 3)], 1)
        }
        if (r.landed) {
          popOn(s, '✨')
          say(['착지! ✨', '10점 만점에 10점 🏅', '쿵! 살았다 😅'][Math.floor(Math.random() * 3)], 1.2)
        }
        if (res !== 'go') {
          ride.current = null
          s.pose = 'stand'
          const q = resolve(s.x, s.z)
          s.x = q.x
          s.z = q.z
          vel.current = { x: 0, z: 0 }
          const dist = sledDistance(r.s)
          if (res === 'crash') {
            popOn(s, '💫')
            knock.current = { x: -SLED_DIR.x * 3, z: -SLED_DIR.z * 3 }
            say(`쾅! 장애물이랑 박치기 💫 ${dist}m`, 2.4)
          } else say(`${dist}m! ${['🛷', '❄️', '😝', '🌀'][Math.floor(Math.random() * 4)]}`, 2.4)
          game.finish.sled?.(dist, res === 'crash')
        }
      }
      game.sledCharge = r.phase === 'ready' ? { power: r.power / POWER_MAX, left: Math.max(0, READY_SECS - (t - r.at)), taps: r.taps } : null
      setPrompt(r.phase === 'down' ? '←→ 눈사람·선물상자 피하기! 썰매끼리 쿵 💥' : r.phase === 'up' ? '🪜 계단 올라가는 중…' : r.phase === 'ready' ? '←→ 출발 줄 옮기기' : null)
    }

    // ⚔️ 체력·눈덩이·기절 (매 프레임)
    game.now = t
    game.inThrowZone = canThrow(s.x, s.z)
    if (s.pose === 'ko') {
      s.speed = 0
      if (t >= game.koUntil) wakeUp('부활! 💪 다시 간다', HP_MAX)
      else setPrompt(null)
    } else if (game.hp < HP_MAX && t - game.hurtAt > REGEN_AFTER) game.hp = Math.min(HP_MAX, game.hp + REGEN_PER_SEC * dt)
    if (game.inThrowZone && game.ammo < AMMO_MAX) {
      refill.current += dt
      if (refill.current >= AMMO_REFILL) {
        refill.current = 0
        game.ammo += 1
      }
    } else refill.current = 0
    game.charge = chargeFrom.current === null ? -1 : Math.min(1, (t - chargeFrom.current) / CHARGE_SECS)
    if (game.charge >= 0) s.waveUntil = t + 0.1 // 모으는 동안 팔을 뒤로
    s.hp = game.hp
    s.lv = game.lv

    // 앉거나 누워 있을 때: 방향키를 누르면 일어난다 (기절은 시간이 지나야)
    if (s.pose !== 'stand' && s.pose !== 'ko' && !r) {
      if (len) standUp()
      else {
        s.speed = 0
        if (s.pose === 'sit' && !warmed.current && t - posedAt.current > 2.5) {
          warmed.current = true
          say('따뜻하다… ♨️', 3)
        }
        setPrompt('E 또는 방향키 · 일어나기')
      }
    }

    const rl = roll.current
    if (s.pose === 'stand' && !r) {
      const speed = (len ? (h.has('run') ? RUN : WALK) : 0) * (rl ? rollSpeed(rl.r) : 1)
      if (len) {
        dx /= len
        dz /= len
        s.rot = Math.atan2(dx, dz)
      }
      const ice = onIce(s.x, s.z)
      const v = vel.current
      // 얼음 위에서는 잘 멈추지도, 잘 돌지도 않는다
      const grip = ice ? 1.6 : 30
      const k = Math.min(1, dt * grip)
      v.x += (dx * speed * (ice ? 1.15 : 1) - v.x) * k
      v.z += (dz * speed * (ice ? 1.15 : 1) - v.z) * k
      // 🫸 밀렸으면 그만큼 더 (점점 줄어든다)
      const kn = knock.current
      const p = resolve(s.x + (v.x + kn.x) * dt, s.z + (v.z + kn.z) * dt)
      // 부딪혔으면 그 방향 속도는 잃는다
      if (dt > 0) {
        v.x = (p.x - s.x) / dt - kn.x
        v.z = (p.z - s.z) / dt - kn.z
      }
      const decay = Math.exp(-dt * 5)
      kn.x *= decay
      kn.z *= decay
      // ⛄ 굴리는 중: 눈굴리기장 밖으로는 못 나가고, 움직인 만큼 커진다. 바위에 부딪히면 쩍!
      if (rl) {
        const ox = p.x - ROLL.x
        const oz = p.z - ROLL.z
        const od = Math.hypot(ox, oz)
        const lim = ROLL.r - 0.4
        if (od > lim) {
          p.x = ROLL.x + (ox / od) * lim
          p.z = ROLL.z + (oz / od) * lim
        }
        const moved = Math.hypot(p.x - s.x, p.z - s.z)
        rl.r = growBall(rl.r, moved)
        // 눈덩이 앞쪽이 바위에 닿으면
        const ahead = 0.28 + rl.r
        const bx = p.x + Math.sin(s.rot) * ahead
        const bz = p.z + Math.cos(s.rot) * ahead
        if (t - rl.crackAt > 1 && len && ROLL_ROCKS.some((k) => Math.hypot(k.x - bx, k.z - bz) < k.r + rl.r * 0.9)) {
          rl.crackAt = t
          rl.r = Math.max(0.15, rl.r * CRACK)
          popOn(s, '💥')
          say(['쩍! 💥 눈덩이가 깨졌다', '아악 바위!! 🪨', '조각났다… 😭'][Math.floor(Math.random() * 3)], 1.4)
          knock.current = { x: -Math.sin(s.rot) * 3, z: -Math.cos(s.rot) * 3 }
        }
        s.ball = rl.r
        const left = ROLL_SECS - (t - rl.t0)
        game.roll = { left: Math.max(0, left), cm: ballCm(rl.r) }
        if (left <= 0 || !inRoll(p.x, p.z)) finishRoll()
      }
      s.x = p.x
      s.z = p.z
      s.speed = len ? speed : 0 // 얼음 위에서 손을 떼면 발은 멈춘 채 쭉 미끄러진다
      if (ice && !wasOnIce.current) say(['으아 미끄러워! 🧊', '앗 차가워 🥶', '스케이트 타는 중 ⛸️'][Math.floor(t) % 3])
      wasOnIce.current = ice

      const tr = treasure?.current
      const sp = tr ? nearestSpot(s.x, s.z, tr.hidden) : null
      const dud = tr && !sp ? nearestSpot(s.x, s.z, tr.duds, OPEN_RANGE * 0.8) : null
      const here = actionAt(s.x, s.z)
      // 가까이 오면 한 번: "뭔가 반짝인다…?"
      const glint = tr ? nearestSpot(s.x, s.z, tr.hidden, GLINT_RANGE) : null
      if (glint && !glinted.current.has(glint.id) && !tr?.mine) {
        glinted.current.add(glint.id)
        say('뭔가 반짝인다…? ✨')
      }
      if (sp && tr) {
        const hits = dig?.current.get(sp.id) ?? 0
        setPrompt(
          tr.mine
            ? '🎀 숨은 선물 · 이미 하나 찾았어요 (1인 1개)'
            : needsDig(sp.kind)
              ? `E · ${sp.kind === 'ice' ? '🧊 얼음 깨기' : '❄️ 눈 파내기'} (${hits}/${DIG_HITS})`
              : 'E · 🎀 뭐가 들었을까? 열어 보기',
        )
      } else if (dud) setPrompt('😝 꽝이었던 자리')
      else if (roll.current) setPrompt('⛄ 돌아다니며 굴리기 · 바위 조심 · E 로 끝내기')
      else if (downedNear()) {
        const dn = downedNear()!
        const rv = reviveTaps.current
        setPrompt(`E 연타 · 😵 ${dn.name}님 깨우기 (${rv && rv.id === dn.id ? rv.n : 0}/${REVIVE_TAPS})`)
      } else setPrompt(here ? (here.action === 'cocoa' && s.cup ? '☕ 핫초코를 들고 있어요 · 나눠주기는 곧!' : here.label) : null)
    }

    // 캐롤 무대와의 거리 (0.05 단위로 바뀔 때만 알린다)
    const lv = Math.round(carolLevel(s.x, s.z) * 20) / 20
    if (lv !== carol.current) {
      carol.current = lv
      onCarol?.(lv)
    }

    // 점프 (인사)
    const jt = t - jumpAt.current
    s.y = (s.pose === 'stand' && jt < 0.45 ? Math.sin((jt / 0.45) * Math.PI) * 0.35 : 0) + groundY(s.x, s.z) + (ride.current?.air ?? 0)
    if (s.say && t > sayUntil.current) s.say = null

    // 카메라: 평소엔 뒤 위에서 따라가고, 특별한 곳에서는 그 장면을 바라보는 시점으로 부드럽게 바뀐다
    // 전경일 땐 각도를 조금씩 돌리고, 아니면 정면(남쪽)으로 되돌려 둔다 (다음에 켤 때 정면에서 시작)
    orbit.current = overviewRef.current ? orbit.current + dt * 0.035 : Math.PI / 2
    // 🎥 Q / R 로 카메라 돌리기
    if (h.has('rotL')) camView.yaw -= dt * 1.8
    if (h.has('rotR')) camView.yaw += dt * 1.8
    const v = viewFor(s, talking.current, overviewRef.current, orbit.current)
    const k = Math.min(1, dt * (v.slow ? 2.4 : 4))
    camTarget.set(v.cam[0], v.cam[1], v.cam[2])
    camera.position.lerp(camTarget, k)
    lookTarget.lerp(lookTmp.set(v.look[0], v.look[1], v.look[2]), k)
    camera.lookAt(lookTarget)
    camView.facing = Math.atan2(lookTarget.x - camera.position.x, lookTarget.z - camera.position.z)
  })

  // 🎥 마우스(손가락)로 화면을 끌면 카메라가 돈다. 위아래로 끌면 높이, 휠은 멀리/가까이, 두 번 누르면 원래대로
  useEffect(() => {
    const el = gl.domElement
    let drag: { x: number; y: number; id: number } | null = null
    const down = (e: PointerEvent) => {
      if (!enabled.current) return
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId }
      el.setPointerCapture?.(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      camView.yaw -= (e.clientX - drag.x) * 0.0075
      camView.pitch = clampPitch(camView.pitch + (e.clientY - drag.y) * 0.005)
      drag.x = e.clientX
      drag.y = e.clientY
      el.style.cursor = 'grabbing'
    }
    const up = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null
      el.style.cursor = ''
    }
    const wheel = (e: WheelEvent) => {
      if (!enabled.current) return
      e.preventDefault()
      camView.zoom = clampZoom(camView.zoom * Math.exp(e.deltaY * 0.0012))
    }
    const dbl = () => camView.reset()
    const menu = (e: MouseEvent) => e.preventDefault()
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('dblclick', dbl)
    el.addEventListener('contextmenu', menu)
    const key = (e: KeyboardEvent) => {
      if (e.code === 'KeyC' && !e.repeat && !typing(e) && enabled.current) camView.reset()
    }
    window.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('dblclick', dbl)
      el.removeEventListener('contextmenu', menu)
      window.removeEventListener('keydown', key)
    }
  }, [gl, enabled])

  // 처음 들어올 때 카메라를 바로 내 쿠키 뒤로
  useEffect(() => {
    const s = state.current
    camView.reset()
    camera.position.set(s.x, 7.5, s.z + 9.5)
    lookTarget.set(s.x, 0.7, s.z)
    camera.lookAt(lookTarget)
  }, [camera, lookTarget])

  return <Cookie state={state} seed={seed} name={name} look={look} me />
}
