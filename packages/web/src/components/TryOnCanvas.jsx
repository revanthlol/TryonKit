import React, { useRef, useEffect } from 'react'
import { useThreeScene }    from '../hooks/useThreeScene'
import { useFaceTracking }  from '../hooks/useFaceTracking'
import { useFaceTransform } from '../hooks/useFaceTransform'
import { createTestCube }   from '../utils/testObject'
import {
  computeEarAnchor,
  applyFaceRotation,
  computeJewelleryScale,
} from '../utils/faceGeometry'
import styles from './TryOnCanvas.module.css'

/**
 * TryOnCanvas — Phase 3
 *
 * The cube now uses the full pseudo-3D face coordinate system:
 *   • Weighted + smoothed ear anchor  → correct position
 *   • Face scale                      → correct size at any distance
 *   • Head yaw / pitch / roll         → cube rotates with the head
 */
export default function TryOnCanvas({ showMesh = true, onLandmarks, onFaceDetected, onTransform }) {
  const videoRef    = useRef(null)
  const threeCanvas = useRef(null)
  const meshCanvas  = useRef(null)
  const cubeRef     = useRef(null)

  const { sceneRef, cameraRef } = useThreeScene(threeCanvas, videoRef)
  const { isReady, faceDetected, landmarks, fps, error } =
    useFaceTracking(videoRef, meshCanvas, { drawMesh: showMesh })
  const { compute: computeTransform } = useFaceTransform()

  // ── Keep landmark canvas sized to Three.js canvas ──────────
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

  // ── Add test cube once on mount ────────────────────────────
  useEffect(() => {
    let timeoutId
    const tryAdd = () => {
      if (sceneRef.current) {
        const cube = createTestCube()
        cubeRef.current = cube
        sceneRef.current.add(cube)
      } else {
        timeoutId = setTimeout(tryAdd, 50)
      }
    }
    tryAdd()

    return () => {
      clearTimeout(timeoutId)
      const cube = cubeRef.current
      if (!cube) return
      cube.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose()
          Array.isArray(child.material)
            ? child.material.forEach(m => m.dispose())
            : child.material?.dispose()
        }
      })
      sceneRef.current?.remove(cube)
      cubeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Phase 3: position cube using face coordinate system ────
  useEffect(() => {
    const cube = cubeRef.current
    const cam  = cameraRef.current
    if (!cube || !cam || !landmarks) return

    // 1. Compute smoothed face transform
    const transform = computeTransform(landmarks)
    if (!transform) return

    // 2. Weighted, stabilised left ear anchor in world space
    const anchor = computeEarAnchor(transform, 'left', cam)

    // 3. Smooth position via lerp
    cube.position.lerp(anchor, 0.3)

    // 4. Apply head rotation so cube tilts with the head
    applyFaceRotation(cube, transform, { yaw: true, pitch: true, roll: true })

    // 5. Scale with face distance — stays same visual size at any depth
    const s = computeJewelleryScale(transform, 1.0)
    cube.scale.setScalar(s)

    // Bubble transform data up for debug panel
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
        <HudPill active={isReady}      label={isReady      ? 'Camera ●' : 'Camera …'} />
        <HudPill active={faceDetected} label={faceDetected ? 'Face ●'   : 'Face ○'}   />
        {isReady && <span className={styles.fps}>{fps} FPS</span>}
      </div>

      {!isReady && !error && (
        <div className={styles.overlay}>
          <div className={styles.spinner} />
          <p>Loading face tracking…</p>
          <p className={styles.overlaySub}>Downloading MediaPipe models (~3 MB)</p>
        </div>
      )}
      {error && (
        <div className={styles.overlay}>
          <span className={styles.errorIcon}>⚠</span>
          <p>{error}</p>
          <p className={styles.overlaySub}>Allow camera access and use localhost.</p>
        </div>
      )}
    </div>
  )
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
