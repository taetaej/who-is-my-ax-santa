import { Hono, type Context, type Next } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { COOKIE, LOCK_MINUTES, MAX_FAILS, PIN_RE, hashPin, issue, read, verifyPin } from './auth.js'
import { PHASES, db, getPhase, type Phase } from './db.js'
import { awardFor, cleanGift, isEmptyGift, type Gift } from '../src/awards.js'
import { isEmptyProfile, readProfile } from '../src/profile.js'
import { INTERVIEW_MAX, cleanChat, nickname, questions, type QA } from '../src/interview.js'
import { cleanLook } from '../src/look.js'
import { FIRST_DAY, QUESTIONS, cleanQuestions, isDay, kstDay, questionDay, questionFor, treeDay } from '../src/questions.js'
import { EMPTY_LETTER, cleanLetter, missing } from './letter.js'
import { EMPTY_GUESS, cleanGuess, guessDone, type Guess, type GuessStatus } from '../src/guess.js'
import { makeCycle } from './matching.js'
import { RESCUE_FROM, SPOTS, spot, tierOf } from '../src/treasure.js'
import { REAL, dudLine } from './treasure.js'
import { isMissionId, missionById, missionOpen } from '../src/schedule.js'
import { RECORD_KINDS, RECORD_MAX, XP_DAILY_CAP, XP_EVENT, XP_GAIN, XP_KINDS, levelOf, type RecordKind, type XpKind } from '../src/gameRules.js'

type Me = { id: number; name: string; is_admin: boolean }
type Env = { Variables: { me: Me } }

export const app = new Hono<Env>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: '서버 오류가 났어요' }, 500)
})

/** 한국 시간 오늘. 로컬에서만 SANTA_TODAY=2026-12-09 처럼 날짜를 바꿔 일정 화면을 미리 볼 수 있다 */
const today = () => (process.env.VERCEL_ENV !== 'production' && isDay(process.env.SANTA_TODAY) ? process.env.SANTA_TODAY : kstDay())
const bad = (c: Context, error: string, status: 400 | 401 | 403 | 404 | 409 | 423 = 400) => c.json({ error }, status)

function login(c: Context, pid: number, v: number) {
  // maxAge 없음 = 세션 쿠키 (브라우저를 닫으면 사라짐). 만료는 서명 안의 exp(12시간)가 지킨다.
  setCookie(c, COOKIE, issue(pid, v), { httpOnly: true, sameSite: 'Lax', secure: !!process.env.VERCEL, path: '/' })
}

async function requireLogin(c: Context<Env>, next: Next) {
  const s = read(getCookie(c, COOKIE))
  if (!s) return bad(c, '로그인이 필요해요', 401)
  const q = await db()
  const [me] = await q<Me & { session_version: number }>(`select id, name, is_admin, session_version from players where id = $1`, [s.pid])
  // PIN 을 초기화하면 session_version 이 올라가 기존 쿠키가 무효가 된다
  if (!me || me.session_version !== s.v) return bad(c, '로그인이 필요해요', 401)
  c.set('me', { id: me.id, name: me.name, is_admin: me.is_admin })
  await next()
}

async function requireAdmin(c: Context<Env>, next: Next) {
  if (!c.get('me').is_admin) return bad(c, '운영자만 쓸 수 있어요', 403)
  await next()
}

// ── 공개 ───────────────────────────────────────────────────────
app.get('/players', async (c) => {
  const q = await db()
  const rows = await q<{ id: number; name: string; has_pin: boolean }>(`select id, name, pin_hash is not null as has_pin from players order by name`)
  return c.json(rows.map((r) => ({ id: r.id, name: r.name, hasPin: r.has_pin })))
})

// 최초 접속: PIN 등록 (아직 PIN 이 없는 사람만)
app.post('/auth/setup-pin', async (c) => {
  const { playerId, pin } = await c.req.json<{ playerId: number; pin: string }>()
  if (!PIN_RE.test(pin ?? '')) return bad(c, 'PIN 은 숫자 4자리예요')
  const q = await db()
  const hash = await hashPin(pin)
  const [row] = await q<{ id: number; session_version: number }>(
    `update players set pin_hash = $2, failed_attempts = 0, locked_until = null
     where id = $1 and pin_hash is null returning id, session_version`,
    [playerId, hash],
  )
  if (!row) return bad(c, '이미 PIN 이 있어요. 로그인해 주세요', 409)
  login(c, row.id, row.session_version)
  return c.json({ ok: true })
})

app.post('/auth/login', async (c) => {
  const { playerId, pin } = await c.req.json<{ playerId: number; pin: string }>()
  const q = await db()
  const [p] = await q<{
    id: number
    pin_hash: string | null
    failed_attempts: number
    locked_until: string | null
    session_version: number
  }>(`select id, pin_hash, failed_attempts, locked_until, session_version from players where id = $1`, [playerId])
  if (!p) return bad(c, '없는 참가자예요', 404)
  if (!p.pin_hash) return bad(c, '먼저 PIN 을 등록해 주세요', 409)
  if (p.locked_until && new Date(p.locked_until) > new Date()) {
    return bad(c, `PIN 을 ${MAX_FAILS}번 틀려서 잠겼어요. ${LOCK_MINUTES}분 뒤에 다시 해 주세요`, 423)
  }
  if (!PIN_RE.test(pin ?? '') || !(await verifyPin(pin, p.pin_hash))) {
    const fails = p.failed_attempts + 1
    const locked = fails >= MAX_FAILS
    await q(
      `update players set failed_attempts = $2,
         locked_until = case when $3 then now() + make_interval(mins => $4) else null end
       where id = $1`,
      [p.id, locked ? 0 : fails, locked, LOCK_MINUTES],
    )
    return bad(c, locked ? `PIN 을 ${MAX_FAILS}번 틀려서 ${LOCK_MINUTES}분 동안 잠겼어요` : 'PIN 이 맞지 않아요', 401)
  }
  await q(`update players set failed_attempts = 0, locked_until = null where id = $1`, [p.id])
  login(c, p.id, p.session_version)
  return c.json({ ok: true })
})

app.post('/auth/logout', (c) => {
  deleteCookie(c, COOKIE, { path: '/' })
  return c.json({ ok: true })
})

// ── 플레이어 ───────────────────────────────────────────────────
app.use('/me', requireLogin)
app.use('/me/*', requireLogin)

