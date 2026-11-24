// 🏆 어워즈 상장 도우미 (운영자가 Claude Code 와 함께 쓴다).
//   1) 내보내기: npm run awards -- export
//      받은 사람별로 키워드 수와 인터뷰 답을 .data/awards-input.json 에 쓴다.
//      🌱 새로 온 사람(newcomer)이 들어간 인터뷰는 "첫인상·기대" 질문을 받으니 kind 가 '첫인상' 이다.
//      새로 온 사람의 상장은 "올해의 활약"보다 환영·기대 느낌으로 쓴다.
//      누가 한 답인지는 빼고, 순서도 섞는다. Claude Code 가 이걸 읽고 상장을 쓴다.
//   2) 넣기:     npm run awards -- import .data/awards-cards.json
//      [{ "name": "김민지", "title": "🧯 …상", "citation": "위 사람은 …" }] 를 award_cards 에 넣는다 (있으면 덮어씀).
// 운영 사이트 DB 에 하려면 .env 의 DATABASE_URL 에 Neon 연결 문자열이 있어야 한다. 비어 있으면 로컬(PGlite) DB 다.
// 로컬 DB 는 dev 서버가 켜져 있으면 잠겨 있으니 먼저 끈다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { db } from '../server/db.js'
import { awardFor, cleanGift } from '../src/awards.js'

type Row = { receiver_id: number; chips: string[]; custom: string | null; chat: { q: string; a: string }[] | null }

const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x)

async function exportInput() {
  const q = await db()
  const players = await q<{ id: number; name: string; newcomer: boolean }>(`select id, name, newcomer from players order by name`)
  const rows = await q<Row>(`select receiver_id, chips, custom, chat from keywords`)
  const out = players.map((p) => {
    const mine = rows.filter((r) => r.receiver_id === p.id)
    const { words, givers } = awardFor(mine.map((r) => cleanGift(r)))
    const interviews = shuffle(mine.filter((r) => r.chat?.length)).map((r) => ({
      kind: r.chat![0].q.includes('첫인상') ? '첫인상' : '함께한 순간', // 실제로 받은 질문 기준
      answers: r.chat!.map((x) => x.a),
    }))
    return { name: p.name, newcomer: p.newcomer, givers, keywords: words, interviews }
  })
  mkdirSync('.data', { recursive: true })
  writeFileSync('.data/awards-input.json', JSON.stringify(out, null, 2))
  console.log(`.data/awards-input.json · ${out.length}명 · 인터뷰 ${out.reduce((a, x) => a + x.interviews.length, 0)}개`)
  console.log(`DB: ${process.env.DATABASE_URL ? '운영(Neon)' : '로컬(PGlite)'}`)
}

async function importCards(file: string) {
  const cards = JSON.parse(readFileSync(file, 'utf8')) as { name: string; title: string; citation: string }[]
  const q = await db()
  const players = await q<{ id: number; name: string }>(`select id, name from players`)
  for (const c of cards) {
    const p = players.find((x) => x.name === c.name)
    if (!p) throw new Error(`없는 이름: ${c.name}`)
    await q(
      `insert into award_cards (player_id, title, citation) values ($1, $2, $3)
       on conflict (player_id) do update set title = excluded.title, citation = excluded.citation, updated_at = now()`,
      [p.id, c.title.trim().slice(0, 40), c.citation.trim().slice(0, 600)],
    )
  }
  console.log(`상장 ${cards.length}개를 넣었어요 · DB: ${process.env.DATABASE_URL ? '운영(Neon)' : '로컬(PGlite)'}`)
}

const [cmd, file] = process.argv.slice(2)
if (cmd === 'export') await exportInput()
else if (cmd === 'import' && file) await importCards(file)
else console.log('npm run awards -- export | import <파일>')
process.exit(0)
