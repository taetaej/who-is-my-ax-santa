import { useEffect, useState } from 'react'
import { api, type Manito, type Me } from '../api'
import { PROFILE_FIELDS } from '../profile'

// H0 마을 홈 / P0-2 시작 대기 / H1·H2 마니또 개봉과 카드 (연출은 자리만 잡아 둠)
export function Home({ me, onChange, onEditProfile }: { me: Me; onChange: () => void; onEditProfile: () => void }) {
  const [manito, setManito] = useState<Manito | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (me.phase !== 'READY' && me.manitoOpened) api.manito().then(setManito, (e: Error) => setError(e.message))
  }, [me.phase, me.manitoOpened])

  if (me.phase === 'READY') {
    return (
      <div className="panel">
        <h2>곧 마을이 열려요 ❄️</h2>
        <p>운영자가 시작하면 내가 산타가 되어 몰래 챙길 사람이 정해져요.</p>
        {!me.profile && (
          <>
            <p className="hint">그 전에 내 프로필을 적어 주세요. 나를 챙길 산타에게 큰 도움이 돼요.</p>
            <button className="primary" onClick={onEditProfile}>프로필 쓰러 가기</button>
          </>
        )}
      </div>
    )
  }

  if (me.phase === 'REVEAL') {
    return (
      <div className="panel">
        <h2>공개일이에요 🎄</h2>
        <p className="muted">공개일 화면(R0~R4)은 아직 만들지 않았어요.</p>
      </div>
    )
  }

  if (!me.manitoOpened) {
    const open = async () => {
      try {
        const m = await api.manito()
        await api.openManito()
        setManito(m)
        onChange()
      } catch (e) {
        setError((e as Error).message)
      }
    }
    return (
      <div className="panel center">
        <h2>내가 챙길 사람이 정해졌어요 🎅</h2>
        <p className="muted">이번 크리스마스에 몰래 챙길 사람이에요. 주변에 보는 사람이 없는지 먼저 살펴 주세요!</p>
        <button className="primary big" onClick={open}>확인하기</button>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="panel">
      <p className="muted">🎅 나는 이분의 산타예요</p>
      <h2 className="manito">{manito?.name ?? '…'}</h2>
      {manito?.profile ? (
        <dl className="profile">
          {PROFILE_FIELDS.map((f) => (
            <div key={f.key} className="profile-row">
              <dt>
                {f.emoji} {f.label}
              </dt>
              <dd>{manito.profile![f.key] || '-'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        manito && <p className="muted">아직 프로필을 적지 않았어요. 직접 관찰해 볼까요?</p>
      )}
      <p className="hint">💌 공개일 전까지 📮 AX 우편함에서 관찰 리포트를 써 주세요!</p>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
