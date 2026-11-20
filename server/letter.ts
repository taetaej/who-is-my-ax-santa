// 마니또 소개서 (PRD 5.5). 산타가 자기 마니또를 몰래 관찰해서 쓰는 X소개서.
// 공개일에 산타 이름 없이 낭독되고, 그 전에는 쓴 사람 본인만 볼 수 있다.
//
// 카드 앞면: 해시태그 · 첫인상 vs 현인상 · 캐릭터 스탯 · 장르와 BGM · 관찰 TMI · 정체 힌트
// 카드 뒷면(정체 공개 때 뒤집힘): 산타 이름 · 준비한 선물

export type Stat = { label: string; value: number } // value: 0~100 (%)

export type Letter = {
  keywords: [string, string, string] // 1. 해시태그 3개
  first: string // 2. 처음엔 [ ]한 분인 줄 알았는데,
  now: string //    관찰해 보니 의외로 [ ]한 면이 있었습니다.
  stats: [Stat, Stat, Stat] // 3. 캐릭터 스탯
  genre: string // 4. 이 사람이 주인공인 드라마/영화 장르
  bgm: string //    테마 BGM (노래 한 곡)
  bgmReason: string //    짧은 이유 (선택)
  tmi: string // 5. 몰래 관찰해 보니 [ ] 모습이 눈에 띄더라고요.
  gift: string //    준비한 선물 (뒷면)
  hint: string // 6. 산타의 정체 힌트 한 줄
}

export const LIMITS = { keyword: 20, first: 40, now: 40, statLabel: 20, genre: 40, bgm: 80, bgmReason: 200, tmi: 120, gift: 60, hint: 120 }

const EMPTY_STAT: Stat = { label: '', value: 50 }
export const EMPTY_LETTER: Letter = {
  keywords: ['', '', ''],
  first: '',
  now: '',
  stats: [EMPTY_STAT, EMPTY_STAT, EMPTY_STAT],
  genre: '',
  bgm: '',
  bgmReason: '',
  tmi: '',
  gift: '',
  hint: '',
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : 50)

/** 받은 값을 정해진 칸과 길이로만 정리한다 (임의 데이터가 저장되지 않게) */
export function cleanLetter(input: unknown): Letter {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const kws = Array.isArray(o.keywords) ? o.keywords : []
  const stats = Array.isArray(o.stats) ? o.stats : []
  return {
    keywords: [0, 1, 2].map((i) => str(kws[i], LIMITS.keyword + 3).replace(/^#+\s*/, '').slice(0, LIMITS.keyword)) as Letter['keywords'],
    first: str(o.first, LIMITS.first),
    now: str(o.now, LIMITS.now),
    stats: [0, 1, 2].map((i) => {
      const s = (stats[i] && typeof stats[i] === 'object' ? stats[i] : {}) as Record<string, unknown>
      return { label: str(s.label, LIMITS.statLabel), value: pct(s.value) }
    }) as Letter['stats'],
    genre: str(o.genre, LIMITS.genre),
    bgm: str(o.bgm, LIMITS.bgm),
    bgmReason: str(o.bgmReason, LIMITS.bgmReason),
    tmi: str(o.tmi, LIMITS.tmi),
    gift: str(o.gift, LIMITS.gift),
    hint: str(o.hint, LIMITS.hint),
  }
}

/** 제출하려면 채워야 하는데 비어 있는 문항 이름 (BGM 이유는 선택) */
export function missing(l: Letter): string[] {
  const out: string[] = []
  if (l.keywords.some((k) => !k)) out.push('해시태그 3개')
  if (!l.first || !l.now) out.push('첫인상 vs 현인상')
  if (l.stats.some((s) => !s.label)) out.push('캐릭터 스탯')
  if (!l.genre || !l.bgm) out.push('장르와 BGM')
  if (!l.tmi || !l.gift) out.push('관찰 TMI와 선물')
  if (!l.hint) out.push('정체 힌트')
  return out
}
