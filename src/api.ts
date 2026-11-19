import type { Look } from './look'

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
  todo: { tree: boolean; votes: number; awards: number }
}
export type Awards = {
  phase: Phase
  categories: { name: string; myVote: number | null }[]
  players: { id: number; name: string }[]
  results: { category: string; winners: number[]; votes: number }[] | null
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
  vote: (category: string, nomineeId: number | null) => call('PUT', '/awards/vote', { category, nomineeId }),
  adminAwards: () => call<{ categories: string[]; done: number; started: number }>('GET', '/admin/awards'),
  saveAwards: (categories: string[]) => call<{ categories: string[] }>('PUT', '/admin/awards', { categories }),
  letter: () => call<LetterState>('GET', '/me/letter'),
  saveLetter: (body: Letter, submit = false) => call<LetterState>('PUT', '/me/letter', { body, submit }),
  adminStatus: () => call<AdminStatus>('GET', '/admin/status'),
  setPhase: (to: Phase) => call<{ phase: Phase }>('POST', '/admin/phase', { to }),
  questions: () => call<{ list: string[]; start: string; today: string }>('GET', '/admin/questions'),
  saveQuestions: (questions: string[], start: string) => call<{ list: string[]; start: string }>('PUT', '/admin/questions', { questions, start }),
  resetAll: (confirm: string) => call('POST', '/admin/reset-all', { confirm }),
  resetPin: (playerId: number) => call('POST', '/admin/reset-pin', { playerId }),
}