app.get('/me', async (c) => {
  const me = c.get('me')
  const q = await db()
  const [row] = await q<{ manito_opened_at: string | null; profile: unknown; look: unknown; letter: 'none' | 'draft' | 'submitted' }>(
    `select p.manito_opened_at, p.profile, p.look,
       case when l.submitted_at is not null then 'submitted' when l.santa_id is not null then 'draft' else 'none' end as letter
     from players p left join letters l on l.santa_id = p.id where p.id = $1`,
    [me.id],
  )
  // 엘프 NPC 잔소리용: 오늘 메시지 트리를 썼는지, 동료 몇 명에게 키워드를 줬는지
  const [todo] = await q<{ tree: boolean; given: number; people: number }>(
    `select exists (select 1 from messages where player_id = $1 and day = $2) as tree,
       (select count(*)::int from keywords where giver_id = $1) as given,
       (select count(*)::int - 1 from players) as people`,
    [me.id, treeDay()],
  )
  return c.json({
    id: me.id,
    name: me.name,
    isAdmin: me.is_admin,
    phase: await getPhase(),
    manitoOpened: !!row.manito_opened_at,
    profile: row.profile ? readProfile(row.profile) : null,
    letter: row.letter,
    guess: await guessStatus(me.id),
    look: row.look ? cleanLook(row.look, me.id) : null, // null = 아직 안 꾸밈 → 처음 들어올 때 꾸미기 창
    todo: { tree: todo.tree, given: todo.given, people: todo.people, gift: await giftTodo(me.id) },
    missions: (await q<{ mission: string }>(`select mission from mission_checks where player_id = $1`, [me.id])).map((r) => r.mission).filter(isMissionId),
    today: today(),
    // 실시간 마을: 키가 없으면 null → 화면은 혼자 돌아다니는 모드로 동작
    liveRoom: liveKind() ? LIVE_ROOM : null,
    liveKind: liveKind(),
  })
})

// ── 실시간 마을 ─────────────────────────────────────────────────
// 로그인한 사람에게만, 마을 방 하나의 "위치 공유" 입장권을 준다.
// 이름은 서버가 넣으므로 남의 이름으로 들어갈 수 없다. 매칭 정보는 여기로 절대 보내지 않는다.
// REALTIME_URL + REALTIME_SECRET 이 있으면 우리 실시간 서버(Cloudflare, realtime/), 아니면 Liveblocks.
const LIVE_ROOM = `santa-village-${process.env.VERCEL_ENV ?? 'local'}`
const liveKind = (): 'rt' | 'liveblocks' | null =>
  process.env.REALTIME_URL && process.env.REALTIME_SECRET ? 'rt' : process.env.LIVEBLOCKS_SECRET_KEY ? 'liveblocks' : null

/** 우리 실시간 서버 입장권: base64url(JSON) + "." + HMAC-SHA256 (realtime/src/index.ts 가 확인). 10분짜리, 끊기면 새로 받는다 */
async function rtTicket(pid: number, name: string) {
  const { createHmac } = await import('node:crypto')
  const body = Buffer.from(JSON.stringify({ pid, name, room: LIVE_ROOM, exp: Date.now() + 10 * 60_000 }), 'utf8').toString('base64url')
  const sig = createHmac('sha256', process.env.REALTIME_SECRET!).update(body).digest('base64url')
  return `${body}.${sig}`
}

app.post('/me/live-auth', async (c) => {
  const me = c.get('me')
  if (liveKind() === 'rt') {
    const url = `${process.env.REALTIME_URL!.replace(/\/$/, '')}/room/${LIVE_ROOM}`
    return c.json({ url, token: await rtTicket(me.id, me.name) })
  }
  const secret = process.env.LIVEBLOCKS_SECRET_KEY
  if (!secret) return bad(c, '실시간 기능이 꺼져 있어요', 404)
  const { Liveblocks } = await import('@liveblocks/node')
  const session = new Liveblocks({ secret }).prepareSession(String(me.id), { userInfo: { name: me.name } })
  session.allow(LIVE_ROOM, ['*:read', 'room:presence:write'])
  const { status, body } = await session.authorize()
  return new Response(body, { status, headers: { 'content-type': 'application/json' } })
})

// 🚀 2027 WithSet 호 염원: 마을에서 로켓을 쏠 때마다 하나씩 쌓인다 (모두 합친 수만)
app.get('/me/rocket', async (c) => {
  const q = await db()
  const [r] = await q<{ value: string }>(`select value from settings where key = 'rocket_wishes'`)
  return c.json({ wishes: Number(r?.value ?? 0) })
})
app.post('/me/rocket', async (c) => {
  const q = await db()
  const [r] = await q<{ value: string }>(
    `insert into settings (key, value) values ('rocket_wishes', '1')
     on conflict (key) do update set value = (settings.value::int + 1)::text returning value`,
  )
  return c.json({ wishes: Number(r.value) })
})

// 📸 보너스 미션: 마을에서 챙길 사람과 찍은 사진. 산타마다 한 장(다시 찍으면 바뀜), 공개일 발표 화면에서만 열린다
const PHOTO_MAX = 900_000 // data URL 글자 수 (약 650KB jpeg)
app.get('/me/photo', async (c) => {
  const q = await db()
  const [r] = await q<{ image: string; taken_at: string }>(`select image, taken_at from santa_photos where santa_id = $1`, [c.get('me').id])
  return c.json({ image: r?.image ?? null, takenAt: r?.taken_at ?? null })
})
app.put('/me/photo', async (c) => {
  if ((await getPhase()) !== 'ACTIVE') return bad(c, '산타 발표 뒤부터 공개일 전까지 찍을 수 있어요', 409)
  const { image } = await c.req.json<{ image?: unknown }>().catch(() => ({ image: undefined }))
  if (typeof image !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > PHOTO_MAX) return bad(c, '사진 형식이 이상해요')
  const me = c.get('me')
  const q = await db()
  await q(
    `insert into santa_photos (santa_id, image) values ($1, $2) on conflict (santa_id) do update set image = excluded.image, taken_at = now()`,
    [me.id, image],
  )
  await q(`insert into mission_checks (player_id, mission) values ($1, 'photo') on conflict do nothing`, [me.id])
  return c.json({ ok: true })
})

