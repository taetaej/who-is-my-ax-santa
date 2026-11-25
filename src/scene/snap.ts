// 📸 3D 장면 찍기: 캔버스 안의 <Snapshot /> 이 등록하고, 사진 모드(PhotoMode)가 부른다.
// 한 장면을 바로 그리고 그 자리에서 캔버스를 읽어서, 화면 버퍼가 비워졌어도 검은 사진이 나오지 않는다.
export const snap = {
  take: null as null | (() => HTMLCanvasElement),
}
