// 📻 지금 흐르는 캐롤과 박자를 3D 장면에 알려 주는 작은 저장소.
// 화면의 CarolPlayer 가 쓰고, 불멍 회의실(스피커·불·전구·턴테이블·나우 플레잉)이 읽는다.

export const music = {
  song: null as { title: string; composer: string | null } | null, // 무대 근처에서 흐르는 곡
  playing: false, // 실제로 소리가 나는 중 (근처 + 소리 켬 + 재생됨)
  level: 0, // 0~1 지금 소리 크기 (부드럽게)
  kick: 0, // 0~1 저음이 '쿵' 할 때 튀었다가 빠르게 줄어든다
  read: null as (() => { level: number; bass: number }) | null, // 분석기 (없으면 가짜 박자)
}

let prevBass = 0
/** 매 프레임 한 번 (Fire 등에서). 분석기가 없으면 1분에 120박자짜리 가짜 박자 */
export function tickMusic(t: number, dt: number) {
  if (!music.playing) {
    music.level += (0 - music.level) * Math.min(1, dt * 3)
    music.kick = Math.max(0, music.kick - dt * 4)
    return
  }
  const r = music.read?.()
  const level = r ? r.level : 0.55 + Math.sin(t * 2.1) * 0.1
  const bass = r ? r.bass : Math.max(0, Math.sin(t * Math.PI * 4)) ** 6
  music.level += (level - music.level) * Math.min(1, dt * 8)
  if (bass > 0.55 && bass > prevBass + 0.08) music.kick = 1
  else music.kick = Math.max(0, music.kick - dt * 5)
  prevBass = bass
}
