import { Hono, type Context, type Next } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { COOKIE, LOCK_MINUTES, MAX_FAILS, PIN_RE, hashPin, issue, read, verifyPin } from './auth'
import { PHASES, db, getPhase, type Phase } from './db'
import { DEFAULT_AWARDS, cleanAwards, tally } from '../src/awards'
import { cleanLook } from '../src/look'
import { FIRST_DAY, QUESTIONS, addDays, cleanQuestions, isDay, kstDay, questionFor } from '../src/questions'
import { EMPTY_LETTER, cleanLetter, missing } from './letter'
import { makeCycle } from './matching'

type Me = { id: number; name: string; is_admin: boolean }
type Env = { Variables: { me: Me } }

export const app = new Hono<Env>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: '서버 오류가 났어요' }, 500)
})

const bad = (c: Context, error: string, status: 400 | 401 | 403 | 404 | 409 | 423 = 400) => c.json({ error }, status)

function login(c: Context, pid: number, v: number) {
  const { value, maxAge } = issue(pid, v)
  setCookie(c, COOKIE, value, { httpOnly: true, sameSite: 'Lax', secure: !!process.env.VERCEL, path: '/', maxAge })
}

async function requireLogin(c: Context<Env>, next: Next) {
  const s = read(getCookie(c, COOKIE))
  if (!s) return bad(c, '로그인이 필요해요', 401)
  const q = await db()
  const [me] = await q<Me & { session_version: number }>(
    `select id, name, is_admin, session_version from players where id = $1`,
    [s.pid],
  )
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
  const rows = await q<{ id: number; name: string; has_pin: boolean }>(
    `select id, name, pin_hash is not null as has_pin from players order by name`,
  )
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
  // 엘프 NPC 잔소리용: 오늘 메시지 트리를 썼는지, 어워즈 투표를 몇 개 했는지
  const awards = await getAwards()
  const [todo] = await q<{ tree: boolean; votes: number }>(
    `select exists (select 1 from messages where player_id = $1 and day = $2) as tree,
       (select count(*)::int from votes where voter_id = $1 and category = any($3)) as votes`,
    [me.id, kstDay(), awards],
  )
  return c.json({
    id: me.id,
    name: me.name,
    isAdmin: me.is_admin,
    phase: await getPhase(),
    manitoOpened: !!row.manito_opened_at,
    profile: row.profile,
    letter: row.letter,
    look: row.look ? cleanLook(row.look, me.id) : null, // null = 아직 안 꾸밈 → 처음 들어올 때 꾸미기 창
    todo: { tree: todo.tree, votes: todo.votes, awards: awards.length },
    // 실시간 마을: 키가 없으면 null → 화면은 혼자 돌아다니는 모드로 동작
    liveRoom: process.env.LIVEBLOCKS_SECRET_KEY ? LIVE_ROOM : null,
  })
})

// ── 실시간 마을 (Liveblocks) ─────────────────────────────────────
// 로그인한 사람에게만, 마을 방 하나의 "읽기 + 위치 공유" 권한만 준다.
// 이름은 서버가 넣으므로 남의 이름으로 들어갈 수 없다. 매칭 정보는 여기로 절대 보내지 않는다.
const LIVE_ROOM = `santa-village-${process.env.VERCEL_ENV ?? 'local'}`

app.post('/me/live-auth', async (c) => {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY
  if (!secret) return bad(c, '실시간 기능이 꺼져 있어요', 404)
  const { Liveblocks } = await import('@liveblocks/node')
  const me = c.get('me')
  const session = new Liveblocks({ secret }).prepareSession(String(me.id), { userInfo: { name: me.name } })
  session.allow(LIVE_ROOM, ['*:read', 'room:presence:write'])
  const { status, body } = await session.authorize()
  return new Response(body, { status, headers: { 'content-type': 'application/json' } })
})

// 쿠키 꾸미기. 정해진 선택지만 저장한다
app.put('/me/look', async (c) => {
  const me = c.get('me')
  const look = cleanLook(await c.req.json(), me.id)
  const q = await db()
  await q(`update players set look = $2 where id = $1`, [me.id, JSON.stringify(look)])
  return c.json(look)
})

const PROFILE_KEYS = ['seat', 'snack', 'style', 'avoid'] as const // PRD 5.2 가정 항목

app.put('/me/profile', async (c) => {
  if ((await getPhase()) === 'REVEAL') return bad(c, '공개일 이후에는 바꿀 수 없어요', 409)
  const body = await c.req.json<Record<string, unknown>>()
  // 받는 항목을 고정해서 임의 데이터가 저장되지 않게 한다
  const profile = Object.fromEntries(PROFILE_KEYS.map((k) => [k, String(body[k] ?? '').slice(0, 200)]))
  const q = await db()
  await q(`update players set profile = $2 where id = $1`, [c.get('me').id, JSON.stringify(profile)])
  return c.json({ ok: true })
})

