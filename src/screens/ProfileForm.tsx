import { useState, type FormEvent } from 'react'
import { api, type Me } from '../api'
import { PROFILE_FIELDS, emptyProfile, type Profile } from '../profile'

// P0-1 내 프로필 작성. 이 내용은 나를 챙길 산타에게 보인다.
export function ProfileForm({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const [p, setP] = useState<Profile>(me.profile ?? emptyProfile())
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
      <p className="muted">나를 챙겨 줄 산타만 볼 수 있어요. 아는 만큼만, 편하게 적어 주세요 ✌️</p>
      {PROFILE_FIELDS.map((f) => (
        <label key={f.key} className="field">
          <span>
            {f.emoji} {f.label}
          </span>
          <input
            value={p[f.key]}
            maxLength={f.max}
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
