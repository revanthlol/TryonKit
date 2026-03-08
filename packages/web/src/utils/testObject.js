import * as THREE from 'three'

/**
 * createTestCube — Phase 2/3
 *
 * Larger default size (0.15 world units instead of 0.06)
 * so position is easy to judge before GLB models arrive in Phase 4.
 * computeJewelleryScale will resize it relative to face distance.
 */
export function createTestCube() {
  const group = new THREE.Group()
  group.name  = 'test-cube'

  const size = 0.15   // larger — easier to see for calibration

  const solidGeo = new THREE.BoxGeometry(size, size, size)
  const solidMat = new THREE.MeshStandardMaterial({
    color:     0xc9a84c,
    roughness: 0.3,
    metalness: 0.8,
  })
  group.add(new THREE.Mesh(solidGeo, solidMat))

  const wireGeo = new THREE.BoxGeometry(size * 1.06, size * 1.06, size * 1.06)
  const wireMat = new THREE.MeshBasicMaterial({
    color:       0xe8c97e,
    wireframe:   true,
    opacity:     0.5,
    transparent: true,
  })
  group.add(new THREE.Mesh(wireGeo, wireMat))

  group.position.set(0, -10, 0)   // off-screen until first landmark
  return group
}
