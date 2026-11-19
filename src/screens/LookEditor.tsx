import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { COLORS, DOUGHS, EXTRAS, HATS, defaultLook, type Look } from '../look'
import { Cookie, newCookieState } from '../scene/Cookie'

// 쿠키 꾸미기. 처음 마을에 들어올 때 한 번 나오고, 아래 메뉴 🎨 로 언제든 바꿀 수 있다.

const COLOR_NAMES = ['빨강', '초록', '파랑', '노랑', '보라', '분홍', '청록', '하양', '검정']
const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[]

/** 카메라가 쿠키 몸 가운데를 보게 */
function AimAt({ y }: { y: number }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => camera.lookAt(0, y, 0), [camera, y])
  return null
}

function Turntable({ look, seed }: { look: Look; seed: number }) {
  const state = useRef(newCookieState(0, 0, 0))
  const t0 = useRef(0)
  useFrame(({ clock }) => {
    const s = state.current
    const t = clock.elapsedTime
    s.rot = Math.sin(t * 0.7) * 0.5
    // 가끔 손 흔들기
    if (t - t0.current > 4) {
      t0.current = t
      s.waveUntil = t + 1.4
    }
  })
  return <Cookie state={state} seed={seed} look={look} />
}

export function LookEditor({ seed, name, current, first, onDone }: { seed: number; name: string; current: Look | null; first: boolean; onDone: () => void }) {
  const [look, setLook] = useState<Look>(current ?? defaultLook(seed))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<Look>) => setLook({ ...look, ...patch })
  const hatColored = look.hat === 'beanie' || look.hat === 'earmuffs'

  const random = () => {
    const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
    setLook({ dough: pick(keys(DOUGHS)), hat: pick(keys(HATS)), hatColor: pick(COLORS), scarf: pick(COLORS), extra: pick(keys(EXTRAS)) })
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await api.saveLook(look)
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="panel look">
      <h2>{first ? `🍪 ${name} 님, 어서 오세요!` : '🎨 내 쿠키 꾸미기'}</h2>
      <p className="muted">{first ? '마을에 들어가기 전에 내 쿠키를 꾸며 주세요. 나중에 언제든 바꿀 수 있어요.' : '바꾼 모습은 다른 사람들에게도 바로 보여요.'}</p>

      <div className="look-body">
        <div className="look-stage">
          <Canvas camera={{ position: [0, 0.75, 2.6], fov: 30 }} dpr={[1, 2]}>
            <AimAt y={0.5} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[2, 3, 3]} intensity={1.8} />
            <pointLight position={[-2, 1, 1]} intensity={6} color="#ffb070" />
            <group position={[0, 0, 0]}>
              <Turntable look={look} seed={seed} />
            </group>
          </Canvas>
          <div className="look-name">{name}</div>
        </div>

        <div className="look-options">
          <h3>반죽</h3>
          <div className="chips">
            {keys(DOUGHS).map((k) => (
              <button key={k} className={`chip-btn ${look.dough === k ? 'on' : ''}`} onClick={() => set({ dough: k })}>
                <i className="dot" style={{ background: DOUGHS[k].color }} />
                {DOUGHS[k].label}
              </button>
            ))}
          </div>

          <h3>머리</h3>
          <div className="chips">
            {keys(HATS).map((k) => (
              <button key={k} className={`chip-btn ${look.hat === k ? 'on' : ''}`} onClick={() => set({ hat: k })}>
                {HATS[k]}
              </button>
            ))}
          </div>
          {hatColored && (
            <>
              <h3>{look.hat === 'beanie' ? '비니 색' : '귀마개 색'}</h3>
              <Swatches value={look.hatColor} onPick={(c) => set({ hatColor: c })} />
            </>
          )}

          <h3>목도리 색</h3>
          <Swatches value={look.scarf} onPick={(c) => set({ scarf: c })} />

          <h3>소품</h3>
          <div className="chips">
            {keys(EXTRAS).map((k) => (
              <button key={k} className={`chip-btn ${look.extra === k ? 'on' : ''}`} onClick={() => set({ extra: k })}>
                {EXTRAS[k]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="letter-actions">
        <button className="ghost" onClick={random}>
          🎲 아무거나
        </button>
        <button className="primary" disabled={busy} onClick={save}>
          {first ? '이대로 마을에 들어가기 🎄' : '저장'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {COLORS.map((c, i) => (
        <button key={c} title={COLOR_NAMES[i]} aria-label={COLOR_NAMES[i]} className={`swatch ${value === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} />
      ))}
    </div>
  )
}
