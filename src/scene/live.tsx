import { LiveblocksProvider, RoomProvider, useBroadcastEvent, useEventListener, useOther, useOthers, useUpdateMyPresence } from '@liveblocks/react'
import { shallow } from '@liveblocks/client'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react'
import type { Look } from '../look'
import { Cookie, newCookieState, type CookieState, type Pose } from './Cookie'
import { CarolCount } from './Spots'
import { inCarol } from './world'
import { receive, snow, type SnowMsg } from './snowball'

// 실시간 마을 (Liveblocks presence).
// 주고받는 것은 위치·방향·속도·자세·핫초코·인사, 그리고 ☃️ 눈덩이 이벤트뿐이다. 매칭이나 개인 정보는 보내지 않는다.

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
}

declare global {
  interface Liveblocks {
    Presence: Presence
    UserMeta: { id: string; info: { name: string } }
    RoomEvent: SnowMsg
  }
}

const initialPresence: Presence = { x: 0, z: 0, rot: 0, speed: 0, pose: 'stand', cup: false, look: null, wave: 0, say: null }

export function LiveRoot({ room, children }: { room: string; children: ReactNode }) {
  // 무료 플랜 배지: 오른쪽 아래면 좁은 화면에서 로그아웃 버튼을 가려서 왼쪽 아래로
  return (
    <LiveblocksProvider authEndpoint="/api/me/live-auth" throttle={80} badgeLocation="bottom-left">
      <RoomProvider id={room} initialPresence={initialPresence}>
        {children}
      </RoomProvider>
    </LiveblocksProvider>
  )
}

/** 내 쿠키 상태를 약 10번/초로 보낸다 (바뀌었을 때만) */
export function LivePublisher({ state, look }: { state: MutableRefObject<CookieState | null>; look: Look | null }) {
  const update = useUpdateMyPresence()
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
  const broadcast = useBroadcastEvent()
  useEffect(() => {
    snow.send = (m) => broadcast(m)
    return () => {
      snow.send = null
    }
  }, [broadcast])
  useEventListener(({ event }) => receive(event))
  return null
}

/** 캐롤 무대 앞에 모인 사람 수 (같은 사람이 창을 여러 개 열어도 한 명) */
export function LiveCarolCount({ meId, me }: { meId: number; me: MutableRefObject<CookieState | null> }) {
  const others = useOthers((list) => new Set(list.filter((o) => Number(o.id) !== meId && o.presence && inCarol(o.presence.x, o.presence.z)).map((o) => o.id)).size)
  return <CarolCount others={others} me={me} />
}

/** 마을에 접속한 다른 사람들을 그린다 */
export function LivePeers({ meId, onOnline }: { meId: number; onOnline: (ids: Set<number>) => void }) {
  // 한 사람이 창을 여러 개 열어도 쿠키는 하나만: 사람마다 가장 최근 연결만 그린다. 내 다른 창은 그리지 않는다.
  const ids = useOthers((others) => {
    const latest = new Map<number, number>()
    for (const o of others) {
      const uid = Number(o.id)
      if (uid === meId) continue
      latest.set(uid, Math.max(latest.get(uid) ?? -1, o.connectionId))
    }
    return [...latest.values()].sort((a, b) => a - b)
  }, shallow)
  const online = useOthers((others) => others.map((o) => Number(o.id)).sort((a, b) => a - b), shallow)
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

function Peer({ connectionId }: { connectionId: number }) {
  const other = useOther(connectionId, (o) => ({ p: o.presence, id: Number(o.id), name: o.info?.name ?? '', look: o.presence.look ?? null }), shallow)
  const state = useRef<CookieState>(newCookieState(other.p.x, other.p.z, other.p.rot))
  const seenWave = useRef(other.p.wave)
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
    const jt = t - jumpAt.current
    s.y = jt < 0.45 ? Math.sin((jt / 0.45) * Math.PI) * 0.35 : 0
    s.say = p.say
    s.pose = p.pose ?? 'stand'
    s.cup = !!p.cup
  })

  if (!other.id) return null
  return <Cookie state={state} seed={other.id} name={other.name} look={other.look} />
}
