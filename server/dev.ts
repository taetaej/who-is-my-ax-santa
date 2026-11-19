import { serve } from '@hono/node-server'
import { app } from './app'
import { db } from './db'

await db() // 로컬 DB 준비 (테이블 생성 + 명단 시드)
serve({ fetch: app.fetch, port: 8787 }, (info) => {
  const where = process.env.DATABASE_URL ? 'Neon (DATABASE_URL)' : 'PGlite (.data/pglite)'
  console.log(`API http://localhost:${info.port}/api  ·  DB: ${where}`)
})
