// 입장할 때마다 PIN 을 묻는다.
// - 이 탭에서 PIN 을 넣고 들어왔는지는 sessionStorage 에 둔다. 새로고침은 그대로, 탭·브라우저를 닫으면 사라진다.
// - 마지막으로 들어온 이름은 localStorage 에 기억해 두고, 다음엔 PIN 만 받는다.
// 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)에서는 매번 묻는 쪽으로 안전하게 넘어간다.

const ENTERED = 'santa-entered'
const LAST = 'santa-last-player'

function get(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key)
  } catch {
    return null
  }
}
function set(store: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) store().removeItem(key)
    else store().setItem(key, value)
  } catch {
    /* 저장 못 해도 매번 PIN 을 물을 뿐 */
  }
}

const session = () => window.sessionStorage
const local = () => window.localStorage

export const enteredThisTab = () => get(session, ENTERED) === '1'

export function markEntered(playerId: number) {
  set(session, ENTERED, '1')
  set(local, LAST, String(playerId))
}

export const clearEntered = () => set(session, ENTERED, null)

export function lastPlayer(): number | null {
  const v = Number(get(local, LAST))
  return Number.isInteger(v) && v > 0 ? v : null
}

export const forgetLastPlayer = () => set(local, LAST, null)