// 🎅 산타 미션 체크 (src/schedule.ts): 미션 시작일부터 공개일 전까지. 체크한 건 나만 본다
app.put('/me/missions/:id', async (c) => {
  const id = c.req.param('id')
  if (!isMissionId(id)) return bad(c, '없는 미션이에요', 404)
  if (id === 'photo') return bad(c, '사진을 찍으면 자동으로 체크돼요', 409)
  if ((await getPhase()) !== 'ACTIVE') return bad(c, '산타 발표 뒤에 할 수 있어요', 409)
  if (!missionOpen(missionById(id), today())) return bad(c, '아직 시작 안 한 미션이에요', 409)
  const { done } = await c.req.json<{ done?: unknown }>().catch(() => ({ done: undefined }))
  const q = await db()
  const me = c.get('me')
  if (done === false) await q(`delete from mission_checks where player_id = $1 and mission = $2`, [me.id, id])
  else await q(`insert into mission_checks (player_id, mission) values ($1, $2) on conflict do nothing`, [me.id, id])
  return c.json({ ok: true })
})

// 쿠키 꾸미기. 정해진 선택지만 저장한다
app.put('/me/look', async (c) => {
  const me = c.get('me')
  const look = cleanLook(await c.req.json(), me.id)
  const q = await db()
  await q(`update players set look = $2 where id = $1`, [me.id, JSON.stringify(look)])
  return c.json(look)
})


app.put('/me/profile', async (c) => {
  if ((await getPhase()) === 'REVEAL') return bad(c, '공개일 이후에는 바꿀 수 없어요', 409)
  // 받는 항목을 고정해서 임의 데이터가 저장되지 않게 한다 (src/profile.ts)
  const profile = readProfile(await c.req.json())
  const q = await db()
  await q(`update players set profile = $2 where id = $1`, [c.get('me').id, JSON.stringify(profile)])
  return c.json({ ok: true })
})

// 나의 마니또 (내가 챙길 사람). "나의 산타"를 알려주는 경로는 만들지 않는다 (PRD 4.3)
app.get('/me/manito', async (c) => {
  if ((await getPhase()) === 'READY') return bad(c, '아직 챙길 사람이 정해지지 않았어요', 409)
  const q = await db()
  const [t] = await q<{ name: string; profile: unknown }>(
    `select p.name, p.profile from matches m join players p on p.id = m.target_id where m.santa_id = $1`,
    [c.get('me').id],
  )
  if (!t) return bad(c, '매칭 정보가 없어요. 운영자에게 알려 주세요', 404)
  return c.json({ name: t.name, profile: t.profile ? readProfile(t.profile) : null })
})

app.post('/me/manito/open', async (c) => {
  const q = await db()
  await q(`update players set manito_opened_at = coalesce(manito_opened_at, now()) where id = $1`, [c.get('me').id])
  return c.json({ ok: true })
})

// ── 마니또 소개서 (PRD 5.5) ─────────────────────────────────────
// 쓴 사람 본인만 읽고 쓴다. 공개일(REVEAL)부터는 잠긴다.
async function loadLetter(santaId: number) {
  const q = await db()
  const [t] = await q<{ name: string }>(`select p.name from matches m join players p on p.id = m.target_id where m.santa_id = $1`, [santaId])
  const [l] = await q<{ body: unknown; submitted_at: string | null; updated_at: string }>(
    `select body, submitted_at, updated_at from letters where santa_id = $1`,
    [santaId],
  )
  return {
    target: t?.name ?? null,
    body: l ? cleanLetter(l.body) : EMPTY_LETTER,
    submittedAt: l?.submitted_at ?? null,
    updatedAt: l?.updated_at ?? null,
  }
}

app.get('/me/letter', async (c) => {
  const phase = await getPhase()
  if (phase === 'READY') return bad(c, '챙길 사람이 정해지면 쓸 수 있어요', 409)
  return c.json({ ...(await loadLetter(c.get('me').id)), locked: phase === 'REVEAL' })
})

// submit=true 면 제출. 한 번 제출한 소개서는 고칠 때도 모든 문항이 차 있어야 한다.
app.put('/me/letter', async (c) => {
  const phase = await getPhase()
  if (phase === 'READY') return bad(c, '챙길 사람이 정해지면 쓸 수 있어요', 409)
  if (phase === 'REVEAL') return bad(c, '공개일이 시작돼서 더 고칠 수 없어요', 409)
  const { body, submit } = await c.req.json<{ body: unknown; submit?: boolean }>()
  const letter = cleanLetter(body)
  const me = c.get('me')
  const q = await db()
  const [prev] = await q<{ submitted: boolean }>(`select submitted_at is not null as submitted from letters where santa_id = $1`, [me.id])
  if (submit || prev?.submitted) {
    const empty = missing(letter)
    if (empty.length) return bad(c, `아직 비어 있는 문항이 있어요: ${empty.join(', ')}`)
  }
  await q(
    `insert into letters (santa_id, body, submitted_at) values ($1, $2, case when $3 then now() else null end)
     on conflict (santa_id) do update set body = excluded.body, updated_at = now(),
       submitted_at = coalesce(letters.submitted_at, excluded.submitted_at)`,
    [me.id, JSON.stringify(letter), !!submit],
  )
  return c.json(await loadLetter(me.id))
})

// ── 🔍 내 산타 추리노트 (src/guess.ts) ─────────────────────────────
// 쓴 사람 본인만 읽고 쓴다. 진행 기간(ACTIVE)에만 쓰고, 공개일(REVEAL)부터는 잠긴다.
async function loadGuess(pid: number) {
  const q = await db()
  const people = await q<{ id: number; name: string }>(`select id, name from players where id <> $1 order by name`, [pid])
  const [g] = await q<{ body: unknown; updated_at: string }>(`select body, updated_at from guesses where player_id = $1`, [pid])
  return {
    people,
    body: g ? cleanGuess(g.body, people.map((p) => p.id)) : EMPTY_GUESS,
    updatedAt: g?.updated_at ?? null,
  }
}

async function guessStatus(pid: number): Promise<GuessStatus> {
  const q = await db()
  const [g] = await q<{ body: Guess }>(`select body from guesses where player_id = $1`, [pid])
  return !g ? 'none' : guessDone(g.body) ? 'done' : 'draft'
}

app.get('/me/guess', async (c) => {
  const phase = await getPhase()
  if (phase === 'READY') return bad(c, '산타 배정이 시작되면 쓸 수 있어요', 409)
  return c.json({ ...(await loadGuess(c.get('me').id)), locked: phase === 'REVEAL' })
})

