import { useEffect, useRef, useState, useCallback } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

/**
 * useFaceTracking — rebuilt on @mediapipe/tasks-vision
 *
 * @mediapipe/face_mesh (0.4.1633559619) is abandoned and crashes
 * on modern browsers with "Module.arguments has been replaced".
 *
 * @mediapipe/tasks-vision is Google's current package — actively
 * maintained, works in all modern browsers, same 468 landmarks.
 *
 * API differences:
 *   Old: FaceMesh + Camera classes, callback-based
 *   New: FaceLandmarker, runs detectForVideo() in a rAF loop
 */
export function useFaceTracking(videoRef, canvasRef, { drawMesh = true } = {}) {
  const landmarkerRef = useRef(null)
  const streamRef     = useRef(null)
  const rafRef        = useRef(null)
  const drawMeshRef   = useRef(drawMesh)
  const lastVideoTimeRef = useRef(-1)
  const lastTimeRef   = useRef(performance.now())
  const frameCountRef = useRef(0)
  const runningRef    = useRef(false)
  const presenceRef   = useRef({ hits: 0, misses: 0, detected: false })

  const [isReady,      setIsReady]      = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [landmarks,    setLandmarks]    = useState(null)
  const [fps,          setFps]          = useState(0)
  const [error,        setError]        = useState(null)

  // ── FPS ───────────────────────────────────────────────────
  const updateFps = useCallback(() => {
    frameCountRef.current++
    const now = performance.now()
    const elapsed = now - lastTimeRef.current
    if (elapsed >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / elapsed))
      frameCountRef.current = 0
      lastTimeRef.current = now
    }
  }, [])

  // ── Draw mesh ─────────────────────────────────────────────
  const drawLandmarks = useCallback((ctx, lms, w, h) => {
    ctx.strokeStyle = 'rgba(201,168,76,0.25)'
    ctx.lineWidth   = 0.5
    FACE_MESH_CONNECTIONS.forEach(([a, b]) => {
      const p1 = lms[a]; const p2 = lms[b]
      if (!p1 || !p2) return
      ctx.beginPath()
      ctx.moveTo(p1.x * w, p1.y * h)
      ctx.lineTo(p2.x * w, p2.y * h)
      ctx.stroke()
    })
    lms.forEach((lm, i) => {
      const isAnchor = KEY_LANDMARKS.includes(i)
      ctx.beginPath()
      ctx.arc(lm.x * w, lm.y * h, isAnchor ? 3 : 1, 0, Math.PI * 2)
      ctx.fillStyle = isAnchor ? 'rgba(232,201,126,0.95)' : 'rgba(201,168,76,0.4)'
      ctx.fill()
    })
  }, [])

  // Keep mesh toggle live without restarting the detection loop
  useEffect(() => {
    drawMeshRef.current = drawMesh
    if (!drawMesh) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [drawMesh, canvasRef])

  // ── Detection loop ────────────────────────────────────────
  const detect = useCallback(() => {
    if (!runningRef.current) return

    const video  = videoRef.current
    const canvas = canvasRef.current
    const lander = landmarkerRef.current

    if (!video || !canvas || !lander || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect)
      return
    }

    // Skip duplicate video frames to reduce unnecessary inference
    if (video.currentTime === lastVideoTimeRef.current) {
      rafRef.current = requestAnimationFrame(detect)
      return
    }
    lastVideoTimeRef.current = video.currentTime

    // tasks-vision uses timestamp-based detection
    const results = lander.detectForVideo(video, performance.now())

    updateFps()

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const detected = !!(results.faceLandmarks?.length)
    const presence = presenceRef.current
    if (detected) {
      presence.hits += 1
      presence.misses = 0
    } else {
      presence.hits = 0
      presence.misses += 1
    }

    // Hysteresis to avoid rapid face/no-face flicker on edge frames
    if (!presence.detected && presence.hits >= 2) presence.detected = true
    if (presence.detected && presence.misses >= 4) presence.detected = false

    setFaceDetected(presence.detected)

    if (!detected) {
      setLandmarks(null)
    } else {
      // tasks-vision returns {x,y,z} objects — same structure as FaceMesh
      const lms = results.faceLandmarks[0]
      setLandmarks(lms)
      if (drawMeshRef.current) drawLandmarks(ctx, lms, canvas.width, canvas.height)
    }

    rafRef.current = requestAnimationFrame(detect)
  }, [videoRef, canvasRef, drawLandmarks, updateFps])

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return
    let cancelled = false

    const init = async () => {
      try {
        // Load the WASM runtime from the package's own assets
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )

        if (cancelled) return

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode:           'VIDEO',
          numFaces:              1,
          minFaceDetectionConfidence: 0.6,
          minFacePresenceConfidence:  0.6,
          minTrackingConfidence:      0.6,
          outputFaceBlendshapes:  false,
          outputFacialTransformationMatrixes: false,
        })

        if (cancelled) return

        landmarkerRef.current = landmarker

        // Start camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        runningRef.current = true
        presenceRef.current = { hits: 0, misses: 0, detected: false }
        setIsReady(true)
        rafRef.current = requestAnimationFrame(detect)

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
      runningRef.current = false
      lastVideoTimeRef.current = -1
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      landmarkerRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isReady, faceDetected, landmarks, fps, error }
}

const KEY_LANDMARKS = [4, 234, 454, 177, 401, 152, 10, 48, 278]

export const FACE_MESH_CONNECTIONS = [
  [10,338],[338,297],[297,332],[332,284],[284,251],[251,389],[389,356],
  [356,454],[454,323],[323,361],[361,288],[288,397],[397,365],[365,379],
  [379,378],[378,400],[400,377],[377,152],[152,148],[148,176],[176,149],
  [149,150],[150,136],[136,172],[172,58],[58,132],[132,93],[93,234],
  [234,127],[127,162],[162,21],[21,54],[54,103],[103,67],[67,109],[109,10],
  [33,7],[7,163],[163,144],[144,145],[145,153],[153,154],[154,155],
  [155,133],[133,173],[173,157],[157,158],[158,159],[159,160],[160,161],
  [161,246],[246,33],
  [263,249],[249,390],[390,373],[373,374],[374,380],[380,381],[381,382],
  [382,362],[362,398],[398,384],[384,385],[385,386],[386,387],[387,388],
  [388,466],[466,263],
  [61,146],[146,91],[91,181],[181,84],[84,17],[17,314],[314,405],
  [405,321],[321,375],[375,291],[61,185],[185,40],[40,39],[39,37],
  [37,0],[0,267],[267,269],[269,270],[270,409],[409,291],
  [78,95],[95,88],[88,178],[178,87],[87,14],[14,317],[317,402],
  [402,318],[318,324],[324,308],[78,191],[191,80],[80,81],[81,82],
  [82,13],[13,312],[312,311],[311,310],[310,415],[415,308],
  [168,6],[6,197],[197,195],[195,5],[5,4],[4,45],[45,220],
  [220,115],[115,48],[48,64],[64,98],[98,97],[97,2],[2,326],
  [326,327],[327,294],[294,278],[278,440],[440,344],[344,278],
]
