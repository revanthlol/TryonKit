import { Vector3 } from 'three'

/**
 * faceGeometry.js — Phase 5 (accurate anchoring)
 *
 * MediaPipe's face mesh stops at the cheek boundary — it does NOT
 * cover the actual ears. Landmark 234/454 are at the pre-auricular
 * area (cheek side of the ear), not the earlobe.
 *
 * To place earrings accurately, we:
 * 1. Take the outermost face landmark near the ear (234/454)
 * 2. Push OUTWARD from face center (ears extend beyond the mesh)
 * 3. Push DOWNWARD from tragus level to earlobe level
 */

const L_EAR      = 234
const R_EAR      = 454
const NOSE_TIP   = 4
const L_NOSTRIL  = 48
const R_NOSTRIL  = 278
const CHIN       = 152
const FOREHEAD   = 10
const L_JAW      = 172
const R_JAW      = 397

function dist2D(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
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

  return {
    center, faceWidth, faceHeight,
    roll, yaw, pitch,
    _lms: landmarks,
  }
}

// ─────────────────────────────────────────────────────────────
//  landmarkToWorld
// ─────────────────────────────────────────────────────────────
export function landmarkToWorld(lm, camera) {
  const ndcX =  lm.x * 2 - 1
  const ndcY = -lm.y * 2 + 1

  const vec = new Vector3(ndcX, ndcY, 0.5)
  vec.unproject(camera)
  const dir = vec.clone().sub(camera.position).normalize()
  const dist = -camera.position.z / dir.z
  return camera.position.clone().add(dir.multiplyScalar(dist))
}

// ─────────────────────────────────────────────────────────────
//  computeEarAnchor
//
//  Landmark 234/454 is on the CHEEK, not the ear. The actual
//  earlobe is:
//    - Further OUTWARD from face center (~12% of face width)
//    - Further DOWN from tragus level (~8% of face height)
//
//  We compute the outward direction from face center to the
//  ear landmark and extend beyond it.
// ─────────────────────────────────────────────────────────────
export function computeEarAnchor(transform, side, camera) {
  const { _lms, faceWidth, faceHeight, center } = transform

  const earIdx = side === 'left' ? L_EAR : R_EAR
  const ear    = _lms[earIdx]

  // Direction from face center to ear landmark (outward)
  const dx = ear.x - center.x
  const dy = ear.y - center.y

  // Push outward past the face mesh boundary to reach the actual ear
  const outwardPush = faceWidth * 0.12

  // Push downward from tragus to earlobe
  const downPush = faceHeight * 0.08

  const lobe = {
    x: ear.x + (dx / Math.abs(dx + 1e-6)) * outwardPush,
    y: ear.y + downPush,
    z: ear.z,
  }

  return landmarkToWorld(lobe, camera)
}

// ─────────────────────────────────────────────────────────────
//  isEarVisible
// ─────────────────────────────────────────────────────────────
export function isEarVisible(transform, side) {
  const yaw = transform.yaw
  const FADE_START = 0.30
  const FADE_END   = 0.55

  const signal = side === 'left' ? -yaw : yaw

  if (signal < FADE_START) return 1.0
  if (signal > FADE_END)   return 0.0
  return 1.0 - (signal - FADE_START) / (FADE_END - FADE_START)
}

// ─────────────────────────────────────────────────────────────
//  computeNoseAnchor
// ─────────────────────────────────────────────────────────────
export function computeNoseAnchor(transform, side = 'left', camera) {
  const { _lms } = transform
  const nostril = _lms[side === 'left' ? L_NOSTRIL : R_NOSTRIL]
  const nose    = _lms[NOSE_TIP]
  // 90% nostril, 10% nose tip — right at the nostril edge
  return landmarkToWorld(blend(nostril, nose, 0.10), camera)
}

// ─────────────────────────────────────────────────────────────
//  computeNeckAnchor
// ─────────────────────────────────────────────────────────────
export function computeNeckAnchor(transform, camera) {
  const { _lms, faceWidth } = transform
  const mid    = blend(_lms[L_JAW], _lms[R_JAW])
  const anchor = blend(mid, _lms[CHIN], 0.55)
  const worldPos = landmarkToWorld(anchor, camera)
  worldPos.y -= faceWidth * 0.25
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
  return baseScale * (transform.faceWidth / REFERENCE_WIDTH)
}