app.put('/me/guess', async (c) => {
  const phase = await getPhase()
  if (phase === 'READY') return bad(c, '산타 배정이 시작되면 쓸 수 있어요', 409)
  if (phase === 'REVEAL') return bad(c, '공개일이 시작돼서 더 고칠 수 없어요', 409)
  const me = c.get('me')
  const q = await db()
  const ids = (await q<{ id: number }>(`select id from players where id <> $1`, [me.id])).map((r) => r.id)
  const guess = cleanGuess(await c.req.json(), ids)
  await q(
    `insert into guesses (player_id, body) values ($1, $2)
     on conflict (player_id) do update set body = excluded.body, updated_at = now()`,
    [me.id, JSON.stringify(guess)],
  )
  return c.json(await loadGuess(me.id))
})

// ── 🎄 메시지 트리 (매일 바뀌는 질문에 답을 걸어 두기) ──────────────────
// 마니또와 상관없는 공개 게시판이다. 이름과 함께 보인다.
// 운영자가 바꾼 질문 목록과 시작일 (없으면 기본값)
async function getQuestions(): Promise<{ list: string[]; start: string }> {
  const q = await db()
  const rows = await q<{ key: string; value: string }>(`select key, value from settings where key in ('questions', 'questions_start')`)
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  let list: string[] = []
  try {
    list = cleanQuestions(JSON.parse(m.questions ?? 'null'))
  } catch {
    /* 깨진 값이면 기본 목록 */
  }
  return { list: list.length ? list : [...QUESTIONS], start: isDay(m.questions_start) ? m.questions_start : FIRST_DAY }
}

app.use('/tree', requireLogin)
app.use('/tree/*', requireLogin)
const MESSAGE_MAX = 140

app.get('/tree/summary', async (c) => {
  const q = await db()
  const today = treeDay() // 주말이면 금요일 (금요일 질문이 이어진다)
  const qs = await getQuestions()
  const [r] = await q<{ total: number; today: number }>(`select count(*)::int as total, count(*) filter (where day = $1)::int as today from messages`, [today])
  return c.json({ today, question: questionFor(today, qs.list, qs.start), total: r.total, todayCount: r.today })
})

app.get('/tree', async (c) => {
  const today = treeDay() // 주말이면 금요일 (금요일 질문이 이어진다)
  const asked = c.req.query('day')
  const day = isDay(asked) && asked <= today ? asked : today
  const me = c.get('me')
  const q = await db()
  const messages = await q<{ id: number; name: string; player_id: number; body: string; hearts: number; liked: boolean }>(
    `select m.id, p.name, m.player_id, m.body,
       (select count(*)::int from hearts h where h.message_id = m.id) as hearts,
       exists (select 1 from hearts h where h.message_id = m.id and h.player_id = $2) as liked
     from messages m join players p on p.id = m.player_id
     where m.day = $1 order by m.created_at`,
    [day, me.id],
  )
  const days = (await q<{ day: string }>(`select distinct day from messages where day <= $1 order by day desc`, [today])).map((r) => r.day)
  if (!days.includes(today)) days.unshift(today)
  const qs = await getQuestions()
  return c.json({
    today,
    day,
    question: questionFor(day, qs.list, qs.start),
    days,
    messages: messages.map((m) => ({ id: m.id, name: m.name, body: m.body, hearts: m.hearts, liked: m.liked, mine: m.player_id === me.id })),
  })
})

// 오늘 내 답 걸기·고치기. 빈 글이면 떼어 낸다. 지난 날짜에는 쓸 수 없다
app.put('/tree/today', async (c) => {
  const { body } = await c.req.json<{ body: unknown }>()
  const text = typeof body === 'string' ? body.trim().slice(0, MESSAGE_MAX) : ''
  const me = c.get('me')
  const q = await db()
  const today = treeDay() // 주말이면 금요일 (금요일 질문이 이어진다)
  if (!text) {
    await q(`delete from messages where player_id = $1 and day = $2`, [me.id, today])
  } else {
    await q(
      `insert into messages (player_id, day, body) values ($1, $2, $3)
       on conflict (player_id, day) do update set body = excluded.body`,
      [me.id, today, text],
    )
  }
  return c.json({ ok: true })
})

app.post('/tree/:id/heart', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return bad(c, '없는 메시지예요', 404)
  const me = c.get('me')
  const q = await db()
  const [m] = await q(`select id from messages where id = $1`, [id])
  if (!m) return bad(c, '없는 메시지예요', 404)
  const removed = await q(`delete from hearts where message_id = $1 and player_id = $2 returning message_id`, [id, me.id])
  if (removed.length === 0) await q(`insert into hearts (message_id, player_id) values ($1, $2) on conflict do nothing`, [id, me.id])
  return c.json({ liked: removed.length === 0 })
})

// ── 🎮 놀이 기록판 (🛷 썰매 · ⛄ 눈굴리기) ───────────────────────────
// 한 번 할 때마다 기록을 올린다. 최고 기록만 남고, 횟수는 센다. 그냥 재미 (상품 없음)
app.use('/records/*', requireLogin)
const isRecordKind = (k: string): k is RecordKind => (RECORD_KINDS as readonly string[]).includes(k)

async function recordBoard(kind: RecordKind, meId: number) {
  const q = await db()
  const rows = await q<{ id: number; name: string; best: number; runs: number }>(
    `select p.id, p.name, r.best, r.runs from game_records r join players p on p.id = r.player_id
     where r.kind = $1 order by r.best desc, r.updated_at asc`,
    [kind],
  )
  const list = rows.map((r, i) => ({ rank: i + 1, name: r.name, best: Math.round(Number(r.best) * 10) / 10, runs: r.runs, me: r.id === meId }))
  return { top: list.slice(0, 5), mine: list.find((r) => r.me) ?? null }
}

app.get('/records/:kind', async (c) => {
  const kind = c.req.param('kind')
  if (!isRecordKind(kind)) return bad(c, '없는 기록판이에요', 404)
  return c.json(await recordBoard(kind, c.get('me').id))
})

