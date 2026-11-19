import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, type Me, type TreeSummary } from './api'
import { Village } from './scene/Village'
import { LiveRoot } from './scene/live'
import { Admin } from './screens/Admin'
import { Home } from './screens/Home'
import { LetterForm } from './screens/LetterForm'
import { LookEditor } from './screens/LookEditor'
import { MessageTree } from './screens/MessageTree'
import { AwardsPanel } from './screens/AwardsPanel'
import { ElfDialog, elfChatter, type ElfGo } from './screens/ElfDialog'
import { Login } from './screens/Login'
import { clearEntered, enteredThisTab } from './entry'
import { ProfileForm } from './screens/ProfileForm'
import { CarolPlayer } from './screens/CarolPlayer'

type Modal = 'manito' | 'profile' | 'letter' | 'look' | 'tree' | 'awards' | 'elf' | 'admin' | null

const LETTER_CHIP = { none: '작성 전', draft: '쓰는 중', submitted: '제출 ✓' } as const

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
      }
      else throw e
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
  // 엘프 NPC: 할 일이 남았으면 ❗ 와 혼잣말
  const elf = me ? elfChatter(me) : null
  const giftWaiting = me && me.phase === 'ACTIVE' && !me.manitoOpened

  return (
    <>
      {me?.liveRoom ? (
        <LiveRoot room={me.liveRoom}>
          <Village me={{ id: me.id, name: me.name, look: me.look }} inputEnabled={inputEnabled} onPrompt={setPrompt} onOpen={openPanel} onCarol={setCarol} tree={tree} elf={elf} talking={modal === 'elf'} overview={overview && modal === null} live />
        </LiveRoot>
      ) : (
        <Village me={me ? { id: me.id, name: me.name, look: me.look } : null} inputEnabled={inputEnabled} onPrompt={setPrompt} onOpen={openPanel} onCarol={setCarol} tree={tree} elf={elf} talking={modal === 'elf'} overview={overview && modal === null} />
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
                🎁 선물 상자가 도착했어요 · 열어 보기
              </button>
            )}
            {prompt && modal === null && <div className="prompt">{prompt}</div>}
            <CarolPlayer level={carol} />

            <div className="help">
              <kbd>←↑↓→</kbd> 이동 · <kbd>Shift</kbd> 달리기 · <kbd>Space</kbd> 인사 · <kbd>E</kbd> 말 걸기·앉기 등 · <kbd>M</kbd> 전경
            </div>

            <nav className="dock">
              <span className="who">🍪 {me.name}</span>
              <button onClick={() => setModal('manito')}>🎁 나의 마니또</button>
              <button onClick={() => setModal('letter')}>
                💌 소개서 <span className={`chip ${me.letter === 'submitted' ? 'ok' : me.phase === 'ACTIVE' && me.letter === 'none' ? 'warn' : ''}`}>{LETTER_CHIP[me.letter]}</span>
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
              <button className="quiet" onClick={logout}>로그아웃</button>
            </nav>

            {modal === 'elf' && (
              <ElfDialog me={me} question={tree?.question ?? null} onGo={(to: ElfGo) => setModal(to)} onClose={() => setModal(null)} />
            )}

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
