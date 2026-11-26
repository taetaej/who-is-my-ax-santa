import { useEffect, useState, type FormEvent } from 'react'
import { api, type Player } from '../api'
import { forgetLastPlayer, lastPlayer, markEntered, markGuestEntered } from '../entry'

// G2 로그인 + G3 PIN 최초 설정
// 입장할 때마다 PIN 을 묻는다. 지난번 이름은 기억해 두고 PIN 만 받는다.
export function Login({ onDone }: { onDone: () => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [id, setId] = useState<number | null>(lastPlayer)
  const [choosing, setChoosing] = useState(false) // 이름 목록 펼치기
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [guest, setGuest] = useState<string | null>(null) // 👀 게스트 별명 입력 중 (null = 닫힘)

  useEffect(() => {
    api.players().then(setPlayers, (e: Error) => setError(e.message))
  }, [])

  const picked = players.find((p) => p.id === id)
  const remembered = !!picked && !choosing && picked.id === lastPlayer()
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
      markEntered(picked.id)
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setPin('')
      setPin2('')
    } finally {
      setBusy(false)
    }
  }

  const enterGuest = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.guest(guest ?? '')
      markGuestEntered()
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (guest !== null)
    return (
      <form className="panel login" onSubmit={enterGuest}>
        <h2>게스트로 구경하기</h2>
        <p className="muted">산타 게임엔 참여하지 않고, 마을 구경과 눈싸움만 할 수 있어요. 마을에서 보일 별명을 정해요.</p>
        <input autoFocus className="guest-nick" maxLength={8} placeholder="별명 (8자까지)" value={guest} onChange={(e) => setGuest(e.target.value)} />
        <button className="primary" disabled={busy || !guest.trim()}>
          구경하러 가기
        </button>
        <button
          type="button"
          className="quiet guest-link"
          onClick={() => {
            setGuest(null)
            setError('')
          }}
        >
          ← 참가자로 들어가기
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    )

  return (
    <form className="panel login" onSubmit={submit}>
      <h2>마을에 들어가기</h2>
      {remembered ? (
        <div className="welcome-back">
          <p>
            <b>{picked.name}</b>님, 다시 오셨네요! PIN 4자리를 입력해요.
          </p>
          <button
            type="button"
            className="quiet"
            onClick={() => {
              forgetLastPlayer()
              setChoosing(true)
              setId(null)
              setPin('')
              setPin2('')
              setError('')
            }}
          >
            {picked.name}님이 아니에요
          </button>
        </div>
      ) : (
        <p className="muted">내 이름을 고르고 PIN 4자리를 입력해요.</p>
      )}
      {!remembered && (
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
      )}
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
      <button
        type="button"
        className="quiet guest-link"
        onClick={() => {
          setGuest('')
          setError('')
        }}
      >
        참가자가 아니에요 · 👀 게스트로 구경하기
      </button>
    </form>
  )
}
