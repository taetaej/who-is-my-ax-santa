import { Camera, CheckCircle, X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { snap } from '../scene/snap'
import { snow } from '../scene/snowball'

// 📸 보너스 미션: 마을에서 내가 챙길 사람 옆에 가서 몰래 사진 찍기.
// 찍는 동안에도 걸어 다닐 수 있다. 챙길 사람이 5m 안에 있어야 저장된다. 사진은 공개일 발표 화면(정체 공개)에서만 열린다.
// 3D 화면만 찍힌다 (이름표·말풍선·메뉴는 사진에 안 나옴).

const NEAR = 5
const MAX_W = 1024

/** 지금 3D 장면을 jpeg 로 (긴 쪽 1024px) */
function capture(): string | null {
  const src = snap.take?.()
  if (!src) return null
  const k = Math.min(1, MAX_W / src.width)
  const c = document.createElement('canvas')
  c.width = Math.round(src.width * k)
  c.height = Math.round(src.height * k)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

export function PhotoMode({ onClose, onSaved }: { onClose: () => void; onSaved: (text: string) => void }) {
  const [target, setTarget] = useState<string | null>(null)
  const [near, setNear] = useState(false)
  const [shot, setShot] = useState<string | null>(null)
  const [flash, setFlash] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.manito().then((m) => setTarget(m.name), (e: Error) => setError(e.message))
  }, [])
  // 챙길 사람이 가까이 있는지 0.4초마다
  useEffect(() => {
    if (!target) return
    const t = setInterval(() => {
      const me = snow.me?.s
      const it = [...snow.peers.values()].find((p) => p.name === target)
      setNear(!!me && !!it && Math.hypot(it.s.x - me.x, it.s.z - me.z) <= NEAR)
    }, 400)
    return () => clearInterval(t)
  }, [target])

  const dev = import.meta.env.DEV // 로컬에선 혼자서도 찍어 볼 수 있게
  const ok = near || dev
  const click = () => {
    setError('')
    if (!ok) return setError('챙길 사람이 5m 안에 있을 때 찍을 수 있어요')
    const img = capture()
    if (!img) return setError('화면을 찍지 못했어요. 다시 해 볼까요?')
    setFlash((n) => n + 1)
    setTimeout(() => setShot(img), 180)
  }
  const save = async () => {
    if (!shot) return
    setBusy(true)
    try {
      await api.savePhoto(shot)
      onSaved('📸 사진 저장! 보너스 미션 완료 +40 XP · 공개일에 같이 봐요 🤫')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {flash > 0 && <div key={flash} className="photo-flash" />}
      {!shot ? (
        <div className="photo-bar" role="dialog" aria-label="사진 모드">
          <div className="photo-info">
            <b>📸 몰래 사진 찍기</b>
            <span className={near ? 'ok' : ''}>
              {target ? (
                near ? (
                  <>
                    <CheckCircle size={15} weight="fill" /> 챙길 사람이 근처에 있어요! 지금 찰칵
                  </>
                ) : (
                  '챙길 사람 옆(5m 안)으로 가서 찍어요 · 걸어 다닐 수 있어요'
                )
              ) : (
                '불러오는 중…'
              )}
              {dev && !near && <em> (로컬 테스트: 혼자서도 찍혀요)</em>}
            </span>
            {error && <span className="photo-err">{error}</span>}
          </div>
          <button className="primary photo-shutter" onClick={click} disabled={!target}>
            <Camera size={20} weight="fill" /> 찰칵
          </button>
          <button className="ghost" onClick={onClose} aria-label="사진 모드 닫기">
            <X size={16} weight="bold" />
          </button>
        </div>
      ) : (
        <div className="backdrop" onClick={(e) => e.target === e.currentTarget && setShot(null)}>
          <div className="modal">
            <div className="panel photo-preview">
              <h2>이 사진으로 할까요?</h2>
              <img src={shot} alt="마을에서 찍은 사진" />
              <p className="muted small">공개일 발표 화면에서 정체를 공개할 때 이 사진이 같이 나와요. 다시 찍으면 바뀌어요.</p>
              {error && <p className="error">{error}</p>}
              <div className="letter-actions">
                <button className="ghost" onClick={() => setShot(null)} disabled={busy}>
                  다시 찍기
                </button>
                <button className="primary" onClick={save} disabled={busy}>
                  {busy ? '저장 중…' : '이 사진으로 저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
