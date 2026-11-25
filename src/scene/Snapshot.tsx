import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { snap } from './snap'

/** 캔버스 안에 두면 snap.take() 로 지금 장면을 찍을 수 있다 */
export function Snapshot() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    snap.take = () => {
      gl.render(scene, camera)
      return gl.domElement
    }
    return () => {
      snap.take = null
    }
  }, [gl, scene, camera])
  return null
}
