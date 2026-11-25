import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { api, type RecordBoard as RecordData, type XpBoard as XpData } from '../api'
import type { RecordKind } from '../gameRules'
import { emotes } from './emote'
import { game, xpStore } from './game'
import { TextSign, type TextLine } from './TextSign'
import type { V3 } from './world'

// 🏆 나무 기록판: 🛷 썰매 · ⛄ 눈굴리기 · ⭐ 레벨 순위. 1~5위와 (5위 밖이면) 내 순위.

const POST = new THREE.MeshStandardMaterial({ color: '#6a4428', roughness: 0.8 })
const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.']

function Sign({ lines, position, rotation = 0 }: { lines: TextLine[]; position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.75, -0.03]} material={POST} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 1.5, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, -0.04]} material={POST} castShadow>
        <boxGeometry args={[1.75, 1.15, 0.05]} />
      </mesh>
      <TextSign lines={lines} w={1.65} h={1.05} position={[0, 1.2, 0]} bg="#1f2350" radius={0.06} glow />
    </group>
  )
}

const rows = <T extends { name: string; me: boolean; rank: number }>(top: T[], mine: T | null, show: (r: T) => string): TextLine[] => [
  ...(top.length
    ? top.map((r, i) => ({ text: `${MEDALS[i]} ${r.name}  ${show(r)}`, size: 0.12, color: r.me ? '#ffcf4a' : '#ffffff', weight: 800, kr: true, gap: 0.03 }))
    : [{ text: '아직 기록이 없어요', size: 0.11, color: '#ffffff', kr: true }]),
  ...(mine && mine.rank > 5 ? [{ text: `나 ${mine.rank}위 ${show(mine)}`, size: 0.1, color: '#ffcf4a', weight: 800, kr: true, gap: 0.04 }] : []),
]

const UNIT: Record<RecordKind, (v: number) => string> = { sled: (v) => `${v.toFixed(1)}m`, roll: (v) => `${Math.round(v)}cm` }
const TITLE: Record<RecordKind, string> = { sled: '🏆 썰매 기록판', roll: '⛄ 눈굴리기 기록판' }

/** 🛷 ⛄ 기록판: 다 하고 나면 기록을 올리고 판을 새로 그린다. 신기록이면 XP */
export function RecordBoard({ kind, footer, position, rotation }: { kind: RecordKind; footer: string; position: V3; rotation?: number }) {
  const [board, setBoard] = useState<RecordData | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => void api.records(kind).then((b) => alive && setBoard(b)).catch(() => {})
    load()
    const t = setInterval(load, 30_000)
    game.finish[kind] = (value, crashed) => {
      void api
        .saveRecord(kind, value)
        .then((b) => {
          if (!alive) return
          setBoard(b)
          const me = b.mine
          game.gainXp?.(kind)
          if (b.newBest && me) {
            game.gainXp?.('best')
            emotes.toast?.(`🏆 ${crashed ? '박았지만 ' : ''}내 최고 기록 ${UNIT[kind](b.value)}! 지금 ${me.rank}위`)
          } else if (me) emotes.toast?.(`${kind === 'sled' ? '🛷' : '⛄'} ${UNIT[kind](b.value)} · 내 최고 ${UNIT[kind](me.best)} (${me.rank}위)`)
        })
        .catch(() => {})
    }
    return () => {
      alive = false
      clearInterval(t)
      delete game.finish[kind]
    }
  }, [kind])
  const lines: TextLine[] = [
    { text: TITLE[kind], size: 0.16, color: '#ffe7a8', weight: 900, kr: true, gap: 0.06 },
    ...rows(board?.top ?? [], board?.mine ?? null, (r) => UNIT[kind](r.best)),
    { text: footer, size: 0.085, color: '#c9d6ff', kr: true, gap: 0.06 },
  ]
  return <Sign lines={lines} position={position} rotation={rotation} />
}

/** ⭐ 레벨 순위판 */
export function XpBoard({ position, rotation }: { position: V3; rotation?: number }) {
  const [board, setBoard] = useState<XpData | null>(xpStore.board)
  useEffect(() => {
    xpStore.listeners.add(setBoard)
    return () => void xpStore.listeners.delete(setBoard)
  }, [])
  const lines: TextLine[] = [
    { text: '⭐ 산타 행성 레벨 순위', size: 0.15, color: '#ffe7a8', weight: 900, kr: true, gap: 0.06 },
    ...rows(board?.top ?? [], board?.mine ?? null, (r) => `Lv.${r.lv}`),
    { text: '놀이 · 리포트 · 트리 · 선물 찾기로 XP!', size: 0.08, color: '#c9d6ff', kr: true, gap: 0.06 },
  ]
  return <Sign lines={lines} position={position} rotation={rotation} />
}

/** ⚔️ 오늘의 눈싸움 왕: 오늘 기절시킨 수 1~5위 (30초마다 새로) */
export function ArenaBoard({ position, rotation }: { position: V3; rotation?: number }) {
  const [top, setTop] = useState<{ rank: number; name: string; kos: number; me: boolean }[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => void api.arenaToday().then((b) => alive && setTop(b.top)).catch(() => {})
    load()
    const t = setInterval(load, 30_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  const lines: TextLine[] = [
    { text: '⚔️ 오늘의 눈싸움 왕', size: 0.16, color: '#ffe7a8', weight: 900, kr: true, gap: 0.06 },
    ...(top?.length
      ? top.map((r, i) => ({ text: `${MEDALS[i]} ${r.name}  ${r.kos} KO`, size: 0.12, color: r.me ? '#ffcf4a' : '#ffffff', weight: 800, kr: true, gap: 0.03 }))
      : [{ text: '오늘 첫 KO 의 주인공은?', size: 0.11, color: '#ffffff', kr: true }]),
    { text: 'F 꾹 = 세게 · 받침대 아이템 · 쓰러진 동료는 E 3번', size: 0.08, color: '#c9d6ff', kr: true, gap: 0.06 },
  ]
  return <Sign lines={lines} position={position} rotation={rotation} />
}
