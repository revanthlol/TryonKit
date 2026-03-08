import React, { useRef, useEffect } from 'react'
import { useFaceTracking } from '../hooks/useFaceTracking'
import styles from './CameraView.module.css'

/**
 * CameraView — Phase 1
 *
 * Renders the webcam feed + landmark mesh overlay.
 * The video is mirrored (selfie view). The canvas sits on top.
 */
export default function CameraView({ onLandmarks, onFaceDetected }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)

  const { isReady, faceDetected, landmarks, fps, error } = useFaceTracking(
    videoRef,
    canvasRef,
    { drawMesh: true }
  )

  // Sync canvas size to video element dimensions
  useEffect(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const sync = () => {
      canvas.width  = video.videoWidth  || video.clientWidth
      canvas.height = video.videoHeight || video.clientHeight
    }

    video.addEventListener('loadedmetadata', sync)
    video.addEventListener('resize', sync)
    // Also sync when the element is first laid out
    const ro = new ResizeObserver(sync)
    ro.observe(video)

    return () => {
      video.removeEventListener('loadedmetadata', sync)
      video.removeEventListener('resize', sync)
      ro.disconnect()
    }
  }, [])

  // Bubble state up to parent
  useEffect(() => { onLandmarks?.(landmarks)       }, [landmarks,    onLandmarks])
  useEffect(() => { onFaceDetected?.(faceDetected) }, [faceDetected, onFaceDetected])

  return (
    <div className={styles.cameraRoot}>
      {/* Status bar */}
      <div className={styles.statusBar}>
        <StatusDot active={isReady} label={isReady ? 'Camera active' : 'Starting camera…'} />
        <StatusDot active={faceDetected} label={faceDetected ? 'Face detected' : 'No face'} />
        {isReady && <span className={styles.fps}>{fps} FPS</span>}
      </div>

      {/* Video + canvas stack */}
      <div className={styles.viewportWrapper}>
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className={styles.canvas}
        />

        {/* Loading overlay */}
        {!isReady && !error && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>Loading face tracking…</p>
            <p className={styles.loadingSub}>MediaPipe models downloading (~3 MB)</p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className={styles.errorOverlay}>
            <span className={styles.errorIcon}>⚠</span>
            <p>{error}</p>
            <p className={styles.errorSub}>
              Make sure you allowed camera access and are using HTTPS or localhost.
            </p>
          </div>
        )}

        {/* Face detection indicator */}
        {isReady && (
          <div className={`${styles.faceIndicator} ${faceDetected ? styles.faceIndicatorActive : ''}`}>
            {faceDetected ? '◉ Face locked' : '◎ Scan your face'}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusDot({ active, label }) {
  return (
    <span className={styles.statusDot}>
      <span
        className={styles.dot}
        style={{ background: active ? 'var(--color-accent)' : 'var(--color-muted)' }}
      />
      {label}
    </span>
  )
}
