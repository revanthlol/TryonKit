import React, { useRef, useEffect, useState } from 'react'
import { useThreeScene }      from '../hooks/useThreeScene'
import { useFaceTracking }    from '../hooks/useFaceTracking'
import { useFaceTransform }   from '../hooks/useFaceTransform'
import { useJewelleryLoader } from '../hooks/useJewelleryLoader'
import {
  computeEarAnchor,
  computeNoseAnchor,
  computeNeckAnchor,
  applyFaceRotation,
  computeJewelleryScale,
  isEarVisible,
} from '../utils/faceGeometry'
import styles from './TryOnCanvas.module.css'

/**
 * TryOnCanvas — Phase 5+6
 *
 * Supports earrings (both ears), necklace, nose ring simultaneously.
 * Models are pre-normalized so per-type multipliers control relative size.
 */
export default function TryOnCanvas({
  showMesh    = false,
  earringUrl  = null,
  necklaceUrl = null,
  noseRingUrl = null,
  onLandmarks,
  onFaceDetected,
  onTransform,
}) {
  const videoRef    = useRef(null)
  const threeCanvas = useRef(null)
  const meshCanvas  = useRef(null)

  const leftEarRef  = useRef(null)
  const rightEarRef = useRef(null)
  const necklaceRef = useRef(null)
  const noseRef     = useRef(null)

  const [status, setStatus] = useState({ camera: false, face: false })

  const { sceneRef, cameraRef }                               = useThreeScene(threeCanvas, videoRef)
  const { isReady, faceDetected, landmarks, fps, error }      = useFaceTracking(videoRef, meshCanvas, { drawMesh: showMesh })
  const { compute: computeTransform }                         = useFaceTransform()
  const { loadModel }                                         = useJewelleryLoader()

  useEffect(() => setStatus(s => ({ ...s, camera: isReady })),      [isReady])
  useEffect(() => setStatus(s => ({ ...s, face: faceDetected })),   [faceDetected])

  // ── Keep landmark canvas sized ──────────────────────────────
  useEffect(() => {
    const three = threeCanvas.current
    const mesh  = meshCanvas.current
    if (!three || !mesh) return
    const ro = new ResizeObserver(() => {
      mesh.width  = three.clientWidth
      mesh.height = three.clientHeight
    })
    ro.observe(three)
    return () => ro.disconnect()
  }, [])

  // ── Generic model slot loader ──────────────────────────────
  const loadSlot = async (url, ref, scene, mirror = false) => {
    if (ref.current) {
      disposeModel(ref.current)
      scene.remove(ref.current)
      ref.current = null
    }
    if (!url) return

    const model = await loadModel(url)
    model.visible = false
    model.position.set(0, -10, 0)
    if (mirror) model.scale.x = -1
    scene.add(model)
    ref.current = model
  }

  const waitForScene = (cb) => {
    if (sceneRef.current) cb(sceneRef.current)
    else setTimeout(() => waitForScene(cb), 50)
  }

  // ── Load earrings ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    waitForScene(async (scene) => {
      try {
        await Promise.all([
          loadSlot(earringUrl, leftEarRef,  scene, false),
          loadSlot(earringUrl, rightEarRef, scene, true),
        ])
      } catch (e) { console.error('Earring load error:', e) }
    })
    return () => {
      cancelled = true
      if (sceneRef.current) {
        ;[leftEarRef, rightEarRef].forEach(r => {
          if (r.current) { disposeModel(r.current); sceneRef.current.remove(r.current); r.current = null }
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earringUrl])

  // ── Load necklace ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    waitForScene(async (scene) => {
      try {
        await loadSlot(necklaceUrl, necklaceRef, scene, false)
      } catch (e) { console.error('Necklace load error:', e) }
    })
    return () => {
      cancelled = true
      if (necklaceRef.current && sceneRef.current) {
        disposeModel(necklaceRef.current)
        sceneRef.current.remove(necklaceRef.current)
        necklaceRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [necklaceUrl])

  // ── Load nose ring ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    waitForScene(async (scene) => {
      try {
        await loadSlot(noseRingUrl, noseRef, scene, false)
      } catch (e) { console.error('Nose ring load error:', e) }
    })
    return () => {
      cancelled = true
      if (noseRef.current && sceneRef.current) {
        disposeModel(noseRef.current)
        sceneRef.current.remove(noseRef.current)
        noseRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noseRingUrl])

  // ── Position all jewellery every frame ─────────────────────
  useEffect(() => {
    const cam = cameraRef.current
    if (!cam || !landmarks) return

    const transform = computeTransform(landmarks)
    if (!transform) return

    const s = computeJewelleryScale(transform, 1.0)

    // ── Earrings ──
    const leftEar  = leftEarRef.current
    const rightEar = rightEarRef.current
    const earScale = s * 1.8

    if (leftEar) {
      const vis = isEarVisible(transform, 'left')
      leftEar.visible = vis > 0
      if (vis > 0) {
        setOpacity(leftEar, vis)
        leftEar.position.lerp(computeEarAnchor(transform, 'left', cam), 0.5)
        applyFaceRotation(leftEar, transform)
        leftEar.scale.set(earScale, earScale, earScale)
      }
    }

    if (rightEar) {
      const vis = isEarVisible(transform, 'right')
      rightEar.visible = vis > 0
      if (vis > 0) {
        setOpacity(rightEar, vis)
        rightEar.position.lerp(computeEarAnchor(transform, 'right', cam), 0.5)
        applyFaceRotation(rightEar, transform)
        rightEar.scale.set(-earScale, earScale, earScale)
      }
    }

    // ── Necklace ──
    const necklace = necklaceRef.current
    if (necklace) {
      const neckScale = s * 2.0
      necklace.visible = true
      necklace.position.lerp(computeNeckAnchor(transform, cam), 0.35)
      applyFaceRotation(necklace, transform, { yaw: true, pitch: false, roll: true })
      necklace.scale.setScalar(neckScale)
    }

    // ── Nose ring ──
    const nose = noseRef.current
    if (nose) {
      const noseScale = s * 1.8
      nose.visible = true
      nose.position.lerp(computeNoseAnchor(transform, 'left', cam), 0.5)
      applyFaceRotation(nose, transform)
      nose.scale.setScalar(noseScale)
    }

    onTransform?.(transform)
  }, [landmarks, cameraRef, computeTransform, onTransform])

  useEffect(() => { onLandmarks?.(landmarks)       }, [landmarks,    onLandmarks])
  useEffect(() => { onFaceDetected?.(faceDetected) }, [faceDetected, onFaceDetected])

  return (
    <div className={styles.root}>
      <video ref={videoRef} className={styles.hiddenVideo} autoPlay muted playsInline />
      <canvas ref={threeCanvas} className={styles.threeCanvas} />
      <canvas ref={meshCanvas}  className={styles.meshCanvas}  />

      <div className={styles.hud}>
        <HudPill active={status.camera} label={status.camera ? 'Camera' : 'Camera …'} />
        <HudPill active={status.face}   label={status.face   ? 'Face'   : 'No face'}  />
        {isReady && <span className={styles.fps}>{fps} FPS</span>}
      </div>

      {!isReady && !error && (
        <div className={styles.overlay}>
          <div className={styles.spinner} />
          <p>Loading face tracking</p>
          <p className={styles.overlaySub}>Downloading MediaPipe models</p>
        </div>
      )}
      {error && (
        <div className={styles.overlay}>
          <span className={styles.errorIcon}>!</span>
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function setOpacity(model, opacity) {
  model.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.transparent = opacity < 1
      child.material.opacity     = opacity
    }
  })
}

function disposeModel(model) {
  model.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose()
      Array.isArray(child.material)
        ? child.material.forEach(m => m.dispose())
        : child.material?.dispose()
    }
  })
}

function HudPill({ active, label }) {
  return (
    <span className={styles.hudPill} style={{
      color:       active ? 'var(--color-accent-2)' : 'var(--color-muted)',
      borderColor: active ? 'rgba(201,168,76,0.3)'  : 'var(--color-border)',
    }}>
      {label}
    </span>
  )
}
