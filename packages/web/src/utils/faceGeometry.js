import * as THREE from 'three'

/**
 * faceGeometry.js — Phase 4 (placement fix)
 *
 * Fix 1: computeEarAnchor — reduced downward drop offset so
 *         earrings sit AT the lobe, not below the jaw.
 * Fix 2: Added isEarVisible(transform, side) — returns false
 *         when yaw rotation hides that ear from the camera.
 *         Consumers use this to hide/show each earring.
 */

const L_EAR      = 234
const R_EAR      = 454
const L_JAW_LOW  = 132
const R_JAW_LOW  = 361
const NOSE_TIP   = 4
const L_NOSTRIL  = 48
const R_NOSTRIL  = 278
const CHIN       = 152
const FOREHEAD   = 10
const L_JAW      = 172
const R_JAW      = 397

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

  const roll = Math.atan2(
    rightEar.y - leftEar.y,
    rightEar.x - leftEar.x
  )

  const noseDeviation = (noseTip.x - center.x) / (faceWidth * 0.5 + 1e-6)
  const yaw = noseDeviation * (Math.PI / 2.5)

  const noseCenterY = (forehead.y + chin.y) * 0.5
  const pitchFromY  = (noseTip.y - noseCenterY) / (faceHeight * 0.5 + 1e-6)
  const pitchFromZ  = -noseTip.z * 2.5
  const pitch       = (pitchFromY * 0.4 + pitchFromZ * 0.6) * (Math.PI / 4)

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
  const ndcX =  lm.x * 2 - 1
  const ndcY = -lm.y * 2 + 1

  const vec  = new THREE.Vector3(ndcX, ndcY, 0.5)
  vec.unproject(camera)
  const dir  = vec.clone().sub(camera.position).normalize()
  const dist = -camera.position.z / dir.z
  return camera.position.clone().add(dir.multiplyScalar(dist))
}

// ─────────────────────────────────────────────────────────────
//  computeEarAnchor — FIXED
//
//  Drop offset reduced from faceWidth * 0.18 → faceWidth * 0.06
//  so earrings sit at the lobe, not the jaw.
// ─────────────────────────────────────────────────────────────
export function computeEarAnchor(transform, side, camera) {
  const { _lms, faceWidth } = transform

  const earIdx = side === 'left' ? L_EAR     : R_EAR
  const jawIdx = side === 'left' ? L_JAW_LOW : R_JAW_LOW

  const ear     = _lms[earIdx]
  const jaw     = _lms[jawIdx]
  const blended = blend(ear, jaw, 0.15)   // 85% ear, 15% jaw

  const worldPos = landmarkToWorld(blended, camera)

  // Small downward drop so jewellery hangs just below the tragus
  worldPos.y -= faceWidth * 0.06

  return worldPos
}

// ─────────────────────────────────────────────────────────────
//  isEarVisible — NEW
//
//  Returns true when the ear on `side` is facing the camera.
//
//  Yaw is positive when the face turns RIGHT (nose moves right).
//  Left ear  becomes invisible when yaw > +threshold (face right)
//  Right ear becomes invisible when yaw < -threshold (face left)
//
//  threshold ~0.4 rad (~23°) — ear starts going out of view.
//  We use a soft fade zone [0.3, 0.55] so the earring doesn't
//  snap on/off — it fades out over ~15° of rotation.
// ─────────────────────────────────────────────────────────────
export function isEarVisible(transform, side) {
  const yaw = transform.yaw
  const FADE_START = 0.30   // ~17° — start fading
  const FADE_END   = 0.55   // ~31° — fully hidden

  // Raw visibility signal: positive = this ear is turning away
  const signal = side === 'left' ? -yaw : yaw

  if (signal < FADE_START) return 1.0                              // fully visible
  if (signal > FADE_END)   return 0.0                              // fully hidden
  return 1.0 - (signal - FADE_START) / (FADE_END - FADE_START)    // 0→1 fade
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
// ─────────────────────────────────────────────────────────────
export function computeJewelleryScale(transform, baseScale = 1.0) {
  const REFERENCE_WIDTH = 0.35
  const scaleFactor = transform.faceWidth / REFERENCE_WIDTH
  return baseScale * scaleFactor * 1.4
}
