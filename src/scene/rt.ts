import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

// 🛰️ 우리 실시간 서버(Cloudflare Durable Object, realtime/) 연결.
// Liveblocks 와 같은 모양의 훅(useOthers · useOther · useUpdateMyPresence · useBroadcastEvent · useEventListener)을 준다.
// 끊기면 알아서 다시 붙는다 (1초 → 최대 15초 간격). 연결이 안 돼도 마을은 혼자 모드로 그대로 돈다.

export type Other<P> = { connectionId: number; id: string; info: { name: string }; presence: P }
type Msg =
  | { t: 'hello'; cid: number; others: { cid: number; id: number; name: string; p: Record<string, unknown> }[] }
  | { t: 'join'; cid: number; id: number; name: string; p: Record<string, unknown> }
  | { t: 'p'; cid: number; p: Record<string, unknown> }
  | { t: 'leave'; cid: number }
  | { t: 'e'; cid: number; e: unknown }
  | { t: 'pong' }

export type RtStatus = 'connecting' | 'open' | 'closed'

export class RtRoom<P extends object, E> {
  private ws: WebSocket | null = null
  private others: Other<P>[] = []
  private listeners = new Set<() => void>()
  private eventListeners = new Set<(e: { event: E; connectionId: number }) => void>()
  private mine: P
  private pending: Partial<P> | null = null
  private flushAt = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private retry = 0
  private stopped = true // start() 전에는 연결하지 않는다
  status: RtStatus = 'connecting'

  constructor(
    private ticket: () => Promise<{ url: string; token: string }>,
    initial: P,
    private throttleMs = 80,
  ) {
    this.mine = { ...initial }
  }

  /** 연결 시작 (멈췄다가 다시 불러도 된다: React 가 개발 모드에서 효과를 두 번 돌린다) */
  start() {
    if (!this.stopped && (this.ws || this.status === 'open')) return
    this.stopped = false
    if (!this.ws) void this.connect()
  }

  private emit() {
    for (const l of this.listeners) l()
  }

  private gen = 0 // 연결 시도 번호: 더 새 시도가 있으면 옛 시도는 그만둔다 (소켓이 둘 생기지 않게)
  private async connect() {
    if (this.stopped) return
    const g = ++this.gen
    this.status = 'connecting'
    try {
      const { url, token } = await this.ticket()
      if (this.stopped || g !== this.gen) return
      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`)
      this.ws = ws
      ws.onopen = () => {
        this.status = 'open'
        this.retry = 0
        // 살아 있다고 20초마다 알린다 (조용한 연결은 서버가 70초 뒤 정리한다)
        const ping = setInterval(() => (ws.readyState === WebSocket.OPEN ? ws.send('{"t":"ping"}') : clearInterval(ping)), 20_000)
        // 다시 붙었으면 내 마지막 상태를 통째로 다시 알린다
        ws.send(JSON.stringify({ t: 'p', p: this.mine }))
        this.emit()
      }
      ws.onmessage = (ev) => this.ws === ws && this.onMessage(ev.data as string)
      ws.onclose = () => this.ws === ws && this.onClosed()
      ws.onerror = () => ws.close()
    } catch {
      if (g === this.gen) this.onClosed()
    }
  }

  private onClosed() {
    this.ws = null
    this.status = 'closed'
    this.others = []
    this.emit()
    if (this.stopped) return
    const wait = Math.min(15000, 1000 * 2 ** this.retry++)
    setTimeout(() => void this.connect(), wait)
  }

  private onMessage(raw: string) {
    let m: Msg
    try {
      m = JSON.parse(raw) as Msg
    } catch {
      return
    }
    if (m.t === 'hello') {
      this.others = m.others.map((o) => ({ connectionId: o.cid, id: String(o.id), info: { name: o.name }, presence: o.p as P }))
    } else if (m.t === 'join') {
      this.others = [...this.others.filter((o) => o.connectionId !== m.cid), { connectionId: m.cid, id: String(m.id), info: { name: m.name }, presence: m.p as P }]
    } else if (m.t === 'p') {
      // 바뀐 사람만 새 객체로 (선택자 비교가 싸게 끝나도록)
      this.others = this.others.map((o) => (o.connectionId === m.cid ? { ...o, presence: { ...o.presence, ...m.p } as P } : o))
    } else if (m.t === 'leave') {
      this.others = this.others.filter((o) => o.connectionId !== m.cid)
    } else if (m.t === 'e') {
      for (const l of this.eventListeners) l({ event: m.e as E, connectionId: m.cid })
      return
    } else return
    this.emit()
  }

  /** 내 상태 일부 바꾸기: throttleMs 마다 바뀐 것만 묶어서 보낸다 */
  update(patch: Partial<P>) {
    this.mine = { ...this.mine, ...patch }
    this.pending = { ...(this.pending ?? {}), ...patch }
    const now = Date.now()
    if (now >= this.flushAt) this.flush()
    else if (!this.timer) this.timer = setTimeout(() => this.flush(), this.flushAt - now)
  }

  private flush() {
    this.timer = null
    if (!this.pending) return
    this.flushAt = Date.now() + this.throttleMs
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'p', p: this.pending }))
    this.pending = null
  }

  broadcast(event: E) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'e', e: event }))
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }
  onEvent(l: (e: { event: E; connectionId: number }) => void) {
    this.eventListeners.add(l)
    return () => void this.eventListeners.delete(l)
  }
  getOthers = () => this.others

  stop() {
    this.stopped = true
    this.gen++
    const ws = this.ws
    this.ws = null
    ws?.close()
  }
}

/** 선택자 결과가 같으면 다시 그리지 않는다 (Liveblocks 의 useOthers(selector, isEqual) 와 같은 동작) */
export function useRoomSelector<P extends object, E, T>(room: RtRoom<P, E>, select: (others: Other<P>[]) => T, isEqual?: (a: T, b: T) => boolean): T {
  const last = useRef<{ src: Other<P>[]; val: T } | null>(null)
  const sel = useRef(select)
  sel.current = select
  const eq = useRef(isEqual)
  eq.current = isEqual
  const get = useCallback(() => {
    const src = room.getOthers()
    if (last.current && last.current.src === src) return last.current.val
    const val = sel.current(src)
    const same = eq.current ?? Object.is
    if (last.current && same(last.current.val, val)) {
      last.current = { src, val: last.current.val }
      return last.current.val
    }
    last.current = { src, val }
    return val
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])
  return useSyncExternalStore(room.subscribe, get, get)
}

export function useRoomEvents<P extends object, E>(room: RtRoom<P, E>, fn: (e: { event: E; connectionId: number }) => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => room.onEvent((e) => ref.current(e)), [room])
}

/** 얕은 비교 (배열·객체 한 단계) */
export function shallow(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
