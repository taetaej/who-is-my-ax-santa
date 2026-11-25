import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { api } from '../api'
import { CHEEKS, COLORED_HATS, COLORS, DECOS, DOUGHS, EXTRAS, EYES, HATS, MOUTHS, OUTFITS, defaultLook, randomLook, unlockLevel, type LockKind, type Look } from '../look'
import { xpStore } from '../scene/game'
import { Cookie, newCookieState } from '../scene/Cookie'

// 쿠키 꾸미기. 처음 마을에 들어올 때 한 번 나오고, 아래 메뉴 🎨 로 언제든 바꿀 수 있다.

const COLOR_NAMES = ['빨강', '초록', '파랑', '노랑', '보라', '분홍', '청록', '하양', '검정']
const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[]

type Tab = 'body' | 'face' | 'head' | 'extra'
const TABS: { key: Tab; label: string }[] = [
  { key: 'body', label: '🍪 몸' },
  { key: 'face', label: '😊 얼굴' },
  { key: 'head', label: '🎩 머리' },
  { key: 'extra', label: '🎀 소품' },
]

/** 얼굴 탭에서는 얼굴로 다가가고, 나머지는 전신. 부드럽게 옮긴다 */
const SHOTS: Record<'full' | 'face', { pos: THREE.Vector3; aim: THREE.Vector3 }> = {
  full: { pos: new THREE.Vector3(0, 0.75, 2.9), aim: new THREE.Vector3(0, 0.55, 0) },
  face: { pos: new THREE.Vector3(0, 0.82, 1.45), aim: new THREE.Vector3(0, 0.74, 0) },
}
function Rig({ shot }: { shot: 'full' | 'face' }) {
  const aim = useRef(SHOTS.full.aim.clone())
  useFrame(({ camera }, dt) => {
    const k = Math.min(1, dt * 6)
    camera.position.lerp(SHOTS[shot].pos, k)
    aim.current.lerp(SHOTS[shot].aim, k)
    camera.lookAt(aim.current)
  })
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
  const [tab, setTab] = useState<Tab>('body')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<Look>) => setLook((l) => ({ ...l, ...patch }))
  const hatColored = COLORED_HATS.includes(look.hat)
  // 🔓 내 레벨 (오른쪽 위 XP 와 같은 값). XP 를 늦게 불러오면 그때 다시 그린다
  const [lv, setLv] = useState(xpStore.board?.mine?.lv ?? 1)
  useEffect(() => {
    const on = (b: typeof xpStore.board) => setLv(b?.mine?.lv ?? 1)
    xpStore.listeners.add(on)
    return () => void xpStore.listeners.delete(on)
  }, [])
  // 개발 중 확인용: localStorage 'santa-unlock-all' 이면 전부 열기 (배포 빌드에는 없음)
  const level = import.meta.env.DEV && localStorage.getItem('santa-unlock-all') ? 99 : lv
  const random = () => setLook(randomLook(Math.random, level))

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
      <h2>{first ? `${name} 님, 어서 오세요!` : '내 쿠키 꾸미기'}</h2>
      <p className="muted">{first ? '마을에 들어가기 전에 내 쿠키를 꾸며 주세요. 나중에 언제든 바꿀 수 있어요.' : '바꾼 모습은 다른 사람들에게도 바로 보여요.'}</p>

      <div className="look-body">
        <div className="look-stage">
          <Canvas camera={{ position: [0, 0.75, 2.9], fov: 30 }} dpr={[1, 2]}>
            <Rig shot={tab === 'face' ? 'face' : 'full'} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[2, 3, 3]} intensity={1.8} />
            <pointLight position={[-2, 1, 1]} intensity={6} color="#ffb070" />
            <Turntable look={look} seed={seed} />
          </Canvas>
          <div className="look-name">{name}</div>
        </div>

        <div className="look-options">
          <div className="look-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'body' && (
            <>
              <h3>반죽</h3>
              <div className="chips">
                {keys(DOUGHS).map((k) => {
                  const need = unlockLevel('dough', k)
                  const locked = need > level
                  return (
                    <button key={k} className={`chip-btn ${look.dough === k ? 'on' : ''} ${locked ? 'locked' : ''}`} disabled={locked} onClick={() => set({ dough: k })} title={locked ? `Lv.${need} 에 열려요` : undefined}>
                      <i className="dot" style={{ background: DOUGHS[k].color }} />
                      {DOUGHS[k].label}
                      {locked && <em className="lock">🔒 Lv.{need}</em>}
                    </button>
                  )
                })}
              </div>
              <Pick title="옷" options={OUTFITS} value={look.outfit} onPick={(outfit) => set({ outfit })} lock="outfit" level={level} />
              <Pick title="배 장식" options={DECOS} value={look.deco} onPick={(deco) => set({ deco })} />
              <h3>목도리 색 (니트·패딩도 이 색)</h3>
              <Swatches value={look.scarf} onPick={(c) => set({ scarf: c })} />
            </>
          )}

          {tab === 'face' && (
            <>
              <Pick title="눈" options={EYES} value={look.eyes} onPick={(eyes) => set({ eyes })} />
              <Pick title="입" options={MOUTHS} value={look.mouth} onPick={(mouth) => set({ mouth })} />
              <Pick title="볼" options={CHEEKS} value={look.cheek} onPick={(cheek) => set({ cheek })} />
            </>
          )}

          {tab === 'head' && (
            <>
              <Pick title="머리" options={HATS} value={look.hat} onPick={(hat) => set({ hat })} lock="hat" level={level} />
              {hatColored && (
                <>
                  <h3>{HATS[look.hat].replace(/^\S+\s/, '')} 색</h3>
                  <Swatches value={look.hatColor} onPick={(c) => set({ hatColor: c })} />
                </>
              )}
            </>
          )}

          {tab === 'extra' && (
            <>
              <Pick title="소품" options={EXTRAS} value={look.extra} onPick={(extra) => set({ extra })} lock="extra" level={level} />
              {(look.extra === 'mittens' || look.extra === 'cape') && (
                <>
                  <h3>{look.extra === 'mittens' ? '장갑' : '망토'} 색 (목도리와 같은 색)</h3>
                  <Swatches value={look.scarf} onPick={(c) => set({ scarf: c })} />
                </>
              )}
            </>
          )}
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

/** 고르기 칸. lock 이 있으면 레벨이 모자란 것은 🔒 Lv.N 으로 잠가 둔다 */
function Pick<K extends string>({
  title,
  options,
  value,
  onPick,
  lock,
  level = 1,
}: {
  title: string
  options: Record<K, string>
  value: K
  onPick: (k: K) => void
  lock?: LockKind
  level?: number
}) {
  return (
    <>
      <h3>{title}</h3>
      <div className="chips">
        {keys(options).map((k) => {
          const need = lock ? unlockLevel(lock, k) : 1
          const locked = need > level
          return (
            <button key={k} className={`chip-btn ${value === k ? 'on' : ''} ${locked ? 'locked' : ''}`} disabled={locked} onClick={() => onPick(k)} title={locked ? `Lv.${need} 에 열려요` : undefined}>
              {options[k]}
              {locked && <em className="lock">🔒 Lv.{need}</em>}
            </button>
          )
        })}
      </div>
    </>
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
