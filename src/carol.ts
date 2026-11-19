// 캐롤 무대에서 흐르는 곡. 유튜브 주소(또는 영상 ID)를 넣으면 된다.
// 예: 'https://www.youtube.com/watch?v=XXXXXXXXXXX' 또는 'https://youtu.be/XXXXXXXXXXX'
export const CAROL = {
  youtube: '', // ← 김민지님 캐롤 유튜브 주소를 여기에
  title: '2026 Christmas Carol',
  by: '김민지',
}

/** 유튜브 주소에서 영상 ID 를 뽑는다. 못 찾으면 null */
export function youtubeId(url: string): string | null {
  const s = url.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/)
  return m ? m[1] : null
}

/**
 * 다같이 같은 부분을 듣도록, 지금 시각으로 재생 위치를 정한다 (라디오처럼).
 * 서버 없이도 모두의 시계가 같으면 같은 위치가 나온다.
 */
export function syncedPosition(durationSec: number, nowMs = Date.now()): number {
  if (!(durationSec > 1)) return 0
  return (nowMs / 1000) % durationSec
}
