import type { AwardCard, Gift } from './awards'
import type { QA } from './interview'
import type { Guess, GuessStatus } from './guess'
import type { Look } from './look'
import type { Profile } from './profile'
import type { RecordKind, XpKind } from './gameRules'
import type { MissionId } from './schedule'
import type { Tier } from './treasure'

export type Phase = 'READY' | 'ACTIVE' | 'REVEAL'
export type { Profile }
export type Player = { id: number; name: string; hasPin: boolean }
export type Me = {
  id: number
  name: string
  isAdmin: boolean
  guest?: boolean // 👀 게스트: 산타 게임엔 안 들어오고 마을 구경·눈싸움만
  phase: Phase
  manitoOpened: boolean
  profile: Profile | null
  liveRoom: string | null
  liveKind: 'rt' | 'liveblocks' | null // 실시간 연결 종류 (rt = 우리 Cloudflare 서버)
  letter: LetterStatus
  guess: GuessStatus
  look: Look | null
  todo: {
    tree: boolean
    given: number // 키워드를 준 동료 수
    people: number // 나를 뺀 인원
    gift: { found: boolean; left: number; hint: string | null } | null // 🎁 보물찾기 (마니또 시작 전엔 null)
  }
  missions: MissionId[] // 🎅 내가 체크한 산타 미션
  today: string // 서버 기준 한국 날짜 (YYYY-MM-DD)
}
export type Awards = {
  phase: Phase
  people: { id: number; name: string; fresh: boolean; gift: Gift; chat: QA[] | null }[] // 나를 뺀 동료 (fresh = 둘 중 한 명이 새로 온 사람 → 첫인상 질문), 내가 준 키워드와 내 인터뷰 답 (null = 인터뷰 전)
  results: ({ id: number; name: string; citation: string | null } & AwardCard)[] | null // 공개일에만
}
export type AwardCardRow = { id: number; title: string | null; citation: string | null }
export type AdminAwards = {
  ai: boolean // 서버에 Claude 키가 있는지
  people: number
  players: { id: number; name: string; newcomer: boolean; given: number }[]
  cards: (AwardCardRow & { name: string })[]
}
export type TreasureState = {
  active: boolean
  rescue: boolean
  total: number // 진짜 선물 수
  found: { spot: string; name: string; at: string; tier: Tier }[] // 이미 누가 가져간 진짜 (누가 몇 등인지 공개)
  mine: { spot: string; tier: Tier } | null
  duds: string[] // 내가 열어 본 꽝
  glow: string[] // 구제 기간: 남은 진짜 자리
}
export type AdminTreasure = {
  phase: Phase
  spots: number
  duds: number
  boxes: { id: string; place: string; tier: Tier; gift: string; finder: string | null; at: string | null }[]
}
export type LetterStatus = 'none' | 'draft' | 'submitted'
export type Stat = { label: string; value: number }
export type Letter = {
  keywords: [string, string, string]
  first: string
  now: string
  stats: [Stat, Stat, Stat]
  genre: string
  bgm: string
  bgmReason: string
  tmi: string
  gift: string
  hint: string
}
export type LetterState = { target: string | null; body: Letter; submittedAt: string | null; updatedAt: string | null; locked?: boolean }
export type TreeMessage = { id: number; name: string; body: string; hearts: number; liked: boolean; mine: boolean }
export type TreeDay = { today: string; day: string; question: string; days: string[]; messages: TreeMessage[] }
export type TreeSummary = { today: string; question: string; total: number; todayCount: number }
export type GuessState = { people: { id: number; name: string }[]; body: Guess; updatedAt: string | null; locked?: boolean }
export type RevealCard = {
  target: { id: number; name: string }
  santa: { id: number; name: string }
  letter: Letter | null
  letterSubmitted: boolean
  guess: (Guess & { suspectName: string }) | null
  suspectIsMyTarget: boolean
  photo: string | null // 📸 산타가 마을에서 몰래 찍은 사진 (data URL)
}
export type TreeRecap = { people: number; days: { day: string; question: string; digest?: string | null; messages: { name: string; body: string; hearts: number }[] }[] }
export type Reveal = { people: { id: number; name: string }[]; cards: RevealCard[] }
export type Manito = { name: string; profile: Profile | null }
export type AdminStatus = {
  phase: Phase
  matched: boolean
  players: { id: number; name: string; hasPin: boolean; hasProfile: boolean; opened: boolean; letter: LetterStatus; guess: GuessStatus }[]
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? '요청에 실패했어요', res.status)
  return data as T
}

export type RecordRow = { rank: number; name: string; best: number; runs: number; me: boolean }
export type RecordBoard = { top: RecordRow[]; mine: RecordRow | null }
export type XpRow = { rank: number; id: number; name: string; xp: number; lv: number; cur: number; need: number; me: boolean }
export type XpBoard = { top: XpRow[]; mine: XpRow | null }

