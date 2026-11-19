import { useState, type FormEvent } from 'react'
import { api, type Me, type Profile } from '../api'

const FIELDS: { key: keyof Profile; label: string; placeholder: string }[] = [
  { key: 'seat', label: '좌석 위치', placeholder: '예: 창가 쪽 세 번째 자리' },
  { key: 'snack', label: '좋아하는 음료·간식', placeholder: '예: 아이스 아메리카노, 젤리' },
  { key: 'style', label: '평소 스타일 키워드', placeholder: '예: 미니멀, 고양이, 캠핑' },
  { key: 'avoid', label: '알레르기·피하고 싶은 것', placeholder: '예: 견과류, 향 강한 것' },
]

// P0-1 내 프로필 작성. 이 내용은 나를 챙길 산타에게 보인다.
export function ProfileForm({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const [p, setP] = useState<Profile>(me.profile ?? { seat: '', snack: '', style: '', avoid: '' })
  const [error, setError] = useState('')
  const locked = me.phase === 'REVEAL'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.saveProfile(p)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>내 프로필</h2>
      <p className="muted">나를 챙겨 줄 산타만 이 내용을 볼 수 있어요.</p>
      {FIELDS.map((f) => (
        <label key={f.key} className="field">
          <span>{f.label}</span>
          <input
            value={p[f.key]}
            maxLength={200}
            placeholder={f.placeholder}
            disabled={locked}
            onChange={(e) => setP({ ...p, [f.key]: e.target.value })}
          />
        </label>
      ))}
      {!locked && <button className="primary">저장</button>}
      {error && <p className="error">{error}</p>}
    </form>
  )
}
