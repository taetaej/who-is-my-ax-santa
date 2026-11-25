import { LiveblocksProvider, RoomProvider, useBroadcastEvent, useEventListener, useOther, useOthers, useUpdateMyPresence } from '@liveblocks/react'
import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { RtRoom, shallow, useRoomEvents, useRoomSelector, type Other } from './rt'
import type { Look } from '../look'
import { Cookie, newCookieState, popOn, type CookieState, type Pose } from './Cookie'
import { emoteOf, emotes, type EmoteOut } from './emote'
import { CarolCount } from './Spots'
import { groundY, inCarol } from './world'
import { receive, snow, type SnowMsg } from './snowball'

// 실시간 마을. 연결은 둘 중 하나 (서버 /api/me 의 liveKind 가 정한다):
//   'rt'         우리 실시간 서버 (Cloudflare Durable Object, realtime/). 동시 접속 제한 없이 무료
//   'liveblocks' Liveblocks presence (무료 플랜은 한 방 동시 접속이 적다)
// 아래 컴포넌트들은 어느 쪽이든 같은 모양의 훅(Live)만 쓴다.
// 주고받는 것은 위치·방향·속도·자세·핫초코·인사·💬 반응, 그리고 ☃️ 눈덩이 이벤트뿐이다. 매칭이나 개인 정보는 보내지 않는다.

type Presence = {
  x: number
  z: number
  rot: number
  speed: number
  pose: Pose
  cup: boolean
  look: Look | null
  wave: number // 인사할 때마다 바뀌는 값
  say: string | null
  emote: EmoteOut | null // 💬 반응 (n 이 바뀔 때마다 한 번)
  air: number // 🛷 점프대에서 날아오른 높이
  hp: number // ⚔️ 체력
  ball: number // ⛄ 굴리는 눈덩이 반지름
  lv: number // ⭐ 레벨
}

declare global {
  interface Liveblocks {
    Presence: Presence
    UserMeta: { id: string; info: { name: string } }
    RoomEvent: SnowMsg
  }
}

const initialPresence: Presence = { x: 0, z: 0, rot: 0, speed: 0, pose: 'stand', cup: false, look: null, wave: 0, say: null, emote: null, air: 0, hp: 100, ball: 0, lv: 1 }

type Ev = SnowMsg
type O = Other<Presence>
/** 어느 실시간 연결이든 같은 모양 */
type Live = {
  useOthers: <T>(select: (others: O[]) => T, isEqual?: (a: T, b: T) => boolean) => T
  useOther: <T>(cid: number, select: (o: O) => T, isEqual?: (a: T, b: T) => boolean) => T
  useUpdate: () => (patch: Partial<Presence>) => void
  useBroadcast: () => (e: Ev) => void
  useEvents: (fn: (e: { event: Ev }) => void) => void
}

const liveblocksAdapter: Live = {
  useOthers: (select, isEqual) => useOthers((list) => select(list as unknown as O[]), isEqual),
  useOther: (cid, select, isEqual) => useOther(cid, (o) => select(o as unknown as O), isEqual),
  useUpdate: () => useUpdateMyPresence(),
  useBroadcast: () => useBroadcastEvent(),
  useEvents: (fn) => useEventListener(({ event }) => fn({ event })),
}

const GHOST: O = { connectionId: -1, id: '', info: { name: '' }, presence: initialPresence }
function rtAdapter(room: RtRoom<Presence, Ev>): Live {
  return {
    useOthers: (select, isEqual) => useRoomSelector(room, select, isEqual),
    // 나간 사람은 쿠키가 지워지기 직전 한 번 빈 값으로 (그리는 쪽에서 id 가 없으면 안 그린다)
    useOther: (cid, select, isEqual) => useRoomSelector(room, (list) => select(list.find((o) => o.connectionId === cid) ?? GHOST), isEqual),
    useUpdate: () => (patch) => room.update(patch),
    useBroadcast: () => (e) => room.broadcast(e),
    useEvents: (fn) => useRoomEvents(room, fn),
  }
}

const LiveCtx = createContext<Live>(liveblocksAdapter)
const useLive = () => useContext(LiveCtx)

