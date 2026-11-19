import { randomInt } from 'node:crypto'

export type Pair = { santaId: number; targetId: number }

/**
 * 단일 순환 매칭 (PRD 4.1).
 * Fisher-Yates 로 섞은 뒤 i → i+1, 마지막 → 처음으로 잇는다.
 * 3명 이상이면 자기 자신 매칭과 1:1 맞교환이 생기지 않고, 공개 릴레이가 한 바퀴로 이어진다.
 */
export function makeCycle(ids: readonly number[], rand: (max: number) => number = randomInt): Pair[] {
  if (ids.length < 3) throw new Error('매칭에는 3명 이상이 필요해요')
  if (new Set(ids).size !== ids.length) throw new Error('중복된 참가자가 있어요')
  const order = [...ids]
  for (let i = order.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order.map((santaId, i) => ({ santaId, targetId: order[(i + 1) % order.length] }))
}
