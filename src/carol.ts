// 📻 AX 캐롤 라디오: 🔥 불멍 회의실에서 팀원들이 직접 만든 캐롤이 차례로 흐른다.
// - 곡은 src/carols/ 폴더의 음원 파일. 넣기만 하면 자동으로 목록에 들어간다 (파일 이름 = 제목, 앞 번호 = 순서).
// - 라디오처럼 모두가 같은 시각에 같은 곡의 같은 부분을 듣는다 (onAir).
// - 파일 이름: "번호 제목 - 작곡자.mp3" (예: "01 2026 Christmas Carol - 김민지.mp3"). 작곡자는 빼도 된다.

export type Song = { file: string; title: string; composer: string | null; url: string; cover: string | null }

/** 파일 이름 → 제목과 작곡자. 앞 번호와 확장자를 떼고, 마지막 " - " 뒤를 작곡자로 */
export function parseSongFile(file: string): { title: string; composer: string | null } {
  const base = file
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[\s._-]*/, '')
    .trim()
  const i = base.lastIndexOf(' - ')
  if (i > 0) return { title: base.slice(0, i).trim() || file, composer: base.slice(i + 3).trim() || null }
  return { title: base || file, composer: null }
}

const stem = (path: string) => (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '')

/** 폴더 속 파일 목록 → 곡 목록 (파일 이름 순서). 곡과 이름이 같은 그림(.jpg·.png·.webp)이 있으면 썸네일 */
export function songsFrom(files: Record<string, string>, covers: Record<string, string> = {}): Song[] {
  const coverOf = new Map(Object.entries(covers).map(([path, url]) => [stem(path), url]))
  return Object.entries(files)
    .map(([path, url]) => {
      const file = path.split('/').pop() ?? path
      return { file, ...parseSongFile(file), url, cover: coverOf.get(stem(path)) ?? null }
    })
    .sort((a, b) => a.file.localeCompare(b.file, 'ko', { numeric: true }))
}

/** 라디오: 지금 이 시각에 흐르는 곡과 재생 위치. 길이를 아는 곡만 차례로 돈다 */
export function onAir<T>(songs: readonly T[], durationOf: (s: T) => number, nowMs = Date.now()) {
  const list = songs.filter((s) => durationOf(s) > 1)
  const total = list.reduce((a, s) => a + durationOf(s), 0)
  if (!total) return null
  let t = (nowMs / 1000) % total
  for (let i = 0; i < list.length; i++) {
    const s = list[i]
    const d = durationOf(s)
    if (t < d) return { song: s, pos: t, left: d - t, next: list.length > 1 ? list[(i + 1) % list.length] : null }
    t -= d
  }
  return null
}

/** 3:25 처럼 */
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/** 곡마다 LP 라벨 색 (제목으로 정해져서 늘 같다, 0~359) */
export function labelHue(title: string) {
  let h = 0
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}
