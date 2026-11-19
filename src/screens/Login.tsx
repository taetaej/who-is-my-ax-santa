import { useEffect, useState, type FormEvent } from 'react'
import { api, type Player } from '../api'

// G2 로그인 + G3 PIN 최초 설정
export function Login({ onDone }: { onDone: () => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [id, setId] = useState<number | null>(null)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.players().then(setPlayers, (e: Error) => setError(e.message))
  }, [])

  const picked = players.find((p) => p.id === id)
  const firstTime = picked && !picked.hasPin

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!picked) return
    setError('')
    if (!/^\d{4}$/.test(pin)) return setError('PIN 은 숫자 4자리예요')
    if (firstTime && pin !== pin2) return setError('두 PIN 이 서로 달라요')
    setBusy(true)
    try {
      await (firstTime ? api.setupPin(picked.id, pin) : api.login(picked.id, pin))
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setPin('')
      setPin2('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel login" onSubmit={submit}>
      <h2>마을에 들어가기</h2>
      <p className="muted">내 이름을 고르고 PIN 4자리를 입력해요.</p>
      <div className="names">
        {players.map((p) => (
          <button
            type="button"
            key={p.id}
            className={p.id === id ? 'name on' : 'name'}
            onClick={() => {
              setId(p.id)
              setPin('')
              setPin2('')
              setError('')
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      {picked && (
        <>
          {firstTime && <p className="hint">처음 오셨네요! 앞으로 쓸 PIN 을 정해 주세요.</p>}
          <input
            autoFocus
            className="pin"
            inputMode="numeric"
            maxLength={4}
            type="password"
            placeholder="PIN 4자리"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
          {firstTime && (
            <input
              className="pin"
              inputMode="numeric"
              maxLength={4}
              type="password"
              placeholder="한 번 더"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
            />
          )}
          <button className="primary" disabled={busy}>
            {firstTime ? 'PIN 정하고 입장' : '입장'}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  )
}
