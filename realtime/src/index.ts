// 🛰️ AX 산타 마을 실시간 서버.
// 마을 방 하나 = Durable Object 하나. 각자 자기 상태(위치·자세·꾸미기…)를 보내면 같은 방의 다른 사람에게 그대로 전한다.
// 눈덩이·로켓 같은 순간 이벤트도 그대로 전한다. 저장은 하지 않는다 (마지막 상태만 소켓에 붙여 둔다).
// 입장권: 우리 API(/api/me/live-auth)가 REALTIME_SECRET 으로 서명해 준 짧은 토큰 (누구인지·어느 방인지·언제까지).
// 잠깐 조용하면 Cloudflare 가 방을 재운다 (hibernation): 소켓은 살아 있고, 메시지가 오면 다시 깬다.

import { DurableObject } from 'cloudflare:workers'

type Env = { VILLAGE: DurableObjectNamespace<Village>; REALTIME_SECRET: string }
type Ticket = { pid: number; name: string; room: string; exp: number }
type Seat = { cid: number; id: number; name: string; p: Record<string, unknown>; seen: number }

const MAX_SEATS = 60 // 한 사람이 창을 여러 개 열어도 넉넉하게
const MAX_MSG = 4000 // 메시지 하나 최대 글자 수
const STALE_MS = 70_000 // 이만큼 아무 소식 없는 연결은 정리 (노트북 덮개·와이파이 끊김). 화면은 20초마다 ping
const SWEEP_MS = 30_000

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'))

/** 토큰 = base64url(JSON) + "." + base64url(HMAC-SHA256) */
async function verify(token: string, secret: string): Promise<Ticket | null> {
  const [body, sig] = token.split('.')
  if (!body || !sig || !secret) return null
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const want = b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  if (want.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff) return null
  try {
    const t = JSON.parse(decodeURIComponent(escape(fromB64url(body)))) as Ticket
    if (typeof t.pid !== 'number' || typeof t.room !== 'string' || typeof t.exp !== 'number' || t.exp < Date.now()) return null
    return t
  } catch {
    return null
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/') return new Response('AX Santa realtime OK')
    const m = /^\/room\/([a-z0-9-]{1,64})$/.exec(url.pathname)
    if (!m) return new Response('not found', { status: 404 })
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 })
    const ticket = await verify(url.searchParams.get('token') ?? '', env.REALTIME_SECRET)
    if (!ticket || ticket.room !== m[1]) return new Response('unauthorized', { status: 401 })
    const stub = env.VILLAGE.get(env.VILLAGE.idFromName(ticket.room))
    // 확인한 신원을 방에 넘긴다 (토큰은 다시 확인하지 않는다)
    const h = new Headers(req.headers)
    h.set('x-pid', String(ticket.pid))
    h.set('x-name', encodeURIComponent(ticket.name))
    return stub.fetch(new Request(req.url, { headers: h }))
  },
}

export class Village extends DurableObject<Env> {
  private seat(ws: WebSocket): Seat | null {
    return (ws.deserializeAttachment() as Seat | null) ?? null
  }

  private send(ws: WebSocket, msg: unknown) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      /* 이미 닫힌 소켓 */
    }
  }

  private others(except: WebSocket) {
    return this.ctx.getWebSockets().filter((w) => w !== except)
  }

  async fetch(req: Request): Promise<Response> {
    const sockets = this.ctx.getWebSockets()
    if (sockets.length >= MAX_SEATS) return new Response('room full', { status: 429 })
    const pid = Number(req.headers.get('x-pid'))
    const name = decodeURIComponent(req.headers.get('x-name') ?? '')
    const used = new Set(sockets.map((w) => this.seat(w)?.cid))
    let cid = 1
    while (used.has(cid)) cid++
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    this.ctx.acceptWebSocket(server)
    const me: Seat = { cid, id: pid, name, p: {}, seen: Date.now() }
    server.serializeAttachment(me)
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS)
    // 들어온 사람에게: 내 자리 번호와 지금 있는 사람들
    this.send(server, { t: 'hello', cid, others: sockets.map((w) => this.seat(w)).filter(Boolean) })
    for (const w of sockets) this.send(w, { t: 'join', cid, id: pid, name, p: {} })
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return
    const me = this.seat(ws)
    if (!me) return
    let msg: { t?: string; p?: Record<string, unknown>; e?: unknown }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    me.seen = Date.now()
    if (msg.t === 'p' && msg.p && typeof msg.p === 'object') {
      // 상태 일부: 내 마지막 상태에 합쳐 두고(늦게 온 사람용) 다른 사람에게 전한다
      me.p = { ...me.p, ...msg.p }
      ws.serializeAttachment(me)
      const out = JSON.stringify({ t: 'p', cid: me.cid, p: msg.p })
      for (const w of this.others(ws)) {
        try {
          w.send(out)
        } catch {
          /* 무시 */
        }
      }
    } else if (msg.t === 'e') {
      const out = JSON.stringify({ t: 'e', cid: me.cid, e: msg.e })
      for (const w of this.others(ws)) {
        try {
          w.send(out)
        } catch {
          /* 무시 */
        }
      }
    } else if (msg.t === 'ping') {
      ws.serializeAttachment(me)
      this.send(ws, { t: 'pong' })
    }
  }

  /** 30초마다: 오래 조용한 연결은 닫고 다른 사람에게 나갔다고 알린다. 아무도 없으면 더 깨우지 않는다 */
  async alarm() {
    const now = Date.now()
    for (const ws of this.ctx.getWebSockets()) {
      const me = this.seat(ws)
      if (me && now - me.seen > STALE_MS) {
        this.leave(ws)
        try {
          ws.close(4000, 'stale')
        } catch {
          /* 이미 닫힘 */
        }
      }
    }
    if (this.ctx.getWebSockets().some((w) => this.seat(w))) await this.ctx.storage.setAlarm(now + SWEEP_MS)
  }

  private leave(ws: WebSocket) {
    const me = this.seat(ws)
    if (!me) return
    ws.serializeAttachment(null)
    for (const w of this.others(ws)) this.send(w, { t: 'leave', cid: me.cid })
  }

  async webSocketClose(ws: WebSocket, code: number) {
    this.leave(ws)
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye')
    } catch {
      /* 이미 닫힘 */
    }
  }

  async webSocketError(ws: WebSocket) {
    this.leave(ws)
  }
}
