// ✏️ 내 프로필 (나를 챙길 산타만 본다). 항목은 여기 한 곳에서 정하고 입력 화면·마니또 카드·서버가 같이 쓴다.
// 예전 항목 'style'(평소 스타일 키워드)은 '요즘 꽂힌 것'(crush)으로 이어 보여 준다.

export const PROFILE_FIELDS = [
  { key: 'mbti', emoji: '🧬', label: 'MBTI', placeholder: '예: ENFP (몰라도 OK, 대충 I/E만 적어도 돼요)', max: 30 },
  { key: 'seat', emoji: '📍', label: '내 자리', placeholder: '예: 창가 쪽 세 번째 자리', max: 100 },
  { key: 'snack', emoji: '🥤', label: '최애 음료·간식 (편의점 픽)', placeholder: '예: 제로콜라, 꼬북칩 초코맛', max: 100 },
  { key: 'crush', emoji: '💘', label: '요즘 꽂힌 것', placeholder: '예: 러닝, 먼작귀, 흑백요리사, 아이돌 ○○', max: 100 },
  { key: 'happy', emoji: '🍀', label: '나의 소확행', placeholder: '예: 퇴근길 붕어빵, 새 펜 개시하는 날, 귀여운 스티커', max: 100 },
  { key: 'avoid', emoji: '🙅', label: '이건 패스!', placeholder: '예: 향 센 것, 견과류 알레르기, 부피 큰 것', max: 100 },
] as const

export type ProfileKey = (typeof PROFILE_FIELDS)[number]['key']
export type Profile = Record<ProfileKey, string>

export const emptyProfile = (): Profile => Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, ''])) as Profile

/** 저장된 프로필(예전 모양 포함)을 지금 항목으로 맞춘다 */
export function readProfile(raw: unknown): Profile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const s = (v: unknown) => (typeof v === 'string' ? v : '')
  const p = emptyProfile()
  for (const f of PROFILE_FIELDS) p[f.key] = s(r[f.key]).slice(0, f.max)
  if (!p.crush && s(r.style)) p.crush = s(r.style).slice(0, 100)
  return p
}

export const isEmptyProfile = (p: Profile) => PROFILE_FIELDS.every((f) => !p[f.key].trim())
