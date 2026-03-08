import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * useJewelleryLoader — Phase 4
 *
 * Loads GLB models on demand and caches them so switching
 * products doesn't re-download the same file.
 *
 * Returns:
 *   loadModel(url) → Promise<THREE.Group>  — cloned, ready to add to scene
 *   clearCache()                           — free GPU memory
 */
export function useJewelleryLoader() {
  // url → THREE.Group (original, never added to scene directly)
  const cacheRef = useRef(new Map())
  const loaderRef = useRef(new GLTFLoader())

  const loadModel = useCallback(async (url) => {
    // Return a CLONE from cache so the same model can be
    // placed at multiple positions (left + right ear)
    if (cacheRef.current.has(url)) {
      return cacheRef.current.get(url).clone()
    }

    return new Promise((resolve, reject) => {
      loaderRef.current.load(
        url,
        (gltf) => {
          const model = gltf.scene

          // Ensure all meshes use standard material settings
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow    = true
              child.receiveShadow = false
              // Boost metalness/roughness if not already set
              if (child.material) {
                child.material.metalness = Math.max(child.material.metalness ?? 0, 0.7)
                child.material.roughness = Math.min(child.material.roughness ?? 1, 0.3)
                child.material.needsUpdate = true
              }
            }
          })

          // Store original in cache, return a clone
          cacheRef.current.set(url, model)
          resolve(model.clone())
        },
        undefined,   // progress — not needed
        reject
      )
    })
  }, [])

  const clearCache = useCallback(() => {
    cacheRef.current.forEach((model) => {
      model.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          } else {
            child.material?.dispose()
          }
        }
      })
    })
    cacheRef.current.clear()
  }, [])

  return { loadModel, clearCache }
}