app.post('/records/:kind', async (c) => {
  const kind = c.req.param('kind')
  if (!isRecordKind(kind)) return bad(c, '없는 기록판이에요', 404)
  const { value } = await c.req.json<{ value?: unknown }>().catch(() => ({ value: undefined }))
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > RECORD_MAX[kind] + 0.05) return bad(c, '이상한 기록이에요')
  const me = c.get('me')
  const v = Math.round(value * 10) / 10
  const q = await db()
  const [before] = await q<{ best: number }>(`select best from game_records where player_id = $1 and kind = $2`, [me.id, kind])
  await q(
    `insert into game_records (player_id, kind, best) values ($1, $2, $3)
     on conflict (player_id, kind) do update set runs = game_records.runs + 1, best = greatest(game_records.best, excluded.best),
       updated_at = case when excluded.best > game_records.best then now() else game_records.updated_at end`,
    [me.id, kind, v],
  )
  const newBest = !before || v > Number(before.best) + 1e-6
  return c.json({ ...(await recordBoard(kind, me.id)), value: v, newBest })
})

// ── ⭐ XP · 레벨 ─────────────────────────────────────────────
// 총 XP = 놀이 XP (xp_daily 합) + 이벤트 참여 XP (리포트·추리노트·트리·키워드·숨은 선물·마니또 확인에서 계산)
app.use('/xp', requireLogin)
const isXpKind = (k: unknown): k is XpKind => typeof k === 'string' && (XP_KINDS as readonly string[]).includes(k)

async function xpBoard(meId: number) {
  const q = await db()
  const rows = await q<{
    id: number
    name: string
    play: number
    letter: boolean
    guess: boolean
    tree_days: number
    keywords: number
    treasure: boolean
    manito: boolean
    missions: number
    profile: unknown
  }>(
    `select p.id, p.name, p.profile,
       (select count(*) from mission_checks mc where mc.player_id = p.id)::int as missions,
       coalesce((select sum(xp) from xp_daily x where x.player_id = p.id), 0)::int as play,
       exists (select 1 from letters l where l.santa_id = p.id and l.submitted_at is not null) as letter,
       exists (select 1 from guesses g where g.player_id = p.id) as guess,
       (select count(distinct day) from messages m where m.player_id = p.id)::int as tree_days,
       (select count(*) from keywords k where k.giver_id = p.id)::int as keywords,
       exists (select 1 from treasure_finds t where t.player_id = p.id) as treasure,
       p.manito_opened_at is not null as manito
     from players p`,
  )
  const list = rows
    .map((r) => {
      const xp =
        Number(r.play) +
        (r.letter ? XP_EVENT.letter : 0) +
        (r.guess ? XP_EVENT.guess : 0) +
        Number(r.tree_days) * XP_EVENT.treeDay +
        Number(r.keywords) * XP_EVENT.keyword +
        (r.treasure ? XP_EVENT.treasure : 0) +
        (r.manito ? XP_EVENT.manito : 0) +
        Number(r.missions) * XP_EVENT.mission +
        (r.profile && !isEmptyProfile(readProfile(r.profile)) ? XP_EVENT.profile : 0)
      return { id: r.id, name: r.name, xp, ...levelOf(xp) }
    })
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
    .map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, xp: r.xp, lv: r.lv, cur: r.cur, need: r.need, me: r.id === meId }))
  return { top: list.slice(0, 5), mine: list.find((r) => r.me) ?? null }
}

app.get('/xp', async (c) => c.json(await xpBoard(c.get('me').id)))

app.post('/xp', async (c) => {
  const { kind } = await c.req.json<{ kind?: unknown }>().catch(() => ({ kind: undefined }))
  if (!isXpKind(kind)) return bad(c, '없는 XP 종류예요')
  const me = c.get('me')
  const day = kstDay()
  const q = await db()
  const [row] = await q<{ xp: number }>(
    `insert into xp_daily (player_id, day, kind, xp) values ($1, $2, $3, least($4::int, $5::int))
     on conflict (player_id, day, kind) do update set xp = least(xp_daily.xp + $4::int, $5::int)
     returning xp`,
    [me.id, day, kind, XP_GAIN[kind], XP_DAILY_CAP[kind]],
  )
  return c.json({ ...(await xpBoard(me.id)), capped: Number(row.xp) >= XP_DAILY_CAP[kind] })
})

// ── 🏆 AX 어워즈: 엘프 인터뷰로 만드는 상장 ────────────────────────────────
// 나를 뺀 모두에게 키워드를 준다. 공개일 전까지는 내가 준 것만 보이고, 공개일에 받은 사람별로 합친 상이 열린다.
// 누가 어떤 키워드를 줬는지는 끝까지 아무에게도(운영자 포함) 보여 주지 않는다.
app.use('/awards', requireLogin)
app.use('/awards/*', requireLogin)

const toGift = (r: { chips: string[]; custom: string | null }): Gift => cleanGift(r)

app.get('/awards', async (c) => {
  const me = c.get('me')
  const q = await db()
  const phase = await getPhase()
  const players = await q<{ id: number; name: string; newcomer: boolean }>(`select id, name, newcomer from players order by name`)
  const meNew = players.find((p) => p.id === me.id)?.newcomer ?? false
  const mine = await q<{ receiver_id: number; chips: string[]; custom: string | null; chat: QA[] | null }>(
    `select receiver_id, chips, custom, chat from keywords where giver_id = $1`,
    [me.id],
  )
  let results = null
  if (phase === 'REVEAL') {
    const all = await q<{ receiver_id: number; chips: string[]; custom: string | null }>(`select receiver_id, chips, custom from keywords`)
    const cards = await q<{ player_id: number; title: string; citation: string }>(`select player_id, title, citation from award_cards`)
    results = players.map((p) => {
      const base = awardFor(all.filter((g) => g.receiver_id === p.id).map(toGift))
      const card = cards.find((x) => x.player_id === p.id)
      return { id: p.id, name: p.name, ...base, ...(card ? { titles: [card.title], citation: card.citation } : { citation: null }) }
    })
  }
  return c.json({
    phase,
    people: players
      .filter((p) => p.id !== me.id)
      .map((p) => {
        const g = mine.find((m) => m.receiver_id === p.id)
        return { id: p.id, name: p.name, fresh: meNew || p.newcomer, gift: g ? toGift(g) : { chips: [], custom: null }, chat: g?.chat ?? null }
      }),
    results,
  })
})

