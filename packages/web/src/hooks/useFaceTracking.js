import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useFaceTracking — Phase 1
 *
 * Initializes MediaPipe FaceMesh and drives the detection loop.
 *
 * @param {React.RefObject} videoRef  — ref to the <video> element
 * @param {React.RefObject} canvasRef — ref to the overlay <canvas>
 * @param {object}          options
 * @param {boolean}         options.drawMesh   — render landmark mesh
 * @param {boolean}         options.drawAxes   — render orientation axes
 *
 * Returns:
 *   isReady      — MediaPipe loaded and camera running
 *   faceDetected — at least one face in the current frame
 *   landmarks    — raw 468-point array (or null)
 *   fps          — current frames per second
 *   error        — string | null
 */
export function useFaceTracking(videoRef, canvasRef, {
  drawMesh = true,
  drawAxes = false,
} = {}) {
  const faceMeshRef   = useRef(null)
  const cameraRef     = useRef(null)
  const animFrameRef  = useRef(null)
  const lastTimeRef   = useRef(performance.now())
  const frameCountRef = useRef(0)

  const [isReady,      setIsReady]      = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [landmarks,    setLandmarks]    = useState(null)
  const [fps,          setFps]          = useState(0)
  const [error,        setError]        = useState(null)

  // ── Draw helpers ──────────────────────────────────────────
  const drawLandmarks = useCallback((ctx, lms, w, h) => {
    // Thin connection lines
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.25)'
    ctx.lineWidth   = 0.5

    FACE_MESH_CONNECTIONS.forEach(([a, b]) => {
      const p1 = lms[a]
      const p2 = lms[b]
      if (!p1 || !p2) return
      ctx.beginPath()
      ctx.moveTo(p1.x * w, p1.y * h)
      ctx.lineTo(p2.x * w, p2.y * h)
      ctx.stroke()
    })

    // Landmark dots — highlight key anchor points
    lms.forEach((lm, i) => {
      const isAnchor = KEY_LANDMARKS.includes(i)
      ctx.beginPath()
      ctx.arc(lm.x * w, lm.y * h, isAnchor ? 3 : 1, 0, Math.PI * 2)
      ctx.fillStyle = isAnchor
        ? 'rgba(232, 201, 126, 0.95)'
        : 'rgba(201, 168, 76, 0.4)'
      ctx.fill()
    })
  }, [])

  // ── FPS counter ───────────────────────────────────────────
  const updateFps = useCallback(() => {
    frameCountRef.current++
    const now     = performance.now()
    const elapsed = now - lastTimeRef.current
    if (elapsed >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / elapsed))
      frameCountRef.current = 0
      lastTimeRef.current   = now
    }
  }, [])

  // ── MediaPipe result handler ───────────────────────────────
  const onResults = useCallback((results) => {
    updateFps()

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const w   = canvas.width
    const h   = canvas.height

    ctx.clearRect(0, 0, w, h)

    const detected = !!(results.multiFaceLandmarks?.length)
    setFaceDetected(detected)

    if (!detected) {
      setLandmarks(null)
      return
    }

    const lms = results.multiFaceLandmarks[0]
    setLandmarks(lms)

    if (drawMesh) {
      drawLandmarks(ctx, lms, w, h)
    }
  }, [canvasRef, drawMesh, drawLandmarks, updateFps])

  // ── Initialise MediaPipe + camera ─────────────────────────
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return

    let cancelled = false

    const init = async () => {
      try {
        // Dynamic import — MediaPipe is loaded from CDN via the package
        const { FaceMesh } = await import('@mediapipe/face_mesh')
        const { Camera }   = await import('@mediapipe/camera_utils')

        if (cancelled) return

        const faceMesh = new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        })

        faceMesh.setOptions({
          maxNumFaces:          1,
          refineLandmarks:      true,   // enables iris landmarks
          minDetectionConfidence: 0.6,
          minTrackingConfidence:  0.6,
        })

        faceMesh.onResults(onResults)

        await faceMesh.initialize()
        if (cancelled) return

        faceMeshRef.current = faceMesh

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (faceMeshRef.current && videoRef.current) {
              await faceMeshRef.current.send({ image: videoRef.current })
            }
          },
          width:  1280,
          height: 720,
          facingMode: 'user',
        })

        await camera.start()
        if (cancelled) return

        cameraRef.current = camera
        setIsReady(true)
      } catch (err) {
        if (!cancelled) {
          console.error('FaceTracking init error:', err)
          setError(err.message || 'Failed to initialize face tracking')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      cameraRef.current?.stop()
      faceMeshRef.current?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isReady, faceDetected, landmarks, fps, error }
}

// ── Key anchor landmark indices ────────────────────────────
// Highlighted in gold on the overlay
const KEY_LANDMARKS = [
  4,    // Nose tip
  234,  // Left ear
  454,  // Right ear
  177,  // Left ear lobe
  401,  // Right ear lobe
  152,  // Chin
  10,   // Forehead center
  48,   // Left nostril
  278,  // Right nostril
]

// ── FaceMesh connection pairs (abridged for performance) ────
// Full set from MediaPipe. Each pair = [from, to].
export const FACE_MESH_CONNECTIONS = [
  // Silhouette
  [10,338],[338,297],[297,332],[332,284],[284,251],[251,389],[389,356],
  [356,454],[454,323],[323,361],[361,288],[288,397],[397,365],[365,379],
  [379,378],[378,400],[400,377],[377,152],[152,148],[148,176],[176,149],
  [149,150],[150,136],[136,172],[172,58],[58,132],[132,93],[93,234],
  [234,127],[127,162],[162,21],[21,54],[54,103],[103,67],[67,109],[109,10],
  // Left eye
  [33,7],[7,163],[163,144],[144,145],[145,153],[153,154],[154,155],
  [155,133],[133,173],[173,157],[157,158],[158,159],[159,160],[160,161],
  [161,246],[246,33],
  // Right eye
  [263,249],[249,390],[390,373],[373,374],[374,380],[380,381],[381,382],
  [382,362],[362,398],[398,384],[384,385],[385,386],[386,387],[387,388],
  [388,466],[466,263],
  // Lips outer
  [61,146],[146,91],[91,181],[181,84],[84,17],[17,314],[314,405],
  [405,321],[321,375],[375,291],[61,185],[185,40],[40,39],[39,37],
  [37,0],[0,267],[267,269],[269,270],[270,409],[409,291],
  // Lips inner
  [78,95],[95,88],[88,178],[178,87],[87,14],[14,317],[317,402],
  [402,318],[318,324],[324,308],[78,191],[191,80],[80,81],[81,82],
  [82,13],[13,312],[312,311],[311,310],[310,415],[415,308],
  // Nose
  [168,6],[6,197],[197,195],[195,5],[5,4],[4,45],[45,220],
  [220,115],[115,48],[48,64],[64,98],[98,97],[97,2],[2,326],
  [326,327],[327,294],[294,278],[278,440],[440,344],[344,278],
  // Left brow
  [276,283],[283,282],[282,295],[295,285],[300,293],[293,334],[334,296],[296,336],
  // Right brow
  [46,53],[53,52],[52,65],[65,55],[70,63],[63,105],[105,66],[66,107],
]
