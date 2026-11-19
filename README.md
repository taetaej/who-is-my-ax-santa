# Who is my AX Santa?

AX팀 연말 마니또 웹 서비스. 기획 문서는 `docs/`(PRD, IA, VILLAGE)에 있어요.

## 스택

| 영역 | 선택 |
|---|---|
| 프론트 | Vite + React + TypeScript + Three.js (React Three Fiber) |
| API | Hono (`server/app.ts`). Vercel 에서는 `api/index.ts` 함수 하나로, 로컬에서는 Node 서버로 돈다 |
| DB | Postgres. 배포는 Neon(Vercel Marketplace), 로컬은 PGlite(내장 Postgres, 설치 없음) |
| 실시간 | Liveblocks presence (다른 사람 위치·인사). 키가 없으면 혼자 돌아다니는 모드 |
| 배포 | Vercel |

## 실시간 마을 켜기 (Liveblocks)

1. https://liveblocks.io 가입 → 프로젝트 만들기 → API keys 에서 **Secret key**(`sk_…`) 복사
2. 로컬: 프로젝트 폴더에 `.env` 파일을 만들고 `LIVEBLOCKS_SECRET_KEY=sk_…` 한 줄 넣기 → `npm run dev` 다시 실행
3. Vercel: Environment Variables 에 같은 값 추가

공유하는 정보는 위치·방향·있는 곳(마을/몇 번 집)·인사뿐이고, 토큰은 우리 API(`/api/me/live-auth`)가
로그인한 사람에게만 "읽기 + 위치 공유" 권한으로 발급해요. 방 이름은 `santa-village-{local|preview|production}` 이에요.

## 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:5173 에서 열려요. API 는 8787 포트로 뜨고 Vite 가 `/api` 를 넘겨줘요.
`DATABASE_URL` 이 없으면 `.data/pglite` 에 저장돼요. 처음부터 다시 하려면 이 폴더를 지우면 돼요.

```bash
npm test
```

## Vercel 배포

1. Vercel 에서 이 저장소를 Import (Framework: Vite)
2. Storage → Neon Postgres 추가 → `DATABASE_URL` 이 자동으로 들어가요
3. Environment Variables 에 `SESSION_SECRET` 추가 (길고 무작위인 값)
4. 배포. 테이블과 14명 명단은 첫 API 호출 때 자동으로 만들어져요

## 블라인드 규칙 (PRD 4.2, 4.3)

- 매칭(`matches`)은 READY → ACTIVE 전환 때 서버에서 한 번 만들고, 로그에 남기지 않아요.
- 매칭을 읽는 API 는 `GET /api/me/manito`(내가 챙길 사람) 하나뿐이에요. 운영자 API 에도 매칭은 없어요.
- DB 에 직접 들어가면 볼 수 있어요. Neon 콘솔은 열지 않는 걸 규칙으로 해요.
