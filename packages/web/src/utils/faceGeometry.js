import * as THREE from 'three'

/**
 * faceGeometry.js — Phase 3 (fixed)
 *
 * Fix 1: Ear anchor now uses landmark 234 (left ear tragus — the
 *         cartilage notch at the ear opening). This is the most
 *         reliably tracked ear point in MediaPipe FaceMesh.
 *         Landmark 177 was jaw/cheek — wrong point entirely.
 *
 * Fix 2: computeJewelleryScale multiplier raised from 0.22 → 1.4
 *         so the object is actually visible at normal distances.
 */

// ── Landmark indices ──────────────────────────────────────────
const L_EAR      = 234   // left ear tragus  ← primary attach point
const R_EAR      = 454   // right ear tragus
const L_JAW_LOW  = 132   // lower jaw near left ear  (stabiliser)
const R_JAW_LOW  = 361   // lower jaw near right ear (stabiliser)
const NOSE_TIP   = 4
const L_NOSTRIL  = 48
const R_NOSTRIL  = 278
const CHIN       = 152
const FOREHEAD   = 10
const L_JAW      = 172
const R_JAW      = 397

// ── Helpers ───────────────────────────────────────────────────
function dist2D(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

function blend(a, b, t = 0.5) {
  return {
    x: a.x * (1 - t) + b.x * t,
    y: a.y * (1 - t) + b.y * t,
    z: a.z * (1 - t) + b.z * t,
  }
}

// ─────────────────────────────────────────────────────────────
//  computeFaceTransform
// ─────────────────────────────────────────────────────────────
export function computeFaceTransform(landmarks) {
  const leftEar  = landmarks[L_EAR]
  const rightEar = landmarks[R_EAR]
  const noseTip  = landmarks[NOSE_TIP]
  const chin     = landmarks[CHIN]
  const forehead = landmarks[FOREHEAD]

  const faceWidth  = dist2D(leftEar, rightEar)
  const faceHeight = dist2D(forehead, chin)
  const center     = blend(leftEar, rightEar)

  // Roll — tilt of the ear-to-ear axis
  const roll = Math.atan2(
    rightEar.y - leftEar.y,
    rightEar.x - leftEar.x
  )

  // Yaw — nose deviation from face center
  const noseDeviation = (noseTip.x - center.x) / (faceWidth * 0.5 + 1e-6)
  const yaw = noseDeviation * (Math.PI / 2.5)

  // Pitch — nose z + vertical deviation
  const noseCenterY = (forehead.y + chin.y) * 0.5
  const pitchFromY  = (noseTip.y - noseCenterY) / (faceHeight * 0.5 + 1e-6)
  const pitchFromZ  = -noseTip.z * 2.5
  const pitch       = (pitchFromY * 0.4 + pitchFromZ * 0.6) * (Math.PI / 4)

  // Depth approximation
  const TYPICAL_FACE_WIDTH = 0.35
  const depth = (faceWidth - TYPICAL_FACE_WIDTH) * 0.8

  return {
    center, faceWidth, faceHeight,
    roll, yaw, pitch, depth,
    _lms: landmarks,
  }
}

// ─────────────────────────────────────────────────────────────
//  landmarkToWorld
// ─────────────────────────────────────────────────────────────
export function landmarkToWorld(lm, camera) {
  // No x-flip here — the CSS scaleX(-1) on the canvas handles mirroring
  const ndcX =  lm.x * 2 - 1
  const ndcY = -lm.y * 2 + 1

  const vec  = new THREE.Vector3(ndcX, ndcY, 0.5)
  vec.unproject(camera)
  const dir  = vec.clone().sub(camera.position).normalize()
  const dist = -camera.position.z / dir.z
  return camera.position.clone().add(dir.multiplyScalar(dist))
}

// ─────────────────────────────────────────────────────────────
//  computeEarAnchor
//
//  Uses landmark 234 (left ear tragus) as the base.
//  Blends lightly with the lower-jaw neighbour (132) for
//  stability — but 80% weight stays on the ear itself so
//  the anchor doesn't drift toward the cheek.
//
//  A downward offset is applied so the jewellery hangs
//  below the tragus, where the lobe sits.
// ─────────────────────────────────────────────────────────────
export function computeEarAnchor(transform, side, camera) {
  const { _lms, faceWidth } = transform

  const earIdx = side === 'left' ? L_EAR     : R_EAR
  const jawIdx = side === 'left' ? L_JAW_LOW : R_JAW_LOW

  const ear = _lms[earIdx]
  const jaw = _lms[jawIdx]

  // 80 % ear, 20 % jaw neighbour — stays close to ear
  const blended = blend(ear, jaw, 0.2)

  const worldPos = landmarkToWorld(blended, camera)

  // Drop the jewellery downward to simulate lobe position.
  // The offset scales with face size so it's consistent at all distances.
  worldPos.y -= faceWidth * 0.18

  return worldPos
}

// ─────────────────────────────────────────────────────────────
//  computeNoseAnchor
// ─────────────────────────────────────────────────────────────
export function computeNoseAnchor(transform, side = 'left', camera) {
  const { _lms } = transform
  const nostril = _lms[side === 'left' ? L_NOSTRIL : R_NOSTRIL]
  const nose    = _lms[NOSE_TIP]
  return landmarkToWorld(blend(nostril, nose, 0.35), camera)
}

// ─────────────────────────────────────────────────────────────
//  computeNeckAnchor
// ─────────────────────────────────────────────────────────────
export function computeNeckAnchor(transform, camera) {
  const { _lms, faceWidth } = transform
  const mid    = blend(_lms[L_JAW], _lms[R_JAW])
  const anchor = blend(mid, _lms[CHIN], 0.6)

  const worldPos = landmarkToWorld(anchor, camera)
  worldPos.y -= faceWidth * 0.45
  return worldPos
}

// ─────────────────────────────────────────────────────────────
//  applyFaceRotation
// ─────────────────────────────────────────────────────────────
export function applyFaceRotation(object, transform, opts = {}) {
  const { yaw = true, pitch = true, roll = true } = opts
  if (roll)  object.rotation.z = -transform.roll
  if (yaw)   object.rotation.y =  transform.yaw   * 0.6
  if (pitch) object.rotation.x =  transform.pitch * 0.5
}

// ─────────────────────────────────────────────────────────────
//  computeJewelleryScale
//
//  FIX: multiplier raised from 0.22 → 1.4 so the object
//  renders at a visible size at typical webcam distances.
// ─────────────────────────────────────────────────────────────
export function computeJewelleryScale(transform, baseScale = 1.0) {
  const REFERENCE_WIDTH = 0.35
  const scaleFactor = transform.faceWidth / REFERENCE_WIDTH
  return baseScale * scaleFactor * 1.4
}
