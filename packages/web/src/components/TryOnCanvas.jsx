import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useThreeScene }      from '../hooks/useThreeScene'
import { useFaceTracking }    from '../hooks/useFaceTracking'
import { useFaceTransform }   from '../hooks/useFaceTransform'
import { useJewelleryLoader } from '../hooks/useJewelleryLoader'
import {
  computeEarAnchor,
  applyFaceRotation,
  computeJewelleryScale,
} from '../utils/faceGeometry'
import styles from './TryOnCanvas.module.css'

const DEFAULT_EARRING = '/models/earring-dangling.glb'

/**
 * TryOnCanvas — Phase 4
 *
 * Loads a GLB earring model and places it on both ears.
 * Earrings scale, rotate and translate with the face transform.
 */
export default function TryOnCanvas({
  showMesh    = false,
  earringUrl  = DEFAULT_EARRING,
  onLandmarks,
  onFaceDetected,
  onTransform,
}) {
  const videoRef    = useRef(null)
  const threeCanvas = useRef(null)
  const meshCanvas  = useRef(null)

  // One ref per ear
  const leftEarringRef  = useRef(null)
  const rightEarringRef = useRef(null)

  const [modelLoaded, setModelLoaded] = useState(false)
  const [modelError,  setModelError]  = useState(null)

  const { sceneRef, cameraRef }            = useThreeScene(threeCanvas, videoRef)
  const { isReady, faceDetected, landmarks, fps, error } =
    useFaceTracking(videoRef, meshCanvas, { drawMesh: showMesh })
  const { compute: computeTransform }      = useFaceTransform()
  const { loadModel }                      = useJewelleryLoader()

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

  // ── Load GLB model — create left + right instances ─────────
  useEffect(() => {
    if (!sceneRef.current) return
    let cancelled = false

    const load = async () => {
      try {
        setModelError(null)
        setModelLoaded(false)

        // Load two independent clones for left and right ear
        const [leftModel, rightModel] = await Promise.all([
          loadModel(earringUrl),
          loadModel(earringUrl),
        ])

        if (cancelled) return

        // Name them for easy lookup
        leftModel.name  = 'earring-left'
        rightModel.name = 'earring-right'

        // Mirror the right earring on X axis
        rightModel.scale.x = -1

        // Start off-screen until first landmark arrives
        leftModel.position.set(0, -10, 0)
        rightModel.position.set(0, -10, 0)

        sceneRef.current.add(leftModel)
        sceneRef.current.add(rightModel)

        leftEarringRef.current  = leftModel
        rightEarringRef.current = rightModel

        setModelLoaded(true)
      } catch (err) {
        if (!cancelled) {
          console.error('GLB load error:', err)
          setModelError('Failed to load earring model')
        }
      }
    }

    // Wait for scene to be ready
    const tryLoad = () => {
      if (sceneRef.current) load()
      else setTimeout(tryLoad, 50)
    }
    tryLoad()

    return () => {
      cancelled = true
      // Remove and dispose both earrings
      ;[leftEarringRef, rightEarringRef].forEach((ref) => {
        const model = ref.current
        if (!model) return
        model.traverse((child) => {
          if (child.isMesh) {
            child.geometry?.dispose()
            Array.isArray(child.material)
              ? child.material.forEach(m => m.dispose())
              : child.material?.dispose()
          }
        })
        sceneRef.current?.remove(model)
        ref.current = null
      })
      setModelLoaded(false)
    }
  // Reload when earring URL changes (product switching — Phase 6)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earringUrl, !!sceneRef.current])

  // ── Position earrings every frame ─────────────────────────
  useEffect(() => {
    const left  = leftEarringRef.current
    const right = rightEarringRef.current
    const cam   = cameraRef.current
    if (!left || !right || !cam || !landmarks) return

    const transform = computeTransform(landmarks)
    if (!transform) return

    // ── Left ear ──────────────────────────────────────────
    const leftAnchor = computeEarAnchor(transform, 'left', cam)
    left.position.lerp(leftAnchor, 0.35)
    applyFaceRotation(left, transform)

    // ── Right ear ─────────────────────────────────────────
    const rightAnchor = computeEarAnchor(transform, 'right', cam)
    right.position.lerp(rightAnchor, 0.35)
    // Right ear: mirror yaw, same pitch+roll
    right.rotation.z = -transform.roll
    right.rotation.y = -transform.yaw  * 0.6   // mirrored
    right.rotation.x =  transform.pitch * 0.5

    // ── Scale both to face distance ───────────────────────
    const s = computeJewelleryScale(transform, 1.0)
    left.scale.set(s, s, s)
    right.scale.set(-s, s, s)   // keep X negative for mirror

    onTransform?.(transform)
  }, [landmarks, cameraRef, computeTransform, onTransform])

  useEffect(() => { onLandmarks?.(landmarks)       }, [landmarks,    onLandmarks])
  useEffect(() => { onFaceDetected?.(faceDetected) }, [faceDetected, onFaceDetected])

  return (
    <div className={styles.root}>
      <video ref={videoRef} className={styles.hiddenVideo} autoPlay muted playsInline />
      <canvas ref={threeCanvas} className={styles.threeCanvas} />
      <canvas ref={meshCanvas}  className={styles.meshCanvas}  />

      {/* HUD */}
      <div className={styles.hud}>
        <HudPill active={isReady}      label={isReady      ? 'Camera ●' : 'Camera …'} />
        <HudPill active={faceDetected} label={faceDetected ? 'Face ●'   : 'Face ○'}   />
        <HudPill active={modelLoaded}  label={modelLoaded  ? 'Model ●'  : 'Model …'}  />
        {isReady && <span className={styles.fps}>{fps} FPS</span>}
      </div>

      {/* Loading overlay */}
      {(!isReady || !modelLoaded) && !error && !modelError && (
        <div className={styles.overlay}>
          <div className={styles.spinner} />
          <p>{!isReady ? 'Loading face tracking…' : 'Loading earring model…'}</p>
          <p className={styles.overlaySub}>
            {!isReady ? 'Downloading MediaPipe models' : 'Parsing GLB geometry'}
          </p>
        </div>
      )}

      {(error || modelError) && (
        <div className={styles.overlay}>
          <span className={styles.errorIcon}>⚠</span>
          <p>{error || modelError}</p>
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
