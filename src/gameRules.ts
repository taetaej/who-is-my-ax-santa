// 🎮 마을 놀이 규칙 (숫자만). 화면과 서버가 같이 쓴다.
// 서버는 다른 파일을 가져오지 않는 파일만 쓸 수 있어서 (Vercel Node ESM) 이 파일은 아무것도 import 하지 않는다.

// ── 기록 ──────────────────────────────────────────────────────
export type RecordKind = 'sled' | 'roll'
export const RECORD_KINDS: readonly RecordKind[] = ['sled', 'roll']
/** 기록 최댓값: 이보다 크면 서버가 거른다. 썰매 = m (산 길이와 같다, sled.test.ts 가 확인), 눈굴리기 = 눈덩이 지름 cm */
export const RECORD_MAX: Record<RecordKind, number> = { sled: 27, roll: 400 }

// ── ⚔️ 눈싸움 체력 ─────────────────────────────────────────────
export const HP_MAX = 100
export const AMMO_MAX = 6 // 손에 쥘 수 있는 눈덩이
export const AMMO_REFILL = 1.0 // 눈밭·눈싸움장 안에서 이 초마다 하나씩 다시 뭉친다
export const CHARGE_SECS = 0.9 // F 를 이만큼 누르면 최대로 모인다
/** 맞았을 때 깎이는 체력: 톡 던지면 15, 꽉 모으면 40 */
/** 눈덩이 피해: 톡 던지면 25, 꾹 모으면 55 (2~4방이면 기절). 💥 왕눈덩이는 두 배 */
export const damageOf = (power: number, big = false) => Math.round((25 + 30 * Math.max(0, Math.min(1, power))) * (big ? 2 : 1))
export const REGEN_AFTER = 6 // 안 맞고 이만큼 지나면 체력이 차기 시작
export const REGEN_PER_SEC = 5
export const KO_WINDOW_MIN = 10 // 이 시간 안에 또 기절하면 더 오래 누워 있다
/** 기절 시간: 처음 15초, 10분 안에 또 기절하면 1분 */
/** 기절 시간: 처음 6초, 10분 안에 또 기절하면 15초 (짧게 쓰러졌다 바로 다시 싸운다) */
export const koSecs = (recentKos: number) => (recentKos <= 1 ? 6 : 15)
export const REVIVE_TAPS = 3 // 쓰러진 동료 옆에서 E 를 이만큼 누르면 깨운다
export const REVIVE_HP = 50
export const SAFE_SECS = 3 // 일어난 뒤 잠깐은 안 맞는다

// ── ⭐ XP · 레벨 ──────────────────────────────────────────────
// 놀이로 얻는 XP (하루 상한이 있다) + 이벤트 참여로 저절로 쌓이는 XP (서버가 계산)
export type XpKind = 'hit' | 'ko' | 'revive' | 'sled' | 'roll' | 'best'
export const XP_KINDS: readonly XpKind[] = ['hit', 'ko', 'revive', 'sled', 'roll', 'best']
export const XP_GAIN: Record<XpKind, number> = { hit: 4, ko: 20, revive: 15, sled: 10, roll: 10, best: 25 }
export const XP_DAILY_CAP: Record<XpKind, number> = { hit: 120, ko: 240, revive: 90, sled: 120, roll: 120, best: 100 }
export const XP_LABEL: Record<XpKind, string> = { hit: '명중', ko: 'KO', revive: '구조', sled: '썰매', roll: '눈굴리기', best: '신기록' }
/** 이벤트 참여 XP: 관찰 리포트 제출, 추리노트, 메시지 트리 (하루 한 장), 어워즈 키워드, 숨은 선물, 마니또 확인, 산타 미션 (하나에), 자기소개 */
export const XP_EVENT = { letter: 150, guess: 80, treeDay: 20, keyword: 10, treasure: 120, manito: 30, mission: 40, profile: 30 } as const

/** 레벨 n 에서 n+1 로 가는 데 필요한 XP: 60, 90, 120, … (점점 늘어난다) */
export const xpToNext = (lv: number) => 30 + lv * 30
/** 총 XP → 레벨, 지금 레벨에서 모은 XP, 다음 레벨까지 필요한 XP */
export function levelOf(xp: number): { lv: number; cur: number; need: number } {
  let lv = 1
  let left = Math.max(0, Math.floor(xp))
  while (left >= xpToNext(lv)) {
    left -= xpToNext(lv)
    lv++
  }
  return { lv, cur: left, need: xpToNext(lv) }
}
