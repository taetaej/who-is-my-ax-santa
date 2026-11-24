import { ROSTER, ADMIN_NAME } from './roster.js'

/**
 * DB 접근 계층.
 * - DATABASE_URL 이 있으면 Neon(Postgres, HTTP 드라이버) — Vercel 배포용
 * - 없으면 PGlite(WASM 내장 Postgres, .data/pglite 파일) — 로컬 개발용, 설치·계정 불필요
 * 두 경우 모두 같은 Postgres SQL 을 쓴다.
 */
type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>

let ready: Promise<Query> | null = null

export function db(): Promise<Query> {
  ready ??= connect().then(async (q) => {
    await migrate(q)
    return q
  })
  return ready
}

async function connect(): Promise<Query> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(url)
    return async (text, params = []) => (await sql.query(text, params)) as never
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const { mkdirSync } = await import('node:fs')
  const dir = process.env.PGLITE_DIR ?? './.data/pglite'
  mkdirSync(dir, { recursive: true })
  const pg = new PGlite(dir)
  return async (text, params = []) => (await pg.query(text, params)).rows as never
}

async function migrate(q: Query) {
  await q(`create table if not exists players (
    id serial primary key,
    name text not null unique,
    is_admin boolean not null default false,
    pin_hash text,
    failed_attempts int not null default 0,
    locked_until timestamptz,
    session_version int not null default 0,
    manito_opened_at timestamptz,
    profile jsonb
  )`)
  // 쿠키 꾸미기 (나중에 추가된 칸)
  await q(`alter table players add column if not exists look jsonb`)
  // 🌱 새로 온 사람 (아직 팀과 같이 일해 본 적이 없음): 어워즈 인터뷰 질문이 첫인상·기대로 바뀐다
  await q(`alter table players add column if not exists newcomer boolean not null default false`)
  // 메시지 트리: 하루에 한 사람당 한 장 (오늘의 질문에 대한 답). 모두가 이름과 함께 본다
  await q(`create table if not exists messages (
    id serial primary key,
    player_id int not null references players(id),
    day text not null,
    body text not null,
    created_at timestamptz not null default now(),
    unique (player_id, day)
  )`)
  await q(`create table if not exists hearts (
    message_id int not null references messages(id) on delete cascade,
    player_id int not null references players(id),
    primary key (message_id, player_id)
  )`)
  // AX 어워즈: 동료에게 주는 키워드. 한 사람이 한 사람에게 한 줄 (칩 id 목록 + 직접 쓴 키워드)
  // 누가 누구에게 줬는지는 어떤 API 로도 돌려주지 않는다. 공개일엔 받은 사람별로 합친 결과만 연다.
  await q(`create table if not exists keywords (
    giver_id int not null references players(id),
    receiver_id int not null references players(id),
    chips text[] not null default '{}',
    custom text,
    updated_at timestamptz not null default now(),
    primary key (giver_id, receiver_id)
  )`)
  // 🧝 엘프 인터뷰 문답 (질문 3개). 화면에서는 준 사람만 다시 본다
  await q(`alter table keywords add column if not exists chat jsonb`)
  // 🏆 상장: 공개일 전에 운영자가 Claude Code 로 쓰고(scripts/awards.ts) 운영 화면에서 고친다. 공개일에 받은 사람별로 열린다
  await q(`create table if not exists award_cards (
    player_id int primary key references players(id),
    title text not null,
    citation text not null,
    updated_at timestamptz not null default now()
  )`)
  // 🎀 보물찾기: 진짜 선물. 자리 하나는 한 사람만(spot 기본 키), 한 사람은 하나만(player_id unique)
  await q(`create table if not exists treasure_finds (
    spot text primary key,
    player_id int not null unique references players(id),
    found_at timestamptz not null default now()
  )`)
  // 꽝: 누가 어느 자리를 열어 봤는지 (그 사람 화면에만 "열린 상자"로 남는다)
  await q(`create table if not exists treasure_duds (
    player_id int not null references players(id),
    spot text not null,
    primary key (player_id, spot)
  )`)
  // 산타 → 마니또. 운영자 화면과 어떤 API 에서도 이 테이블 전체를 돌려주지 않는다 (PRD 4.2)
  await q(`create table if not exists matches (
    santa_id int primary key references players(id),
    target_id int not null unique references players(id)
  )`)
  // 마니또 소개서 (PRD 5.5). 쓴 사람(산타) 기준으로 한 장. 공개일 전에는 본인만 읽는다
  await q(`create table if not exists letters (
    santa_id int primary key references players(id),
    body jsonb not null,
    submitted_at timestamptz,
    updated_at timestamptz not null default now()
  )`)
  // 🔍 내 산타 추리노트 (src/guess.ts). 쓴 사람 기준 한 장. 공개일 전에는 본인만 읽는다
  await q(`create table if not exists guesses (
    player_id int primary key references players(id),
    body jsonb not null,
    updated_at timestamptz not null default now()
  )`)
  await q(`create table if not exists settings (key text primary key, value text not null)`)
  await q(`insert into settings (key, value) values ('phase', 'READY') on conflict (key) do nothing`)
  for (const name of ROSTER) {
    await q(`insert into players (name, is_admin) values ($1, $2) on conflict (name) do nothing`, [
      name,
      name === ADMIN_NAME,
    ])
  }
}

export type Phase = 'READY' | 'ACTIVE' | 'REVEAL'
export const PHASES: Phase[] = ['READY', 'ACTIVE', 'REVEAL']

export async function getPhase(): Promise<Phase> {
  const q = await db()
  const [row] = await q<{ value: Phase }>(`select value from settings where key = 'phase'`)
  return row.value
}
