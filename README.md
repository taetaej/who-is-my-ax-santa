# Who is my AX Santa?

AX팀 연말 마니또 웹 서비스. 기획 문서는 `docs/`(PRD, IA, VILLAGE)에 있어요.

배포: https://who-is-my-ax-santa.vercel.app (`main` 에 푸시하면 자동 배포)

## 행사 일정 (확정)

날짜별 운영자 체크리스트는 **[docs/OPERATIONS.md](docs/OPERATIONS.md)** 에 있어요. 일정의 원본은 `src/schedule.ts` (마을 안 📅 일정 화면도 이걸 써요).

| 날짜 | 단계 | 내용 · 운영자가 할 일 |
|---|---|---|
| **12/1(화)** | READY | 🎄 마을 오픈: 입장(PIN 등록) · 쿠키 꾸미기. 메시지 트리 첫 질문 |
| 12/1~2 | READY | 📝 자기소개(✏️ 내 프로필) |
| 12/1~4 | READY | 🌱 오프닝 주간: 메시지 트리 · 썰매·눈싸움·눈굴리기 · 🏆 어워즈 인터뷰 |
| **12/7(월)** | ACTIVE | ⚙️ 운영 → **산타 배정 시작** (자동 아님, 되돌릴 수 없음). 🎀 숨은 선물 찾기 시작 |
| 12/7~16 | ACTIVE | 🎅 산타 미션(2일마다): ① 몰래 관찰 ② 간식 ③ 응원 쪽지 ④ 선물 준비 + 📸 보너스: 챙길 사람과 마을에서 사진 찍기 |
| 12/14 | ACTIVE | 🏆 어워즈 인터뷰 마감 |
| 12/15~16 | ACTIVE | ✍️ 관찰 리포트 · 🔍 추리노트 마감 주간. 12/15 어워즈 상장 만들기 |
| **12/17(목)** | REVEAL | ⚙️ 운영 → **공개일 시작** → 🎬 발표 화면 → 🎄 메시지 트리 돌아보기 |

메시지 트리는 **12/1~12/16 평일마다** 질문 하나(12개, `src/questions.ts`). 주말은 새 질문 없이 금요일 카드가 이어져요. 운영 화면에서 바꿀 수 있고, 저장한 목록이 기본값보다 우선이에요 (🔄 기본 질문 불러오기).

## 마을에서 할 수 있는 것

- **할 일**: 📅 일정(오늘 할 일 + 달력), 🎅 내가 챙길 사람(이름은 ●●●, 👁 꾹 눌러 보기), 🕵️ 관찰 리포트, 🔍 추리노트, 🎄 메시지 트리, 🏆 어워즈 엘프 인터뷰, 🎀 숨은 선물
- **놀이 (XP · 레벨 · 순위판)**: 🛷 4줄 썰매 레이스(계단 → Space 연타 → 범퍼·장애물·점프, 기록판), ⚔️ 눈싸움장(체력·기절·살리기), ⛄ 눈굴리기(기록판), 🚀 2027 WithSet 호 발사(모두의 화면에서 같이, 염원 횟수), 🔭 망원경
- **분위기**: 떠 있는 우주 행성 섬, 밤 조명과 따뜻한 불빛, 굴뚝 연기, 썰매장 공중 등불, 마을 고양이·강아지(모두에게 같은 자리), 📻 캐롤 라디오
- **조작**: 방향키/WASD 이동 · Shift 달리기 · Space 인사 · E 상호작용 · F 눈덩이 · 1~8 반응 · M 전경 · 화면 끌기/Q·R 시야 · 휠 줌 · C 원래대로 · ? 조작법
- **화면**: 유리 HUD(왼쪽 위 상태 카드, 아래 단축바 + ☰ 더보기, 😊 반응, 🗺️ 미니맵), 팝업은 밝은 유리 + 빨간 명패. 아이콘은 Phosphor 한 벌

## 기술 스택

### 한눈에 보기