app.put('/awards/keywords', async (c) => {
  if ((await getPhase()) === 'REVEAL') return bad(c, '어워즈 인터뷰가 끝났어요', 409)
  const body = await c.req.json<{ receiverId?: unknown; chips?: unknown; custom?: unknown }>()
  const me = c.get('me')
  const receiverId = Number(body.receiverId)
  if (receiverId === me.id) return bad(c, '나에게는 줄 수 없어요')
  const q = await db()
  const [p] = await q(`select id from players where id = $1`, [receiverId])
  if (!p) return bad(c, '없는 참가자예요', 404)
  const gift = cleanGift(body)
  if (isEmptyGift(gift)) {
    // 인터뷰 답이 있으면 줄은 남기고 키워드만 비운다
    await q(`delete from keywords where giver_id = $1 and receiver_id = $2 and chat is null`, [me.id, receiverId])
    await q(`update keywords set chips = '{}', custom = null, updated_at = now() where giver_id = $1 and receiver_id = $2`, [me.id, receiverId])
  } else {
    await q(
      `insert into keywords (giver_id, receiver_id, chips, custom) values ($1, $2, $3, $4)
       on conflict (giver_id, receiver_id) do update set chips = excluded.chips, custom = excluded.custom, updated_at = now()`,
      [me.id, receiverId, gift.chips, gift.custom],
    )
  }
  return c.json({ gift })
})

// 🧝 엘프 인터뷰 (고정 질문 3개). 대화는 화면이 들고 있다가 답할 때마다 통째로 보낸다.
// 남은 질문이 있으면 다음 질문을, 끝났으면(또는 "여기까지") 저장한다. 마지막 답이 짧으면 직접 쓴 키워드로도 넣는다.
app.post('/awards/interview', async (c) => {
  if ((await getPhase()) === 'REVEAL') return bad(c, '인터뷰가 끝났어요', 409)
  const body = await c.req.json<{ receiverId?: unknown; chat?: unknown; finish?: unknown }>()
  const me = c.get('me')
  const receiverId = Number(body.receiverId)
  if (receiverId === me.id) return bad(c, '나에 대해서는 인터뷰하지 않아요')
  const q = await db()
  const [p] = await q<{ id: number; name: string; newcomer: boolean }>(`select id, name, newcomer from players where id = $1`, [receiverId])
  if (!p) return bad(c, '없는 참가자예요', 404)
  const [{ newcomer: meNew }] = await q<{ newcomer: boolean }>(`select newcomer from players where id = $1`, [me.id])
  const chat = cleanChat(body.chat)
  const qs = questions(p.name, meNew || p.newcomer)
  if (chat.length < INTERVIEW_MAX && (chat.length === 0 || body.finish !== true)) return c.json({ done: false, question: qs[chat.length] })

  const [old] = await q<{ chips: string[]; custom: string | null }>(`select chips, custom from keywords where giver_id = $1 and receiver_id = $2`, [me.id, receiverId])
  const nick = chat.length === INTERVIEW_MAX ? nickname(chat[INTERVIEW_MAX - 1].a) : null
  const gift = cleanGift({ chips: old?.chips ?? [], custom: nick ?? old?.custom ?? null })
  await q(
    `insert into keywords (giver_id, receiver_id, chips, custom, chat) values ($1, $2, $3, $4, $5)
     on conflict (giver_id, receiver_id) do update set custom = excluded.custom, chat = excluded.chat, updated_at = now()`,
    [me.id, receiverId, gift.chips, gift.custom, JSON.stringify(chat)],
  )
  return c.json({ done: true, gift, chat })
})

// ── 🎀 보물찾기 ───────────────────────────────────────────────
// 마니또 시작(ACTIVE)부터. 진짜는 1인 1개·자리 하나에 한 사람. 꽝은 기회를 쓰지 않는다.
// 어느 자리가 진짜인지는 서버만 안다 (REAL). 화면에는 "이미 누가 가져간 자리"와 "내가 연 꽝"만 내려준다.
type Find = { spot: string; player_id: number; name: string; found_at: string }
const treasureOpen = (phase: Phase) => phase !== 'READY'
const rescue = () => kstDay() >= RESCUE_FROM
const REAL_SPOTS = SPOTS.filter((s) => REAL[s.id])

async function finds(): Promise<Find[]> {
  const q = await db()
  return q<Find>(`select f.spot, f.player_id, p.name, f.found_at from treasure_finds f join players p on p.id = f.player_id order by f.found_at`)
}

/** 엘프 잔소리용: 아직 못 찾았으면 남은 진짜 개수, 구제 기간엔 남은 진짜 하나의 위치 힌트 */
async function giftTodo(pid: number): Promise<{ found: boolean; left: number; hint: string | null } | null> {
  if (!treasureOpen(await getPhase())) return null
  const all = await finds()
  const left = REAL_SPOTS.filter((s) => !all.some((f) => f.spot === s.id))
  const found = all.some((f) => f.player_id === pid)
  const hint = !found && rescue() && left.length ? left[pid % left.length].place : null
  return { found, left: left.length, hint }
}

app.use('/treasure', requireLogin)
app.use('/treasure/*', requireLogin)

app.get('/treasure', async (c) => {
  const me = c.get('me')
  if (!treasureOpen(await getPhase())) return c.json({ active: false, rescue: false, total: REAL_SPOTS.length, found: [], mine: null, duds: [], glow: [] })
  const q = await db()
  const all = await finds()
  const mine = all.find((f) => f.player_id === me.id)
  const duds = await q<{ spot: string }>(`select spot from treasure_duds where player_id = $1`, [me.id])
  const left = REAL_SPOTS.filter((s) => !all.some((f) => f.spot === s.id))
  return c.json({
    active: true,
    rescue: rescue(),
    total: REAL_SPOTS.length,
    found: all.map((f) => ({ spot: f.spot, name: f.name, at: f.found_at, tier: REAL[f.spot] })), // 누가 몇 등을 찾았는지는 모두에게 공개
    mine: mine ? { spot: mine.spot, tier: REAL[mine.spot] } : null,
    duds: duds.map((d) => d.spot),
    glow: rescue() && !mine ? left.map((s) => s.id) : [], // 구제 기간에만: 남은 진짜 자리
  })
})