// 나의 마니또 (내가 챙길 사람). "나의 산타"를 알려주는 경로는 만들지 않는다 (PRD 4.3)
app.get('/me/manito', async (c) => {
  if ((await getPhase()) === 'READY') return bad(c, '아직 마니또가 정해지지 않았어요', 409)
  const q = await db()
  const [t] = await q<{ name: string; profile: unknown }>(
    `select p.name, p.profile from matches m join players p on p.id = m.target_id where m.santa_id = $1`,
    [c.get('me').id],
  )
  if (!t) return bad(c, '매칭 정보가 없어요. 운영자에게 알려 주세요', 404)
  return c.json(t)
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
  const [t] = await q<{ name: string }>(
    `select p.name from matches m join players p on p.id = m.target_id where m.santa_id = $1`,
    [santaId],
  )
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
  if (phase === 'READY') return bad(c, '마니또가 정해지면 쓸 수 있어요', 409)
  return c.json({ ...(await loadLetter(c.get('me').id)), locked: phase === 'REVEAL' })
})

// submit=true 면 제출. 한 번 제출한 소개서는 고칠 때도 모든 문항이 차 있어야 한다.
app.put('/me/letter', async (c) => {
  const phase = await getPhase()
  if (phase === 'READY') return bad(c, '마니또가 정해지면 쓸 수 있어요', 409)
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
  const today = kstDay()
  const qs = await getQuestions()
  const [r] = await q<{ total: number; today: number }>(
    `select count(*)::int as total, count(*) filter (where day = $1)::int as today from messages`,
    [today],
  )
  return c.json({ today, question: questionFor(today, qs.list, qs.start), total: r.total, todayCount: r.today })
})

app.get('/tree', async (c) => {
  const today = kstDay()
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
  const today = kstDay()
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

// ── 🏆 AX 어워즈 ────────────────────────────────────────────────
// 투표는 공개일 전까지 바꿀 수 있고, 결과는 공개일(REVEAL)에만 모두에게 열린다. 그 전엔 운영자도 결과를 못 본다.
async function getAwards(): Promise<string[]> {
  const q = await db()
  const [row] = await q<{ value: string }>(`select value from settings where key = 'awards'`)
  try {
    const list = cleanAwards(JSON.parse(row?.value ?? 'null'))
    if (list.length) return list
  } catch {
    /* 깨진 값이면 기본 목록 */
  }
  return [...DEFAULT_AWARDS]
}

app.use('/awards', requireLogin)
app.use('/awards/*', requireLogin)

app.get('/awards', async (c) => {
  const me = c.get('me')
  const q = await db()
  const phase = await getPhase()
  const categories = await getAwards()
  const mine = await q<{ category: string; nominee_id: number }>(`select category, nominee_id from votes where voter_id = $1`, [me.id])
  const players = await q<{ id: number; name: string }>(`select id, name from players order by name`)
  let results = null
  if (phase === 'REVEAL') {
    const all = await q<{ category: string; nominee_id: number }>(`select category, nominee_id from votes`)
    results = tally(categories, all.map((v) => ({ category: v.category, nomineeId: v.nominee_id })))
  }
  return c.json({
    phase,
    categories: categories.map((name) => ({ name, myVote: mine.find((v) => v.category === name)?.nominee_id ?? null })),
    players,
    results,
  })
})

app.put('/awards/vote', async (c) => {
  if ((await getPhase()) === 'REVEAL') return bad(c, '투표가 끝났어요', 409)
  const { category, nomineeId } = await c.req.json<{ category: unknown; nomineeId: unknown }>()
  const me = c.get('me')
  if (typeof category !== 'string' || !(await getAwards()).includes(category)) return bad(c, '없는 상이에요', 404)
  const q = await db()
  if (nomineeId === null) {
    await q(`delete from votes where voter_id = $1 and category = $2`, [me.id, category])
    return c.json({ ok: true })
  }
  if (nomineeId === me.id) return bad(c, '나에게는 투표할 수 없어요')
  const [p] = await q(`select id from players where id = $1`, [nomineeId])
  if (!p) return bad(c, '없는 참가자예요', 404)
  await q(
    `insert into votes (voter_id, category, nominee_id) values ($1, $2, $3)
     on conflict (voter_id, category) do update set nominee_id = excluded.nominee_id`,
    [me.id, category, nomineeId],
  )
  return c.json({ ok: true })
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
    players: rows.map((r) => ({ id: r.id, name: r.name, hasPin: r.has_pin, hasProfile: r.has_profile, opened: r.opened, letter: r.letter })),
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

// 어워즈 상 목록. 결과는 주지 않고 몇 명이 투표를 끝냈는지만 (블라인드)
app.get('/admin/awards', async (c) => {
  const categories = await getAwards()
  const q = await db()
  const rows = await q<{ voter_id: number; n: number }>(
    `select voter_id, count(*)::int as n from votes where category = any($1) group by voter_id`,
    [categories],
  )
  return c.json({ categories, done: rows.filter((r) => r.n >= categories.length).length, started: rows.length })
})

app.put('/admin/awards', async (c) => {
  const { categories } = await c.req.json<{ categories: unknown }>()
  const list = cleanAwards(categories)
  if (!list.length) return bad(c, '상을 하나 이상 넣어 주세요')
  const q = await db()
  await q(`insert into settings (key, value) values ('awards', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify(list)])
  return c.json({ categories: list })
})

// 메시지 트리 질문 관리: 목록(한 줄에 하나)과 첫 질문이 나오는 날
app.get('/admin/questions', async (c) => {
  const qs = await getQuestions()
  return c.json({ ...qs, today: kstDay() })
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
  return c.json({ list, start, today: kstDay(), tomorrow: questionFor(addDays(kstDay(), 1), list, start) })
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
