import { ROSTER, ADMIN_NAME } from './roster'

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
  // AX 어워즈 투표: 상마다 한 사람당 한 표 (상 이름으로 묶는다)
  await q(`create table if not exists votes (
    voter_id int not null references players(id),
    category text not null,
    nominee_id int not null references players(id),
    primary key (voter_id, category)
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
