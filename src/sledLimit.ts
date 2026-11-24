// 🛷 썰매 기록의 최댓값 (m). 서버가 이상한 기록을 거를 때 쓴다.
// 서버는 다른 파일을 가져오지 않는 파일만 쓸 수 있어서 (Vercel Node ESM) 여기 숫자로 따로 둔다.
// 썰매 길이 바뀌면 sled.test.ts 가 이 값과 실제 최대 거리(SLED_FAR)가 같은지 확인한다.
export const SLED_RECORD_MAX = 10.4
