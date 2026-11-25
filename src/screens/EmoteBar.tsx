import { useEffect, useState } from 'react'
import { Smiley, X } from '@phosphor-icons/react'
import { EMOTES, emotes } from '../scene/emote'

// 😊 반응: 왼쪽 아래 동그란 버튼 하나. 누르면 옆으로 반응들이 펼쳐진다 (숫자 1~8 키는 언제나 바로 보낸다)
// + 누가 나에게 보낸 반응 알림 (잠깐 떴다 사라짐)
export function EmoteBar({ show }: { show: boolean }) {
  const [ping, setPing] = useState<{ text: string; n: number } | null>(null)
  const [open, setOpen] = useState(false)
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
        <>
          <button className={`emote-fab ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} title="반응 보내기 (숫자 1~8)">
            {open ? <X size={24} weight="bold" /> : <Smiley size={34} weight="fill" />}
            <small>반응</small>
          </button>
          {open && (
            <div className="emote-fan" aria-label="반응 보내기">
              {EMOTES.map((e, i) => (
                <button key={e.id} title={`${i + 1} · ${e.label}`} onClick={() => emotes.fire?.(e.id)}>
                  {e.icon}
                  <kbd>{i + 1}</kbd>
                </button>
              ))}
              <span className="emote-hint">가까운 동료에게 보내져요</span>
            </div>
          )}
        </>
      )}
    </>
  )
}
