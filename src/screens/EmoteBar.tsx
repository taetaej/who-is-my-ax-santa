import { useEffect, useState } from 'react'
import { EMOTES, emotes } from '../scene/emote'

// 💬 반응 버튼 (화면 오른쪽 아래) + 누가 나에게 보낸 반응 알림 (잠깐 떴다 사라짐)
export function EmoteBar({ show }: { show: boolean }) {
  const [ping, setPing] = useState<{ text: string; n: number } | null>(null)
  useEffect(() => {
    emotes.toast = (text) => setPing((p) => ({ text, n: (p?.n ?? 0) + 1 }))
    return () => {
      emotes.toast = null
    }
  }, [])
  useEffect(() => {
    if (!ping) return
    const t = setTimeout(() => setPing(null), 2600)
    return () => clearTimeout(t)
  }, [ping])
  return (
    <>
      {ping && show && (
        <div key={ping.n} className="emote-ping" role="status">
          {ping.text}
        </div>
      )}
      {show && (
        <div className="emote-bar" aria-label="반응 보내기">
          {EMOTES.map((e, i) => (
            <button key={e.id} title={`${i + 1} · ${e.label}`} onClick={() => emotes.fire?.(e.id)}>
              <span className="emote-icon">{e.icon}</span>
              <span className="emote-label">{e.label}</span>
            </button>
          ))}
          <span className="emote-hint">가까운 동료에게 보내져요</span>
        </div>
      )}
    </>
  )
}
