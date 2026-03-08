import { useRef, useCallback } from 'react'
import { computeFaceTransform } from '../utils/faceGeometry'

/**
 * useFaceTransform — Phase 3
 *
 * Wraps computeFaceTransform with temporal smoothing (EMA).
 * Raw landmark data has per-frame noise. Smoothing the
 * derived transform values (not the landmarks themselves)
 * gives stable, jitter-free jewellery placement.
 *
 * Smoothing factors (alpha):
 *   Higher alpha = faster response, more jitter
 *   Lower  alpha = smoother, slight lag
 */

const SMOOTH = {
  center: 0.35,    // position — moderate lag is fine
  roll:   0.20,    // rotation — smooth to avoid spinning
  yaw:    0.20,
  pitch:  0.20,
  depth:  0.30,
  scale:  0.25,
}

export function useFaceTransform() {
  const smoothed = useRef(null)

  const compute = useCallback((landmarks) => {
    if (!landmarks) return null

    const raw = computeFaceTransform(landmarks)

    if (!smoothed.current) {
      // First frame — initialise with raw values
      smoothed.current = { ...raw }
      return smoothed.current
    }

    const s = smoothed.current

    // Exponential moving average for each field
    s.center.x  = ema(s.center.x,  raw.center.x,  SMOOTH.center)
    s.center.y  = ema(s.center.y,  raw.center.y,  SMOOTH.center)
    s.center.z  = ema(s.center.z,  raw.center.z,  SMOOTH.center)
    s.faceWidth = ema(s.faceWidth, raw.faceWidth,  SMOOTH.scale)
    s.faceHeight= ema(s.faceHeight,raw.faceHeight, SMOOTH.scale)
    s.roll      = emaAngle(s.roll,  raw.roll,       SMOOTH.roll)
    s.yaw       = emaAngle(s.yaw,   raw.yaw,        SMOOTH.yaw)
    s.pitch     = emaAngle(s.pitch, raw.pitch,      SMOOTH.pitch)
    s.depth     = ema(s.depth,     raw.depth,       SMOOTH.depth)

    // Always pass through raw landmarks for anchor calculation
    s._lms = raw._lms

    return s
  }, [])

  const reset = useCallback(() => {
    smoothed.current = null
  }, [])

  return { compute, reset }
}

// ── Helpers ───────────────────────────────────────────────────

// Standard exponential moving average
function ema(prev, next, alpha) {
  return prev + alpha * (next - prev)
}

// Angle EMA that handles the ±π wrap-around correctly
function emaAngle(prev, next, alpha) {
  let delta = next - prev
  // Wrap delta to [-π, π]
  while (delta >  Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  return prev + alpha * delta
}
