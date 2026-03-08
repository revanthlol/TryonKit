import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

/**
 * useThreeScene — Phase 2 (fixed)
 *
 * Fix 1: VideoTexture is created only after the video element fires
 *         'loadeddata', guaranteeing valid pixel data exists.
 * Fix 2: Renderer is sized from the canvas element, not the video.
 */
export function useThreeScene(canvasRef, videoRef) {
  const rendererRef     = useRef(null)
  const jewelleryScene  = useRef(null)
  const perspCameraRef  = useRef(null)
  const rafRef          = useRef(null)

  const addObject    = useCallback((obj) => { jewelleryScene.current?.add(obj)    }, [])
  const removeObject = useCallback((obj) => { jewelleryScene.current?.remove(obj) }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    let cancelled = false

    // ── Renderer ──────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.autoClear = false
    rendererRef.current = renderer

    // ── Jewellery scene (perspective) ──────────────────────
    const jwScene  = new THREE.Scene()
    const jwCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.01, 100)
    jwCamera.position.set(0, 0, 2)
    jwScene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.2)
    dirLight.position.set(1, 2, 3)
    jwScene.add(dirLight)
    jewelleryScene.current = jwScene
    perspCameraRef.current = jwCamera

    // ── Background scene (orthographic video plane) ────────
    // Created inside the video-ready callback so texture has valid data
    let bgScene    = null
    let bgCamera   = null
    let videoTexture = null

    const buildBackground = () => {
      if (cancelled) return
      videoTexture = new THREE.VideoTexture(video)
      videoTexture.minFilter  = THREE.LinearFilter
      videoTexture.magFilter  = THREE.LinearFilter
      videoTexture.colorSpace = THREE.SRGBColorSpace

      bgScene  = new THREE.Scene()
      bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const geo = new THREE.PlaneGeometry(2, 2)
      const mat = new THREE.MeshBasicMaterial({ map: videoTexture, depthTest: false, depthWrite: false })
      bgScene.add(new THREE.Mesh(geo, mat))
    }

    // Fire immediately if video is already loaded, otherwise wait
    if (video.readyState >= 2) {
      buildBackground()
    } else {
      video.addEventListener('loadeddata', buildBackground, { once: true })
    }

    // ── Resize ─────────────────────────────────────────────
    const handleResize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      jwCamera.aspect = w / h
      jwCamera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(canvas)
    handleResize()

    // ── Render loop ────────────────────────────────────────
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)

      renderer.clear()

      if (bgScene && bgCamera && videoTexture) {
        videoTexture.needsUpdate = true
        renderer.render(bgScene, bgCamera)
      }

      renderer.clearDepth()
      renderer.render(jwScene, jwCamera)
    }
    loop()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      video.removeEventListener('loadeddata', buildBackground)
      videoTexture?.dispose()
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    sceneRef:    jewelleryScene,
    cameraRef:   perspCameraRef,
    rendererRef,
    addObject,
    removeObject,
  }
}
