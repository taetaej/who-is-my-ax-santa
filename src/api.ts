import type { AwardCard, Gift } from './awards'
import type { Look } from './look'
import type { Tier } from './treasure'

export type Phase = 'READY' | 'ACTIVE' | 'REVEAL'
export type Player = { id: number; name: string; hasPin: boolean }
export type Profile = { seat: string; snack: string; style: string; avoid: string }
export type Me = {
  id: number
  name: string
  isAdmin: boolean
  phase: Phase
  manitoOpened: boolean
  profile: Profile | null
  liveRoom: string | null
  letter: LetterStatus
  look: Look | null
  todo: {
    tree: boolean
    given: number // 키워드를 준 동료 수
    people: number // 나를 뺀 인원
    gift: { found: boolean; left: number; hint: string | null } | null // 🎁 보물찾기 (마니또 시작 전엔 null)
  }
}
export type Awards = {
  phase: Phase
  people: { id: number; name: string; gift: Gift }[] // 나를 뺀 동료와 내가 준 키워드
  results: ({ id: number; name: string } & AwardCard)[] | null // 공개일에만
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
export type Manito = { name: string; profile: Profile | null }
export type AdminStatus = {
  phase: Phase
  matched: boolean
  players: { id: number; name: string; hasPin: boolean; hasProfile: boolean; opened: boolean; letter: LetterStatus }[]
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

export const api = {
  players: () => call<Player[]>('GET', '/players'),
  setupPin: (playerId: number, pin: string) => call('POST', '/auth/setup-pin', { playerId, pin }),
  login: (playerId: number, pin: string) => call('POST', '/auth/login', { playerId, pin }),
  logout: () => call('POST', '/auth/logout'),
  me: () => call<Me>('GET', '/me'),
  saveProfile: (p: Profile) => call('PUT', '/me/profile', p),
  manito: () => call<Manito>('GET', '/me/manito'),
  openManito: () => call('POST', '/me/manito/open'),
  saveLook: (look: Look) => call<Look>('PUT', '/me/look', look),
  treeSummary: () => call<TreeSummary>('GET', '/tree/summary'),
  tree: (day?: string) => call<TreeDay>('GET', `/tree${day ? `?day=${day}` : ''}`),
  postTree: (body: string) => call('PUT', '/tree/today', { body }),
  heart: (id: number) => call<{ liked: boolean }>('POST', `/tree/${id}/heart`),
  awards: () => call<Awards>('GET', '/awards'),
  giveKeywords: (receiverId: number, gift: Gift) => call<{ gift: Gift }>('PUT', '/awards/keywords', { receiverId, ...gift }),
  adminAwards: () => call<{ people: number; players: { name: string; given: number }[] }>('GET', '/admin/awards'),
  treasure: () => call<TreasureState>('GET', '/treasure'),
  openTreasure: (spot: string) =>
    call<{ kind: 'gift'; spot: string; tier: Tier } | { kind: 'dud'; spot: string; line: string }>('POST', `/treasure/${spot}/open`),
  adminTreasure: () => call<AdminTreasure>('GET', '/admin/treasure'),
  letter: () => call<LetterState>('GET', '/me/letter'),
  saveLetter: (body: Letter, submit = false) => call<LetterState>('PUT', '/me/letter', { body, submit }),
  adminStatus: () => call<AdminStatus>('GET', '/admin/status'),
  setPhase: (to: Phase) => call<{ phase: Phase }>('POST', '/admin/phase', { to }),
  questions: () => call<{ list: string[]; start: string; today: string }>('GET', '/admin/questions'),
  saveQuestions: (questions: string[], start: string) => call<{ list: string[]; start: string }>('PUT', '/admin/questions', { questions, start }),
  resetAll: (confirm: string) => call('POST', '/admin/reset-all', { confirm }),
  resetPin: (playerId: number) => call('POST', '/admin/reset-pin', { playerId }),
}
