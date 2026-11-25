import type { Icon } from '@phosphor-icons/react'

// 🎄 트리 오너먼트 공 위 아이콘 (금색 고리). 메뉴·상태창 아이콘은 이모지 대신 전부 이걸 쓴다 (Phosphor 한 벌)
export type OrnColor = 'red' | 'green' | 'gold' | 'blue' | 'snow'

export function Orn({ icon: I, color, size = 17 }: { icon: Icon; color: OrnColor; size?: number }) {
  return (
    <span className={`orn ${color}`} aria-hidden>
      <I size={size} weight={color === 'snow' ? 'bold' : 'fill'} />
    </span>
  )
}