/** 우리 실시간 서버 입장권: 우리 API 가 서명한 짧은 토큰 + 방 주소 */
const rtTicket = async () => {
  const r = await fetch('/api/me/live-auth', { method: 'POST' })
  if (!r.ok) throw new Error('live-auth')
  return (await r.json()) as { url: string; token: string }
}

function RtRoot({ children }: { children: ReactNode }) {
  const room = useMemo(() => new RtRoom<Presence, Ev>(rtTicket, initialPresence, 80), [])
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __rt: unknown }).__rt = room // 개발 중 확인용
    room.start()
    return () => room.stop()
  }, [room])
  const live = useMemo(() => rtAdapter(room), [room])
  return <LiveCtx.Provider value={live}>{children}</LiveCtx.Provider>
}

export function LiveRoot({ room, kind = 'liveblocks', children }: { room: string; kind?: 'rt' | 'liveblocks'; children: ReactNode }) {
  if (kind === 'rt') return <RtRoot>{children}</RtRoot>
  // 무료 플랜 배지: 오른쪽 아래면 좁은 화면에서 로그아웃 버튼을 가려서 왼쪽 아래로
  return (
    <LiveblocksProvider authEndpoint="/api/me/live-auth" throttle={80} badgeLocation="bottom-left">
      <RoomProvider id={room} initialPresence={initialPresence}>
        <LiveCtx.Provider value={liveblocksAdapter}>{children}</LiveCtx.Provider>
      </RoomProvider>
    </LiveblocksProvider>
  )
}

/** 내 쿠키 상태를 약 10번/초로 보낸다 (바뀌었을 때만) */
export function LivePublisher({ state, look }: { state: MutableRefObject<CookieState | null>; look: Look | null }) {
  const update = useLive().useUpdate()
  // 꾸민 모습은 바뀔 때만 보낸다
  const lookKey = JSON.stringify(look)
  useEffect(() => {
    update({ look: JSON.parse(lookKey) as Look | null })
  }, [lookKey, update])
  const last = useRef('')
  const lastAt = useRef(0)
  useFrame(({ clock }) => {
    const s = state.current
    if (!s) return
    const t = clock.elapsedTime
    if (t - lastAt.current < 0.08) return
    const p: Omit<Presence, 'look'> = {
      x: Math.round(s.x * 100) / 100,
      z: Math.round(s.z * 100) / 100,
      rot: Math.round(s.rot * 100) / 100,
      speed: Math.round(s.speed * 10) / 10,
      pose: s.pose,
      cup: s.cup,
      wave: s.waveUntil,
      say: s.say,
      emote: s.emote,
      air: s.pose === 'sled' ? Math.round((s.y - groundY(s.x, s.z)) * 10) / 10 : 0,
      hp: Math.round(s.hp),
      ball: Math.round(s.ball * 100) / 100,
      lv: s.lv,
    }
    const key = JSON.stringify(p)
    if (key === last.current) return
    last.current = key
    lastAt.current = t
    update(p)
  })
  return null
}

/** ☃️ 눈덩이를 실시간으로 주고받는다 (던짐 · 맞음) */
export function LiveSnow() {
  const live = useLive()
  const broadcast = live.useBroadcast()
  useEffect(() => {
    snow.send = (m) => broadcast(m)
    return () => {
      snow.send = null
    }
  }, [broadcast])
  live.useEvents(({ event }) => receive(event))
  return null
}

/** 캐롤 무대 앞에 모인 사람 수 (같은 사람이 창을 여러 개 열어도 한 명) */
export function LiveCarolCount({ meId, me }: { meId: number; me: MutableRefObject<CookieState | null> }) {
  const others = useLive().useOthers((list) => new Set(list.filter((o) => Number(o.id) !== meId && o.presence && inCarol(o.presence.x, o.presence.z)).map((o) => o.id)).size)
  return <CarolCount others={others} me={me} />
}