| 영역 | 기술 | 역할 |
|---|---|---|
| 언어 | TypeScript 5.9 | 화면·서버·공용 로직 모두 TS 하나로 |
| 화면 | React 19 + Vite 8 | UI(창·메뉴·폼)와 개발 서버·빌드 |
| 3D | Three.js 0.187 + React Three Fiber 9 + drei 10 | 마을, 쿠키 캐릭터, 카메라 연출 |
| 3D 후처리 | @react-three/postprocessing (Bloom, Vignette) | 전구·불빛이 은은하게 번지는 저녁 분위기 |
| API | Hono 4 | `server/app.ts` 하나. Vercel 에서는 함수(`api/index.ts`), 로컬에서는 Node 서버(`server/dev.ts`) |
| DB | Postgres — 배포: **Neon**, 로컬: **PGlite** | 같은 SQL 을 그대로 쓴다. 로컬은 설치 없이 `.data/pglite` 파일에 저장 |
| 실시간 | **Liveblocks** (presence) | 다른 사람의 위치·자세·꾸미기·인사를 실시간으로 |
| 음악 | HTML Audio + Web Audio 분석 | 📻 AX 캐롤 라디오: `src/carols/` 음원 파일(`번호 제목 - 작곡자.mp3`)을 차례로. 거리 따라 볼륨, 모두 같은 곡·같은 소절, 박자에 맞춰 무대가 반응 |
| 서체 · 아이콘 | Sora(영문 제목) · 페이퍼로지(한글) · 서툰이야기 Poor Story(말풍선 손글씨) · Phosphor Icons | Google Fonts + 눈누 CDN, `@phosphor-icons/react` |
| 테스트 | Vitest | 매칭, 관찰 리포트·꾸미기·질문·어워즈 규칙, 일정·미션, 썰매·눈싸움·눈굴리기·로켓 물리, 펫 길, 엘프 잔소리 |
| 배포 | Vercel (Hobby) | `main` 푸시 → 자동 배포. 환경변수: `DATABASE_URL`, `SESSION_SECRET`, `LIVEBLOCKS_SECRET_KEY` |

### 구조

```
src/
  App.tsx            로그인 상태, 창(모달)·메뉴, 마을 연결
  api.ts             API 호출 모음 (타입 포함)
  schedule.ts        📅 행사 일정 · 산타 미션 (화면·서버 공용)
  gameRules.ts       XP·레벨·체력·기록 규칙 (서버도 import 하므로 다른 파일을 import 하지 않음)
  screens/           2D 창: 로그인, 일정(Calendar), 내가 챙길 사람, 관찰 리포트, 추리노트, 꾸미기, 메시지 트리, 어워즈, 엘프 대화,
                     운영, 공개일 발표(RevealShow), 메시지 트리 돌아보기(TreeShow), 게임 HUD, 미니맵, 반응, 캐롤 플레이어
  scene/             3D 마을
    Village.tsx        하늘·조명·땅·숲, 전체 조립
    world.ts           배치 좌표, 충돌, "E" 상호작용 판정 (그리기와 이동이 같이 쓰는 값)
    Player.tsx         내 쿠키 조작(방향키·달리기·인사·E)과 장소별 카메라 시점
    Cookie.tsx         진저브레드 쿠키 (팔다리 애니메이션, 자세, 꾸미기)
    Spots.tsx          AX 우편함·AX 카페·불멍 회의실·눈밭·어워즈 부스·게시판·메시지 트리 카드
    Timeline.tsx       2026 AX 연대기 전시   Party.tsx  파티 테이블   Elf.tsx  AX 엘프   Festive.tsx  입구 아치·전구·사탕
    Space.tsx          우주 하늘·행성·오로라·떠 있는 섬     Decor.tsx  등불 기둥·돌길·로켓·망원경·수정
    SledHill.tsx · sledRide.ts   🛷 썰매 레이스 (그리기 · 물리)     Zones.tsx · rolling.ts  ⚔️ 눈싸움장 · ⛄ 눈굴리기
    Warmth.tsx         불빛 웅덩이·굴뚝 연기·썰매장 공중 등불   Pets.tsx · petPath.ts  고양이·강아지
    rocket.ts · game.ts · snowball.ts · emote.ts   로켓·놀이 상태·눈덩이·반응 (실시간 이벤트 포함)
    live.tsx           Liveblocks 연결 (내 상태 보내기, 다른 사람 그리기)
    TextSign.tsx       간판 글씨를 캔버스로 그려 3D 판에 붙이기 (자동 줄바꿈·크기 맞춤)
  look.ts · questions.ts · awards.ts · timeline.ts · carol.ts · team.ts
                     화면과 서버가 같이 쓰는 데이터·규칙 (꾸미기 선택지, 오늘의 질문, 어워즈 키워드 칩과 상 규칙, 연대기, 캐롤, 팀 명언)
server/
  app.ts             모든 API (로그인, 매칭, 관찰 리포트, 메시지 트리, 어워즈, 꾸미기, 운영, 실시간 입장권)
  db.ts              Neon/PGlite 연결과 테이블 생성 (첫 호출 때 자동)
  auth.ts            PIN 해시, 로그인 쿠키 서명   matching.ts  단일 순환 매칭   letter.ts  관찰 리포트 정리·검사
api/index.ts         Vercel 함수 진입점
```

