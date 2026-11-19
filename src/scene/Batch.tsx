import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// 움직이지 않는 묶음(집 한 채, 큰 트리 등)의 메시를 재질별로 하나씩 합쳐 드로우콜을 줄인다.
// 원본 메시는 숨기고, 합친 메시를 그룹에 붙인다. 안에서 움직이는 것이 있으면 쓰지 않는다.

const KEEP = ['position', 'normal', 'uv']

export function Batch({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    const g = group.current
    if (!g) return
    g.updateWorldMatrix(true, true)
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert()
    const buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; geos: THREE.BufferGeometry[] }>()
    const hidden: THREE.Mesh[] = []

    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || Array.isArray(m.material)) return
      let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
      for (const name of Object.keys(geo.attributes)) if (!KEEP.includes(name)) geo.deleteAttribute(name)
      if (!geo.attributes.normal) geo.computeVertexNormals()
      if (!geo.attributes.uv) return
      geo.morphAttributes = {}
      geo = geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
      const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}`
      if (!buckets.has(key)) buckets.set(key, { mat: m.material, cast: m.castShadow, recv: m.receiveShadow, geos: [] })
      buckets.get(key)!.geos.push(geo)
      hidden.push(m)
    })

    const merged: THREE.Mesh[] = []
    for (const b of buckets.values()) {
      const geo = mergeGeometries(b.geos)
      if (!geo) continue
      const mesh = new THREE.Mesh(geo, b.mat)
      mesh.castShadow = b.cast
      mesh.receiveShadow = b.recv
      merged.push(mesh)
    }
    // 합치기에 실패한 묶음이 있으면 원본을 그대로 둔다
    if (merged.length === 0) return
    for (const m of hidden) m.visible = false
    for (const m of merged) g.add(m)
    return () => {
      for (const m of merged) {
        g.remove(m)
        m.geometry.dispose()
      }
      for (const m of hidden) m.visible = true
    }
  }, [])

  return <group ref={group}>{children}</group>
}