/** 마을에 접속한 다른 사람들을 그린다 */
export function LivePeers({ meId, onOnline }: { meId: number; onOnline: (ids: Set<number>) => void }) {
  // 한 사람이 창을 여러 개 열어도 쿠키는 하나만: 사람마다 가장 최근 연결만 그린다. 내 다른 창은 그리지 않는다.
  const live = useLive()
  const ids = live.useOthers((others) => {
    const latest = new Map<number, number>()
    for (const o of others) {
      const uid = Number(o.id)
      if (uid === meId) continue
      latest.set(uid, Math.max(latest.get(uid) ?? -1, o.connectionId))
    }
    return [...latest.values()].sort((a, b) => a - b)
  }, shallow)
  const online = live.useOthers((others) => others.map((o) => Number(o.id)).sort((a, b) => a - b), shallow)
  useEffect(() => {
    onOnline(new Set(online))
  }, [online, onOnline])
  return (
    <>
      {ids.map((cid) => (
        <Peer key={cid} connectionId={cid} />
      ))}
    </>
  )
}

/** 사람 한 명 비교: 상태 객체가 같고 이름·모습이 같으면 다시 그리지 않는다 */
const shallowPeer = (a: { p: Presence; id: number; name: string; look: Look | null }, b: typeof a) => a.id === b.id && a.name === b.name && a.look === b.look && shallow(a.p, b.p)

function Peer({ connectionId }: { connectionId: number }) {
  const other = useLive().useOther(connectionId, (o) => ({ p: { ...initialPresence, ...o.presence }, id: Number(o.id), name: o.info?.name ?? '', look: o.presence.look ?? null }), shallowPeer)
  const state = useRef<CookieState>(newCookieState(other.p.x, other.p.z, other.p.rot))
  const seenWave = useRef(other.p.wave)
  const seenEmote = useRef(other.p.emote?.n ?? 0) // 들어오기 전에 보낸 반응은 다시 띄우지 않는다
  const jumpAt = useRef(-10)
  const target = useRef(other.p)
  target.current = other.p
  // ☃️ 눈덩이가 이 사람에게 맞았는지 보이게 위치를 알려 둔다
  useEffect(() => {
    snow.peers.set(connectionId, { id: other.id, name: other.name, s: state.current })
    return () => void snow.peers.delete(connectionId)
  }, [connectionId, other.id, other.name])

  useFrame(({ clock }, dt) => {
    const s = state.current
    const p = target.current
    const t = clock.elapsedTime
    const dx = p.x - s.x
    const dz = p.z - s.z
    if (Math.hypot(dx, dz) > 4) {
      // 모닥불 자리로 순간이동한 경우 등
      s.x = p.x
      s.z = p.z
    } else {
      const k = Math.min(1, dt * 10)
      s.x += dx * k
      s.z += dz * k
    }
    s.rot = p.rot
    s.speed = p.speed > 0 || Math.hypot(dx, dz) > 0.05 ? Math.max(p.speed, 1) : 0
    if (p.wave !== seenWave.current) {
      seenWave.current = p.wave
      if (p.wave > 0) {
        s.waveUntil = t + 1.6
        jumpAt.current = t
      }
    }
    // 💬 반응: 머리 위 이모지, 받는 사람이 있으면 그 사람 머리 위에도
    const e = p.emote
    if (e && e.n !== seenEmote.current) {
      seenEmote.current = e.n
      const def = emoteOf(e.id)
      if (def) {
        popOn(s, def.icon)
        if (e.to != null && e.to === snow.me?.id) {
          popOn(snow.me.s, def.icon)
          emotes.onGot?.({ id: other.id, name: other.name, x: s.x, z: s.z }, def.id)
        } else if (e.to != null) {
          for (const peer of snow.peers.values()) if (peer.id === e.to) popOn(peer.s, def.icon)
        }
      }
    }
    const jt = t - jumpAt.current
    s.y = (jt < 0.45 ? Math.sin((jt / 0.45) * Math.PI) * 0.35 : 0) + groundY(s.x, s.z) + (p.air ?? 0)
    s.say = p.say
    s.pose = p.pose ?? 'stand'
    s.cup = !!p.cup
    s.hp = p.hp ?? 100
    s.ball = p.ball ?? 0
    s.lv = p.lv ?? 1
  })

  if (!other.id) return null
  return <Cookie state={state} seed={other.id} name={other.name} look={other.look} />
}