### 3D 를 만든 방식
- 외부 3D 모델 파일 없이 **전부 코드로 만든 도형**이에요(박스·원기둥·구·압출). 나무 판자·벽돌·지붕 질감도 캔버스로 그려요.
- 움직이지 않는 물체는 재질별로 **하나로 합쳐 그려서**(`Batch`) 그리기 횟수를 줄였어요.
- 카메라와 내 캐릭터 사이를 가리는 건물·나무는 **반투명**해져요(`Fade`).
- 장소마다 카메라가 다가가는 **클로즈업 시점**이 있고, 🗺️ 전경 모드에서는 마을 위를 천천히 돌아요.

### 데이터 (Postgres 테이블)
| 테이블 | 내용 |
|---|---|
| `players` | 14명 명단, PIN 해시, 로그인 잠금, 프로필, 꾸미기(`look`) |
| `matches` | 산타 → 챙길 사람 (READY → ACTIVE 전환 때 한 번 생성) |
| `letters` | 산타의 관찰 리포트 (쓴 사람 기준, 임시저장/제출) |
| `guesses` | 🔍 내 산타 추리노트 (쓴 사람 기준, 공개일 전엔 본인만) |
| `messages` · `hearts` | 메시지 트리 답(하루 한 장)과 ❤️ |
| `treasure_finds` | 🎀 숨은 선물(진짜): 어느 자리를 누가 열었는지 (자리 1개 = 1명, 1명 = 1개) |
| `treasure_duds` | 🎀 숨은 선물(꽝): 누가 어느 꽝을 열어 봤는지 (그 사람 화면에만 빈 상자로 남김) |
| `keywords` | 어워즈: 누가 누구를 인터뷰했는지 (고정 질문 3개 문답 `chat`, 키워드 칩, 직접 쓰기). 문답은 준 사람 말고 아무도 못 봄 |
| `award_cards` | 어워즈 상장: 공개일 전에 운영자가 Claude Code 로 쓰고(`npm run awards -- export / import`) 운영 화면에서 고친 상 이름·문구. 공개일에 받은 사람별로 공개 |
| `mission_checks` | 🎅 산타 미션 체크 (본인만 봄, XP 계산용) |
| `game_records` · `xp_daily` | 🛷 썰매·⛄ 눈굴리기 최고 기록, 놀이 XP (하루 상한) |
| `santa_photos` | 📸 산타가 마을에서 챙길 사람과 찍은 사진 (공개일 발표 화면에서만 공개) |
| `settings` | 진행 단계, 오늘의 질문 목록·시작일, 🚀 로켓 염원 횟수 |

### 보안과 블라인드
- 로그인: 이름 + 4자리 PIN. PIN 은 **scrypt 해시**로만 저장, 5번 틀리면 5분 잠금.
- 로그인 상태는 서버 비밀 키로 **서명한 httpOnly 세션 쿠키**(브라우저를 닫으면 사라지고, 길어야 12시간). 입장할 때마다 PIN 을 묻고, 탭을 새로 열면 남은 쿠키도 버린다. PIN 을 초기화하면 기존 쿠키가 모두 무효.
- 운영 기능은 화면과 서버 양쪽에서 운영자만 허용. 운영자도 **매칭·남의 관찰 리포트·누가 누구에 대해 무슨 말을 했는지는 볼 수 없어요**. 상장은 받은 사람별로 합친 내용으로만 만들어요.
- 실시간(Liveblocks)에는 위치·자세·꾸미기·인사만 보내요. 이름은 서버가 넣어서 남의 이름으로 들어갈 수 없어요.

## 실시간 마을 켜기 (Liveblocks)

1. https://liveblocks.io 가입 → 프로젝트 만들기 → API keys 에서 **Secret key**(`sk_…`) 복사
2. 로컬: 프로젝트 폴더에 `.env` 파일을 만들고 `LIVEBLOCKS_SECRET_KEY=sk_…` 한 줄 넣기 → `npm run dev` 다시 실행
3. Vercel: Environment Variables 에 같은 값 추가

공유하는 정보는 위치·방향·자세·핫초코·꾸미기·인사뿐이고, 토큰은 우리 API(`/api/me/live-auth`)가
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
