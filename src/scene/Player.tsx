import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { Look } from '../look'
import { Cookie, newCookieState, type CookieState } from './Cookie'
import { AWARDS_ROT, COCOA_SIZE, ELF, FIRE_SEATS, PARTY, POST_SIZE, SPAWN, SPOT, actionAt, at, carolLevel, facadeView, inGallery, onIce, polar, resolve } from './world'

// 내 쿠키: 방향키/WASD 이동, Shift 달리기, Space 인사, E 상호작용(앉기·눕기·핫초코·소개서…).
// 카메라는 화면 기준 고정 각도로 따라온다 (↑ 가 화면 위쪽).

const WALK = 3.2
const RUN = 5.6
const KEYS: Record<string, 'up' | 'down' | 'left' | 'right' | 'run'> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
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
  if (overview) return { cam: [Math.cos(orbit) * 30, 17, Math.sin(orbit) * 30], look: [0, 1.2, 0], slow: true }
  // 🧝 엘프와 대화: 엘프 얼굴 쪽으로 다가간다
  if (talking) {
    // 나와 엘프가 함께 잡히도록 비스듬히, 둘 사이를 본다
    const mx = (s.x + ELF.x) / 2
    const mz = (s.z + ELF.z) / 2
    // 대화창이 화면 아래를 덮으니, 아래쪽을 보게 해서 두 캐릭터가 화면 위쪽에 오게 한다
    return { cam: [mx + 1.9, 2.3, mz + 3.6], look: [mx, 0.25, mz + 0.3], slow: true }
  }
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
  return { cam: [s.x, 7.5, s.z + 9.5], look: [s.x, 0.7, s.z] }
}

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
}) {
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
  const { camera, clock } = useThree()
  const camTarget = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const lookTmp = useMemo(() => new THREE.Vector3(), [])

  const say = (text: string, secs = 2.2) => {
    state.current.say = text
    sayUntil.current = clock.elapsedTime + secs
  }

  const standUp = () => {
    const s = state.current
    if (s.pose === 'stand') return
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
        if (state.current.pose === 'stand') jumpAt.current = t
        state.current.waveUntil = t + 1.6
        say('안녕! 👋')
      }
      if (e.code === 'KeyE' && !e.repeat) interact()
    }
    const up = (e: KeyboardEvent) => {
      const k = KEYS[e.code]
      if (k) held.current.delete(k)
      if (e.code === 'Space' && !typing(e)) e.preventDefault()
    }
    const blur = () => held.current.clear()
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

  function interact() {
    const s = state.current
    if (s.pose !== 'stand') return standUp()
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

    // 앉거나 누워 있을 때: 방향키를 누르면 일어난다
    if (s.pose !== 'stand') {
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

    if (s.pose === 'stand') {
      const speed = len ? (h.has('run') ? RUN : WALK) : 0
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
      const p = resolve(s.x + v.x * dt, s.z + v.z * dt)
      // 부딪혔으면 그 방향 속도는 잃는다
      if (dt > 0) {
        v.x = (p.x - s.x) / dt
        v.z = (p.z - s.z) / dt
      }
      s.x = p.x
      s.z = p.z
      s.speed = len ? speed : 0 // 얼음 위에서 손을 떼면 발은 멈춘 채 쭉 미끄러진다
      if (ice && !wasOnIce.current) say(['으아 미끄러워! 🧊', '앗 차가워 🥶', '스케이트 타는 중 ⛸️'][Math.floor(t) % 3])
      wasOnIce.current = ice

      const here = actionAt(s.x, s.z)
      setPrompt(here ? (here.action === 'cocoa' && s.cup ? '☕ 핫초코를 들고 있어요 · 나눠주기는 곧!' : here.label) : null)
    }

    // 캐롤 무대와의 거리 (0.05 단위로 바뀔 때만 알린다)
    const lv = Math.round(carolLevel(s.x, s.z) * 20) / 20
    if (lv !== carol.current) {
      carol.current = lv
      onCarol?.(lv)
    }

    // 점프 (인사)
    const jt = t - jumpAt.current
    s.y = s.pose === 'stand' && jt < 0.45 ? Math.sin((jt / 0.45) * Math.PI) * 0.35 : 0
    if (s.say && t > sayUntil.current) s.say = null

    // 카메라: 평소엔 뒤 위에서 따라가고, 특별한 곳에서는 그 장면을 바라보는 시점으로 부드럽게 바뀐다
    // 전경일 땐 각도를 조금씩 돌리고, 아니면 정면(남쪽)으로 되돌려 둔다 (다음에 켤 때 정면에서 시작)
    orbit.current = overviewRef.current ? orbit.current + dt * 0.035 : Math.PI / 2
    const v = viewFor(s, talking.current, overviewRef.current, orbit.current)
    const k = Math.min(1, dt * (v.slow ? 2.4 : 4))
    camTarget.set(v.cam[0], v.cam[1], v.cam[2])
    camera.position.lerp(camTarget, k)
    lookTarget.lerp(lookTmp.set(v.look[0], v.look[1], v.look[2]), k)
    camera.lookAt(lookTarget)
  })

  // 처음 들어올 때 카메라를 바로 내 쿠키 뒤로
  useEffect(() => {
    const s = state.current
    camera.position.set(s.x, 7.5, s.z + 9.5)
    lookTarget.set(s.x, 0.7, s.z)
    camera.lookAt(lookTarget)
  }, [camera, lookTarget])

  return <Cookie state={state} seed={seed} name={name} look={look} me />
}
