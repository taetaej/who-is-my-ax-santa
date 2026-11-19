// Vercel 함수 진입점. vercel.json 이 /api/* 를 전부 여기로 보낸다.
import { handle } from 'hono/vercel'
import { app } from '../server/app.js'

const handler = handle(app)
export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