app.post('/treasure/:spot/open', async (c) => {
  const me = c.get('me')
  if (!treasureOpen(await getPhase())) return bad(c, '보물찾기는 산타 배정이 시작되면 열려요', 409)
  const s = spot(c.req.param('spot'))
  if (!s) return bad(c, '없는 자리예요', 404)
  const q = await db()
  const [already] = await q<{ spot: string }>(`select spot from treasure_finds where player_id = $1`, [me.id])
  if (already) return bad(c, '숨은 선물은 1인 1개! 이미 찾았어요. 남은 건 동료들 몫이에요 🎄', 409)
  const tier = REAL[s.id]
  if (!tier) {
    await q(`insert into treasure_duds (player_id, spot) values ($1, $2) on conflict do nothing`, [me.id, s.id])
    return c.json({ kind: 'dud', spot: s.id, line: dudLine(s.id) })
  }
  let got: { spot: string }[] = []
  try {
    got = await q<{ spot: string }>(`insert into treasure_finds (spot, player_id) values ($1, $2) on conflict (spot) do nothing returning spot`, [s.id, me.id])
  } catch {
    return bad(c, '숨은 선물은 1인 1개! 이미 찾았어요. 남은 건 동료들 몫이에요 🎄', 409) // 같은 사람이 두 탭에서 동시에
  }
  if (!got.length) return bad(c, '앗, 방금 다른 동료가 먼저 열었어요! 다른 데를 찾아봐요 🔍', 409)
  return c.json({ kind: 'gift', spot: s.id, tier })
})

// ── 운영자 (블라인드: 매칭과 남의 내용은 돌려주지 않는다, PRD 4.2) ─────
app.use('/admin/*', requireLogin, requireAdmin)

app.get('/admin/status', async (c) => {
  const q = await db()
  // 소개서는 "쓴 사람" 기준 제출 여부만. 누구에 대해 썼는지는 드러나지 않는다 (IA A1)
  const rows = await q<{ id: number; name: string; has_pin: boolean; has_profile: boolean; opened: boolean; letter: string }>(
    `select p.id, p.name, p.pin_hash is not null as has_pin, p.profile is not null as has_profile,
            p.manito_opened_at is not null as opened,
            case when l.submitted_at is not null then 'submitted' when l.santa_id is not null then 'draft' else 'none' end as letter
     from players p left join letters l on l.santa_id = p.id order by p.name`,
  )
  const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from matches`)
  return c.json({
    phase: await getPhase(),
    matched: n > 0,
    players: await Promise.all(
      rows.map(async (r) => ({ id: r.id, name: r.name, hasPin: r.has_pin, hasProfile: r.has_profile, opened: r.opened, letter: r.letter, guess: await guessStatus(r.id) })),
    ),
  })
})

app.post('/admin/phase', async (c) => {
  const { to } = await c.req.json<{ to: Phase }>()
  const from = await getPhase()
  if (PHASES.indexOf(to) !== PHASES.indexOf(from) + 1) return bad(c, `${from} 에서 ${to} 로는 바꿀 수 없어요`, 409)
  const q = await db()
  if (to === 'ACTIVE') {
    // 매칭은 READY → ACTIVE 전환 때 서버에서 한 번만 만든다. 결과는 로그에 남기지 않는다.
    const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from matches`)
    if (n === 0) {
      const ids = (await q<{ id: number }>(`select id from players`)).map((r) => r.id)
      const pairs = makeCycle(ids)
      const values = pairs.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')
      await q(
        `insert into matches (santa_id, target_id) values ${values}`,
        pairs.flatMap((p) => [p.santaId, p.targetId]),
      )
    }
  }
  await q(`update settings set value = $1 where key = 'phase' and value = $2`, [to, from])
  return c.json({ phase: to })
})

// 🎬 공개일 더블 리빌 (발표 화면). 공개일(REVEAL)부터만 짝·관찰 리포트·추리노트를 한꺼번에 준다.
// 그 전에는 운영자에게도 짝을 보여 주지 않는다 (블라인드).
app.get('/admin/reveal', async (c) => {
  if ((await getPhase()) !== 'REVEAL') return bad(c, '공개일이 시작되면 열려요', 409)
  const q = await db()
  const players = await q<{ id: number; name: string }>(`select id, name from players order by name`)
  const name = (id: number | null) => players.find((p) => p.id === id)?.name ?? null
  const pairs = await q<{ santa_id: number; target_id: number }>(`select santa_id, target_id from matches`)
  const letters = await q<{ santa_id: number; body: unknown; submitted: boolean }>(`select santa_id, body, submitted_at is not null as submitted from letters`)
  const guesses = await q<{ player_id: number; body: unknown }>(`select player_id, body from guesses`)
  const photos = await q<{ santa_id: number; image: string }>(`select santa_id, image from santa_photos`)
  const targetOf = new Map(pairs.map((p) => [p.santa_id, p.target_id]))
  return c.json({
    people: players,
    cards: pairs.map(({ santa_id, target_id }) => {
      const l = letters.find((x) => x.santa_id === santa_id)
      const gRow = guesses.find((x) => x.player_id === target_id)
      const g = gRow ? cleanGuess(gRow.body, players.filter((p) => p.id !== target_id).map((p) => p.id)) : null
      return {
        target: { id: target_id, name: name(target_id) },
        santa: { id: santa_id, name: name(santa_id) },
        letter: l ? cleanLetter(l.body) : null,
        letterSubmitted: !!l?.submitted,
        guess: g && g.suspect !== null ? { ...g, suspectName: name(g.suspect) } : null,
        // 주인공이 지목한 사람이 사실 주인공 자신이 챙기던 사람인지 (한 줄 순환이라 절대 산타일 수 없다)
        suspectIsMyTarget: !!g && g.suspect !== null && targetOf.get(target_id) === g.suspect,
        photo: photos.find((p) => p.santa_id === santa_id)?.image ?? null, // 📸 산타가 몰래 찍은 사진
      }
    }),
  })
})

// 🎄 메시지 트리 돌아보기 (공개일 발표 화면에서 다같이). 트리 답은 원래 모두에게 보이므로 단계와 상관없이 열린다
app.get('/admin/tree-recap', async (c) => {
  const q = await db()
  const rows = await q<{ day: string; name: string; body: string; hearts: number }>(
    `select m.day, p.name, m.body, (select count(*)::int from hearts h where h.message_id = m.id) as hearts
     from messages m join players p on p.id = m.player_id order by m.day, m.created_at`,
  )
  const [{ people }] = await q<{ people: number }>(`select count(*)::int as people from players`)
  const qs = await getQuestions()
  const days = [...new Set(rows.map((r) => r.day))].sort()
  return c.json({
    people,
    days: days.map((day) => ({
      day,
      question: questionFor(day, qs.list, qs.start),
      messages: rows.filter((r) => r.day === day).map((r) => ({ name: r.name, body: r.body, hearts: Number(r.hearts) })),
    })),
  })
})

