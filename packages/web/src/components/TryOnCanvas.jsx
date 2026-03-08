import React, { useRef, useEffect, useState } from 'react'
import { useThreeScene }      from '../hooks/useThreeScene'
import { useFaceTracking }    from '../hooks/useFaceTracking'
import { useFaceTransform }   from '../hooks/useFaceTransform'
import { useJewelleryLoader } from '../hooks/useJewelleryLoader'
import {
  computeEarAnchor,
  applyFaceRotation,
  computeJewelleryScale,
  isEarVisible,
} from '../utils/faceGeometry'
import styles from './TryOnCanvas.module.css'

const DEFAULT_EARRING = '/models/earring-dangling.glb'

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
  const leftRef     = useRef(null)
  const rightRef    = useRef(null)

  const [modelLoaded, setModelLoaded] = useState(false)
  const [modelError,  setModelError]  = useState(null)

  const { sceneRef, cameraRef }                         = useThreeScene(threeCanvas, videoRef)
  const { isReady, faceDetected, landmarks, fps, error } = useFaceTracking(videoRef, meshCanvas, { drawMesh: showMesh })
  const { compute: computeTransform }                   = useFaceTransform()
  const { loadModel }                                   = useJewelleryLoader()

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

  // ── Load GLB — two independent clones ─────────────────────
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setModelError(null)
        setModelLoaded(false)

        const [leftModel, rightModel] = await Promise.all([
          loadModel(earringUrl),
          loadModel(earringUrl),
        ])

        if (cancelled) return

        leftModel.name  = 'earring-left'
        rightModel.name = 'earring-right'

        // Start hidden off-screen
        leftModel.position.set(0, -10, 0)
        rightModel.position.set(0, -10, 0)

        // Right earring is physically mirrored
        rightModel.scale.x = -1

        // Hide until face detected
        leftModel.visible  = false
        rightModel.visible = false

        const waitForScene = () => {
          if (sceneRef.current) {
            sceneRef.current.add(leftModel)
            sceneRef.current.add(rightModel)
            leftRef.current  = leftModel
            rightRef.current = rightModel
            setModelLoaded(true)
          } else {
            setTimeout(waitForScene, 50)
          }
        }
        waitForScene()

      } catch (err) {
        if (!cancelled) {
          console.error('GLB load error:', err)
          setModelError('Failed to load earring model')
        }
      }
    }

    load()

    return () => {
      cancelled = true
      ;[leftRef, rightRef].forEach((ref) => {
        const m = ref.current
        if (!m) return
        m.traverse((child) => {
          if (child.isMesh) {
            child.geometry?.dispose()
            Array.isArray(child.material)
              ? child.material.forEach(x => x.dispose())
              : child.material?.dispose()
          }
        })
        sceneRef.current?.remove(m)
        ref.current = null
      })
      setModelLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earringUrl])

  // ── Position + cull earrings every frame ───────────────────
  useEffect(() => {
    const left  = leftRef.current
    const right = rightRef.current
    const cam   = cameraRef.current
    if (!left || !right || !cam || !landmarks) return

    const transform = computeTransform(landmarks)
    if (!transform) return

    const s = computeJewelleryScale(transform, 1.0)

    // ── LEFT ear ──────────────────────────────────────────
    const leftVis = isEarVisible(transform, 'left')
    if (leftVis <= 0) {
      left.visible = false
    } else {
      left.visible = true
      // Smoothly set opacity on all meshes for fade
      left.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = leftVis < 1
          child.material.opacity     = leftVis
        }
      })
      const leftAnchor = computeEarAnchor(transform, 'left', cam)
      left.position.lerp(leftAnchor, 0.35)
      applyFaceRotation(left, transform)
      left.scale.set(s, s, s)
    }

    // ── RIGHT ear ─────────────────────────────────────────
    const rightVis = isEarVisible(transform, 'right')
    if (rightVis <= 0) {
      right.visible = false
    } else {
      right.visible = true
      right.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = rightVis < 1
          child.material.opacity     = rightVis
        }
      })
      const rightAnchor = computeEarAnchor(transform, 'right', cam)
      right.position.lerp(rightAnchor, 0.35)
      right.rotation.z = -transform.roll
      right.rotation.y = -transform.yaw   * 0.6
      right.rotation.x =  transform.pitch * 0.5
      right.scale.set(-s, s, s)
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
        <HudPill active={isReady}      label={isReady      ? 'Camera ●' : 'Camera …'} />
        <HudPill active={faceDetected} label={faceDetected ? 'Face ●'   : 'Face ○'}   />
        <HudPill active={modelLoaded}  label={modelLoaded  ? 'Model ●'  : 'Model …'}  />
        {isReady && <span className={styles.fps}>{fps} FPS</span>}
      </div>

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
