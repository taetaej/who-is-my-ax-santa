import { ARENA } from './world'

// ⚔️ 눈싸움장 아이템. 장 안 네 군데 받침대에 번갈아 나타난다.
// 언제 무엇이 나오는지는 벽시계로만 정해져서 모두의 화면이 같다. 누가 먹으면 {k:'pick'} 을 방송해 모두의 화면에서 사라진다.
//   💥 왕눈덩이: 다음 3번은 두 배로 아프고 크다     🛡️ 방패: 8초 동안 안 맞는다
//   ⚡ 연사: 8초 동안 눈덩이가 줄지 않고 쉬지 않고 던진다   🍪 회복 쿠키: 체력 +60

export type PowerKind = 'big' | 'shield' | 'rapid' | 'heal'
export const POWER_KINDS: readonly PowerKind[] = ['big', 'shield', 'rapid', 'heal']
export const POWER_INFO: Record<PowerKind, { icon: string; name: string; line: string; color: string }> = {
  big: { icon: '💥', name: '왕눈덩이', line: '다음 3번은 두 배로 아파요!', color: '#6fb6ff' },
  shield: { icon: '🛡️', name: '방패', line: '8초 동안 안 맞아요!', color: '#f4c14e' },
  rapid: { icon: '⚡', name: '연사', line: '8초 동안 무한 연사!', color: '#ff6a5a' },
  heal: { icon: '🍪', name: '회복 쿠키', line: '체력 +60', color: '#5fd18a' },
}

export const POWER_CYCLE = 18 // 받침대 하나가 새 아이템을 내놓는 간격 (초)
const RESPAWN = 2.5 // 새 주기가 시작되고 이만큼 지나야 나타난다 (뿅 하고 등장)
export const PICK_R = 0.85
export const BUFF_SECS = 8
export const BIG_SHOTS = 3
export const HEAL_HP = 60

/** 받침대 넷: 요새 사이 (가운데에서 조금 떨어진 곳) */
export const PADS = [0, 1, 2, 3].map((i) => {
  const a = (i / 4) * Math.PI * 2
  return { x: ARENA.x + Math.cos(a) * 4.3, z: ARENA.z + Math.sin(a) * 4.3 }
})

const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/** 누가 먹은 아이템 (받침대:주기). 내 것 + 방송으로 받은 것 */
const picked = new Set<string>()
export const pickKey = (pad: number, cycle: number) => `${pad}:${cycle}`
export function markPicked(pad: number, cycle: number) {
  picked.add(pickKey(pad, cycle))
  if (picked.size > 200) picked.delete(picked.values().next().value as string)
}

/** 지금 이 받침대에 무엇이 있는지 (now = 초, 벽시계) */
export function padState(pad: number, now: number) {
  const t = now + pad * (POWER_CYCLE / PADS.length)
  const cycle = Math.floor(t / POWER_CYCLE)
  const into = t - cycle * POWER_CYCLE
  const kind = POWER_KINDS[hash(pad + 1, cycle) % POWER_KINDS.length]
  const visible = into >= RESPAWN && !picked.has(pickKey(pad, cycle))
  return { cycle, kind, visible, into }
}

/** 지금 쓰고 있는 아이템 효과 (내 화면에서만) */
export const buff = {
  kind: null as PowerKind | null,
  until: 0, // 초 (벽시계)
  shots: 0, // 💥 남은 왕눈덩이
}
export const nowSec = () => Date.now() / 1000
export const buffOn = (kind: PowerKind, now = nowSec()) =>
  buff.kind === kind && (kind === 'big' ? buff.shots > 0 && now < buff.until : now < buff.until)
