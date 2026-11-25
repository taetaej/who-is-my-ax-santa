import { Eye, EyeSlash } from '@phosphor-icons/react'
import { useState } from 'react'

// 🤫 챙길 사람 이름 가리기: 자리가 다 가까워서, 화면에 이름이 크게 떠 있으면 옆자리에서 다 보인다.
// 평소엔 ●●● 로 가리고, 👁 버튼을 꾹 누르고 있는 동안만 보여 준다 (손을 떼면 다시 가려짐).

export const mask = (name: string) => '●'.repeat(Math.max(2, Math.min(4, [...name].length)))

/** 꾹 누르는 동안만 true */
export function usePeek() {
  const [peek, setPeek] = useState(false)
  const on = () => setPeek(true)
  const off = () => setPeek(false)
  const bind = {
    onPointerDown: on,
    onPointerUp: off,
    onPointerLeave: off,
    onPointerCancel: off,
    onKeyDown: (e: React.KeyboardEvent) => (e.key === ' ' || e.key === 'Enter') && on(),
    onKeyUp: off,
    onBlur: off,
  }
  return { peek, bind }
}

export function PeekButton({ bind, peek }: ReturnType<typeof usePeek>) {
  return (
    <button type="button" className={`peek ${peek ? 'on' : ''}`} {...bind} title="꾹 누르고 있는 동안만 이름이 보여요">
      {peek ? <EyeSlash size={15} weight="fill" /> : <Eye size={15} weight="fill" />}
      {peek ? '손 떼면 가려져요' : '꾹 눌러 이름 보기'}
    </button>
  )
}

/** 가려진 이름 + 보기 버튼 한 묶음 */
export function SecretName({ name, className = '' }: { name: string; className?: string }) {
  const p = usePeek()
  return (
    <span className={`secret-name ${className}`}>
      <span className="secret">{p.peek ? name : mask(name)}</span>
      <PeekButton {...p} />
    </span>
  )
}
