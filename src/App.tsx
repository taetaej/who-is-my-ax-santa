import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, type Me, type TreasureState, type TreeSummary } from './api'
import { SPOTS, TIERS, tierOf, type Tier } from './treasure'
import type { Burst } from './scene/GiftBoxes'
import { Village } from './scene/Village'
import { LiveRoot } from './scene/live'
import { Admin } from './screens/Admin'
import { Home } from './screens/Home'
import { LetterForm } from './screens/LetterForm'
import { GuessForm } from './screens/GuessForm'
import { LookEditor } from './screens/LookEditor'
import { MessageTree } from './screens/MessageTree'
import { AwardsPanel } from './screens/AwardsPanel'
import { ElfDialog, elfChatter, type ElfGo } from './screens/ElfDialog'
import { Login } from './screens/Login'
import { clearEntered, enteredThisTab } from './entry'
import { ProfileForm } from './screens/ProfileForm'
import { CarolPlayer } from './screens/CarolPlayer'

type Modal = 'manito' | 'profile' | 'letter' | 'guess' | 'look' | 'tree' | 'awards' | 'elf' | 'admin' | 'treasure' | null

const LETTER_CHIP = { none: '작성 전', draft: '쓰는 중', submitted: '제출 ✓' } as const
const GUESS_CHIP = { none: '작성 전', draft: '쓰는 중', done: '완성 ✓' } as const

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined) // undefined = 확인 중
  const [modal, setModal] = useState<Modal>(null)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [carol, setCarol] = useState(0)
  const [overview, setOverview] = useState(false) // 🗺️ 마을 전경 보기
  const [tree, setTree] = useState<TreeSummary | null>(null)
  const inputEnabled = useRef(false)
  // 처음 들어온 사람은 쿠키부터 꾸민다 (사우나 게임처럼 입장 전에)
  const firstVisit = !!me && me.look === null
  inputEnabled.current = !!me && modal === null && !firstVisit

  const refresh = useCallback(async () => {
    // 이 탭에서 아직 PIN 을 안 넣었으면, 남아 있는 쿠키도 버리고 입장 화면부터 (매번 PIN)
    if (!enteredThisTab()) {
      await api.logout().catch(() => undefined)
      setMe(null)
      return
    }
    try {
      setMe(await api.me())
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearEntered()
        setMe(null)
      } else throw e
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Esc 로 창 닫기 (전경 보기 중이면 전경도 닫기), M 으로 전경 보기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'Escape') {
        setModal(null)
        setOverview(false)
      }
      if (e.code === 'KeyM' && !e.repeat) setOverview((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const logout = async () => {
    await api.logout()
    clearEntered()
    setModal(null)
    setMe(null)
  }

  const openPanel = useCallback(
    (p: 'letter' | 'manito' | 'tree' | 'awards' | 'elf') => {
      setModal(p)
      if (p === 'elf') void refresh() // 엘프는 최신 할 일 상태로 말한다
    },
    [refresh],
  )

  // 메시지 트리 카드 수와 오늘의 질문 (30초마다 새로)
  const loggedIn = !!me
  const loadTree = useCallback(() => api.treeSummary().then(setTree, () => {}), [])
  useEffect(() => {
    if (!loggedIn) return
    void loadTree()
    const t = setInterval(loadTree, 30_000)
    return () => clearInterval(t)
  }, [loggedIn, loadTree])
  // 🎀 보물찾기: 15초마다 누가 찾았는지 확인 → 찾은 자리는 사라지고, 새로 찾은 사람은 마을에 알림
  const [treasure, setTreasure] = useState<TreasureState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [giftOpened, setGiftOpened] = useState<Tier | null>(null) // 방금 연 진짜 선물의 등수 (축하 창)
  const [burst, setBurst] = useState<Burst | null>(null)
  const seen = useRef<Set<string> | null>(null)
  const loadTreasure = useCallback(async () => {
    const t = await api.treasure().catch(() => null)
    if (!t) return
    const before = seen.current
    seen.current = new Set(t.found.map((f) => f.spot))
    if (before) {
      const fresh = t.found.filter((f) => !before.has(f.spot) && f.spot !== t.mine?.spot)
      if (fresh.length)
        setToast(`🎉 ${fresh.map((f) => `${f.name}님이 ${tierOf(f.tier).label}`).join(', ')}을 찾았어요! 남은 선물 ${t.total - t.found.length}개`)
    }
    setTreasure(t)
  }, [])
  useEffect(() => {
    if (!loggedIn) return
    seen.current = null
    void loadTreasure()
    const t = setInterval(loadTreasure, 15_000)
    return () => clearInterval(t)
  }, [loggedIn, loadTreasure])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(t)
  }, [toast])
  const openTreasure = useCallback(
    async (spot: string) => {
      try {
        const r = await api.openTreasure(spot)
        setBurst({ spot, kind: r.kind, key: Date.now() })
        if (r.kind === 'gift')
          setTimeout(() => setGiftOpened(r.tier), 900) // 반짝이가 먼저 터지고 축하 창
        else setToast(r.line)
      } catch (e) {
        setToast((e as Error).message)
      }
      await loadTreasure()
      void refresh()
    },
    [loadTreasure, refresh],
  )
  const treasureScene = treasure?.active
    ? {
        hidden: SPOTS.map((s) => s.id).filter((id) => !treasure.found.some((f) => f.spot === id) && !treasure.duds.includes(id)),
        duds: treasure.duds,
        glow: treasure.glow,
        mine: !!treasure.mine,
        burst,
      }
    : null

  // 엘프 NPC: 할 일이 남았으면 ❗ 와 혼잣말
  const elf = me ? elfChatter(me) : null
  const giftWaiting = me && me.phase === 'ACTIVE' && !me.manitoOpened

  return (
    <>
      {me?.liveRoom ? (
        <LiveRoot room={me.liveRoom}>
          <Village
            me={{ id: me.id, name: me.name, look: me.look }}
            inputEnabled={inputEnabled}
            onPrompt={setPrompt}
            onOpen={openPanel}
            onCarol={setCarol}
            tree={tree}
            elf={elf}
            talking={modal === 'elf'}
            overview={overview && modal === null}
            treasure={treasureScene}
            onTreasure={openTreasure}
            live
          />
        </LiveRoot>
      ) : (
        <Village
          me={me ? { id: me.id, name: me.name, look: me.look } : null}
          inputEnabled={inputEnabled}
          onPrompt={setPrompt}
          onOpen={openPanel}
          onCarol={setCarol}
          tree={tree}
          elf={elf}
          talking={modal === 'elf'}
          overview={overview && modal === null}
          treasure={treasureScene}
          onTreasure={openTreasure}
        />
      )}
      <div className="ui">
        <header className="topbar">
          <h1>
            Who is my <span className="ax">AX</span> Santa?
          </h1>
        </header>

        {me === undefined && <div className="panel">불러오는 중…</div>}
        {me === null && <Login onDone={refresh} />}

        {me && (
          <>
            {firstVisit && (
              <div className="backdrop">
                <div className="modal">
                  <LookEditor seed={me.id} name={me.name} current={null} first onDone={refresh} />
                </div>
              </div>
            )}

            {giftWaiting && modal === null && !firstVisit && (
              <button className="notice" onClick={() => setModal('manito')}>
                🎅 내가 챙길 사람이 정해졌어요 · 확인하기
              </button>
            )}
            {prompt && modal === null && <div className="prompt">{prompt}</div>}
            {treasure?.active && !firstVisit && (
              <button className="treasure-hud" onClick={() => setModal('treasure')} title="숨은 선물 현황">
                🎀 남은 선물{' '}
                {TIERS.map((t) => (
                  <span key={t.tier}>
                    {t.label.split(' ')[0]}
                    {t.count - treasure.found.filter((f) => f.tier === t.tier).length}
                  </span>
                ))}
              </button>
            )}
            {toast && modal === null && (
              <div className="toast" role="status">
                {toast}
              </div>
            )}
            {giftOpened && (
              <div className="backdrop" onClick={(e) => e.target === e.currentTarget && setGiftOpened(null)}>
                <div className="modal">
                  <div className="panel gift-found">
                    <div className="gift-burst">🎀</div>
                    <h2>숨은 선물을 찾았어요!</h2>
                    <p className="gift-name">{tierOf(giftOpened).label}</p>
                    <p className="gift-prize">{tierOf(giftOpened).gift}</p>
                    <p className="muted">선물은 운영자가 따로 전달해 드려요. 숨은 선물은 1인 1개라, 이제 다른 동료들이 찾을 차례예요 🎄</p>
                    <button className="primary" onClick={() => setGiftOpened(null)}>
                      좋아요!
                    </button>
                  </div>
                </div>
              </div>
            )}
            <CarolPlayer level={carol} />

            <div className="help">
              <kbd>←↑↓→</kbd> 이동 · <kbd>Shift</kbd> 달리기 · <kbd>Space</kbd> 인사 · <kbd>E</kbd> 말 걸기·앉기 등 · <kbd>M</kbd> 전경
            </div>

            <nav className="dock">
              <span className="who">🍪 {me.name}</span>
              <button onClick={() => setModal('manito')}>🎅 내가 챙길 사람</button>
              <button onClick={() => setModal('letter')}>
                🕵️ 관찰 리포트{' '}
                <span className={`chip ${me.letter === 'submitted' ? 'ok' : me.phase === 'ACTIVE' && me.letter === 'none' ? 'warn' : ''}`}>
                  {LETTER_CHIP[me.letter]}
                </span>
              </button>
              <button onClick={() => setModal('guess')}>
                🔍 추리노트{' '}
                <span className={`chip ${me.guess === 'done' ? 'ok' : me.phase === 'ACTIVE' && me.guess === 'none' ? 'warn' : ''}`}>
                  {GUESS_CHIP[me.guess]}
                </span>
              </button>
              <button onClick={() => setModal('tree')}>🎄 메시지 트리</button>
              <button onClick={() => setModal('awards')}>
                🏆 어워즈{' '}
                {me.phase !== 'REVEAL' && (
                  <span className={`chip ${me.todo.given >= me.todo.people ? 'ok' : ''}`}>
                    {me.todo.given}/{me.todo.people}
                  </span>
                )}
              </button>
              <button onClick={() => setModal('profile')}>✏️ 내 프로필</button>
              {me.isAdmin && <button onClick={() => setModal('admin')}>⚙️ 운영</button>}
              <button className={overview ? 'on' : ''} onClick={() => setOverview((v) => !v)} title="M">
                🗺️ 전경
              </button>
              <button onClick={() => setModal('look')}>🎨 꾸미기</button>
              <button className="quiet" onClick={logout}>
                로그아웃
              </button>
            </nav>

            {modal === 'elf' && <ElfDialog me={me} question={tree?.question ?? null} onGo={(to: ElfGo) => setModal(to)} onClose={() => setModal(null)} />}

            {modal && modal !== 'elf' && (
              <div className="backdrop" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
                <div className="modal">
                  <button className="close" onClick={() => setModal(null)} aria-label="닫기">
                    ×
                  </button>
                  {modal === 'manito' && <Home me={me} onChange={refresh} onEditProfile={() => setModal('profile')} />}
                  {modal === 'profile' && (
                    <ProfileForm
                      me={me}
                      onSaved={() => {
                        void refresh()
                        setModal(null)
                      }}
                    />
                  )}
                  {modal === 'look' && (
                    <LookEditor
                      seed={me.id}
                      name={me.name}
                      current={me.look}
                      first={false}
                      onDone={() => {
                        void refresh()
                        setModal(null)
                      }}
                    />
                  )}
                  {modal === 'tree' && (
                    <MessageTree
                      onChange={() => {
                        void loadTree()
                        void refresh()
                      }}
                    />
                  )}
                  {modal === 'awards' && <AwardsPanel meId={me.id} onChange={refresh} />}
                  {modal === 'letter' && <LetterForm meName={me.name} onSaved={refresh} />}
                  {modal === 'guess' && <GuessForm onSaved={refresh} />}
                  {modal === 'treasure' && treasure && <TreasureBoard t={treasure} />}
                  {modal === 'admin' && me.isAdmin && <Admin onPhaseChange={refresh} onQuestions={loadTree} />}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

// 🎀 숨은 선물 현황: 등수마다 무슨 선물이 몇 개 남았고 누가 찾았는지 (모두에게 공개)
function TreasureBoard({ t }: { t: TreasureState }) {
  const left = t.total - t.found.length
  return (
    <div className="panel treasure-board">
      <h2>🎀 숨은 선물 현황</h2>
      <p className="muted">
        마을 곳곳에 진짜 선물과 꽝이 숨어 있어요. 진짜는 1인 1개! 지금 <b>{left}개</b> 남았어요.
        {t.mine && (
          <>
            {' '}
            나는 <b>{tierOf(t.mine.tier).label}</b>을 찾았어요 🎉
          </>
        )}
      </p>
      <div className="tier-list">
        {TIERS.map((tier) => {
          const got = t.found.filter((f) => f.tier === tier.tier)
          return (
            <section key={tier.tier} className={`tier ${got.length >= tier.count ? 'done' : ''}`}>
              <div className="tier-head">
                <b>{tier.label}</b>
                <span className="chip">
                  {tier.count - got.length}/{tier.count} 남음
                </span>
              </div>
              <p className="tier-gift">{tier.gift}</p>
              <p className="muted small">{got.length ? `찾은 사람: ${got.map((f) => f.name).join(', ')}` : '아직 아무도 못 찾았어요'}</p>
            </section>
          )
        })}
      </div>
    </div>
  )
}