export const api = {
  records: (kind: RecordKind) => call<RecordBoard>('GET', `/records/${kind}`),
  saveRecord: (kind: RecordKind, value: number) => call<RecordBoard & { value: number; newBest: boolean }>('POST', `/records/${kind}`, { value }),
  xp: () => call<XpBoard>('GET', '/xp'),
  gainXp: (kind: XpKind) => call<XpBoard & { capped: boolean }>('POST', '/xp', { kind }),
  players: () => call<Player[]>('GET', '/players'),
  setupPin: (playerId: number, pin: string) => call('POST', '/auth/setup-pin', { playerId, pin }),
  login: (playerId: number, pin: string) => call('POST', '/auth/login', { playerId, pin }),
  guest: (name: string) => call('POST', '/auth/guest', { name }),
  logout: () => call('POST', '/auth/logout'),
  me: () => call<Me>('GET', '/me'),
  saveProfile: (p: Profile) => call('PUT', '/me/profile', p),
  manito: () => call<Manito>('GET', '/me/manito'),
  openManito: () => call('POST', '/me/manito/open'),
  saveLook: (look: Look) => call<Look>('PUT', '/me/look', look),
  arenaToday: () => call<{ top: { rank: number; name: string; kos: number; me: boolean }[] }>('GET', '/arena/today'),
  rocket: () => call<{ wishes: number }>('GET', '/me/rocket'),
  rocketWish: () => call<{ wishes: number }>('POST', '/me/rocket'),
  photo: () => call<{ image: string | null; takenAt: string | null }>('GET', '/me/photo'),
  savePhoto: (image: string) => call<{ ok: true }>('PUT', '/me/photo', { image }),
  checkMission: (id: MissionId, done: boolean) => call<{ ok: true }>('PUT', `/me/missions/${id}`, { done }),
  treeSummary: () => call<TreeSummary>('GET', '/tree/summary'),
  treeDigest: (day: string) => call<{ digest: { summary: string; keywords: string[] } | null; pending: boolean }>('GET', `/tree/digest?day=${day}`),
  tree: (day?: string) => call<TreeDay>('GET', `/tree${day ? `?day=${day}` : ''}`),
  postTree: (body: string) => call('PUT', '/tree/today', { body }),
  heart: (id: number) => call<{ liked: boolean }>('POST', `/tree/${id}/heart`),
  awards: () => call<Awards>('GET', '/awards'),
  giveKeywords: (receiverId: number, gift: Gift) => call<{ gift: Gift }>('PUT', '/awards/keywords', { receiverId, ...gift }),
  interview: (receiverId: number, chat: QA[], finish = false) =>
    call<{ done: false; question: string } | { done: true; gift: Gift; chat: QA[] }>('POST', '/awards/interview', { receiverId, chat, finish }),
  adminAwards: () => call<AdminAwards>('GET', '/admin/awards'),
  setNewcomer: (id: number, newcomer: boolean) => call<{ id: number; newcomer: boolean }>('PUT', `/admin/players/${id}/newcomer`, { newcomer }),
  aiCards: (missing: boolean) => call<{ made: number; failed: number; empty: number }>('POST', '/admin/awards/ai-cards', { missing }),
  saveCard: (id: number, title: string, citation: string) => call<AwardCardRow>('PUT', `/admin/awards/cards/${id}`, { title, citation }),
  treasure: () => call<TreasureState>('GET', '/treasure'),
  openTreasure: (spot: string) =>
    call<{ kind: 'gift'; spot: string; tier: Tier } | { kind: 'dud'; spot: string; line: string }>('POST', `/treasure/${spot}/open`),
  adminTreasure: () => call<AdminTreasure>('GET', '/admin/treasure'),
  letter: () => call<LetterState>('GET', '/me/letter'),
  saveLetter: (body: Letter, submit = false) => call<LetterState>('PUT', '/me/letter', { body, submit }),
  guess: () => call<GuessState>('GET', '/me/guess'),
  saveGuess: (body: Guess) => call<GuessState>('PUT', '/me/guess', body),
  adminReveal: () => call<Reveal>('GET', '/admin/reveal'),
  adminTreeRecap: () => call<TreeRecap>('GET', '/admin/tree-recap'),
  adminStatus: () => call<AdminStatus>('GET', '/admin/status'),
  setPhase: (to: Phase) => call<{ phase: Phase }>('POST', '/admin/phase', { to }),
  questions: () => call<{ list: string[]; start: string; today: string }>('GET', '/admin/questions'),
  saveQuestions: (questions: string[], start: string) => call<{ list: string[]; start: string }>('PUT', '/admin/questions', { questions, start }),
  resetAll: (confirm: string) => call('POST', '/admin/reset-all', { confirm }),
  resetPin: (playerId: number) => call('POST', '/admin/reset-pin', { playerId }),
}