// 어워즈 진행: 사람마다 "몇 명에게 줬는지"만 (누구에게 무엇을 줬는지는 주지 않는다)
app.get('/admin/awards', async (c) => {
  const q = await db()
  const rows = await q<{ id: number; name: string; newcomer: boolean; given: number }>(
    `select p.id, p.name, p.newcomer, (select count(*)::int from keywords k where k.giver_id = p.id) as given from players p order by p.name`,
  )
  const cards = await q<{ player_id: number; name: string; title: string; citation: string }>(
    `select a.player_id, p.name, a.title, a.citation from award_cards a join players p on p.id = a.player_id`,
  )
  const ids = await q<{ id: number; name: string }>(`select id, name from players order by name`)
  return c.json({
    people: rows.length - 1,
    players: rows,
    cards: ids.map((p) => {
      const x = cards.find((k) => k.player_id === p.id)
      return { id: p.id, name: p.name, title: x?.title ?? null, citation: x?.citation ?? null }
    }),
  })
})

// 🌱 새로 온 사람 표시 (어워즈 인터뷰 질문이 첫인상·기대로 바뀐다)
app.put('/admin/players/:id/newcomer', async (c) => {
  const id = Number(c.req.param('id'))
  const { newcomer } = await c.req.json<{ newcomer?: unknown }>()
  const q = await db()
  await q(`update players set newcomer = $2 where id = $1`, [id, newcomer === true])
  return c.json({ id, newcomer: newcomer === true })
})

// 상장 고치기 (운영자가 직접)
app.put('/admin/awards/cards/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ title?: unknown; citation?: unknown }>()
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 40) : ''
  const citation = typeof body.citation === 'string' ? body.citation.trim().slice(0, 600) : ''
  const q = await db()
  if (!title) {
    await q(`delete from award_cards where player_id = $1`, [id])
    return c.json({ id, title: null, citation: null })
  }
  await q(
    `insert into award_cards (player_id, title, citation) values ($1, $2, $3)
     on conflict (player_id) do update set title = excluded.title, citation = excluded.citation, updated_at = now()`,
    [id, title, citation],
  )
  return c.json({ id, title, citation })
})

// 보물찾기 현황: 선물 전달을 위해 운영자는 누가 어떤 선물을 찾았는지 본다 (진짜 자리만)
app.get('/admin/treasure', async (c) => {
  const all = await finds()
  const q = await db()
  const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from treasure_duds`)
  return c.json({
    phase: await getPhase(),
    spots: SPOTS.length,
    duds: n,
    boxes: REAL_SPOTS.map((s) => {
      const f = all.find((x) => x.spot === s.id)
      return { id: s.id, place: s.place, tier: REAL[s.id], gift: tierOf(REAL[s.id]).gift, finder: f?.name ?? null, at: f?.found_at ?? null }
    }).sort((a, b) => a.tier - b.tier),
  })
})

// 메시지 트리 질문 관리: 목록(한 줄에 하나)과 첫 질문이 나오는 날
app.get('/admin/questions', async (c) => {
  const qs = await getQuestions()
  return c.json({ ...qs, today: treeDay() })
})

app.put('/admin/questions', async (c) => {
  const { questions, start } = await c.req.json<{ questions: unknown; start: unknown }>()
  const list = cleanQuestions(questions)
  if (!list.length) return bad(c, '질문을 하나 이상 넣어 주세요')
  if (!isDay(start)) return bad(c, '시작일을 날짜로 넣어 주세요')
  const q = await db()
  for (const [key, value] of [
    ['questions', JSON.stringify(list)],
    ['questions_start', start],
  ]) {
    await q(`insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value`, [key, value])
  }
  return c.json({ list, start, today: treeDay(), first: questionDay(start, 0) })
})

// ⚠️ 전체 초기화: 테스트 흔적을 지우고 행사 전 상태로. 되돌릴 수 없어서 확인 문구를 정확히 받아야 한다.
// 지우는 것: 매칭, 소개서, 메시지 트리 답·❤️, 어워즈 투표, 모든 사람의 PIN·로그인·꾸미기·프로필·상자 개봉,
//           운영 화면에서 바꾼 질문·상 목록 (코드 기본값으로 돌아감). 단계는 READY 로.
// 남는 것: 14명 명단과 운영자 지정.
export const RESET_CONFIRM = '전체 초기화'
app.post('/admin/reset-all', async (c) => {
  const { confirm } = await c.req.json<{ confirm?: unknown }>().catch(() => ({ confirm: undefined }))
  if (confirm !== RESET_CONFIRM) return bad(c, `확인 문구로 "${RESET_CONFIRM}" 을 정확히 입력해 주세요`)
  const q = await db()
  for (const sql of [
    `delete from hearts`,
    `delete from messages`,
    `delete from keywords`,
    `delete from award_cards`,
    `delete from treasure_finds`,
    `delete from treasure_duds`,
    `delete from letters`,
    `delete from guesses`,
    `delete from matches`,
    `delete from sled_runs`,
    `delete from game_records`,
    `delete from xp_daily`,
    `delete from mission_checks`,
    `delete from santa_photos`,
    `update players set pin_hash = null, failed_attempts = 0, locked_until = null, session_version = session_version + 1,
       manito_opened_at = null, profile = null, look = null`,
    `delete from settings where key in ('questions', 'questions_start', 'awards', 'rocket_wishes')`,
    `update settings set value = 'READY' where key = 'phase'`,
  ]) {
    await q(sql)
  }
  deleteCookie(c, COOKIE, { path: '/' }) // 운영자 본인도 로그아웃 (PIN 도 지워졌으니)
  return c.json({ ok: true })
})

app.post('/admin/reset-pin', async (c) => {
  const { playerId } = await c.req.json<{ playerId: number }>()
  const q = await db()
  const rows = await q(
    `update players set pin_hash = null, failed_attempts = 0, locked_until = null,
       session_version = session_version + 1 where id = $1 returning id`,
    [playerId],
  )
  if (rows.length === 0) return bad(c, '없는 참가자예요', 404)
  return c.json({ ok: true })
})
