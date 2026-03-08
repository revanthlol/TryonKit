import React, { useState, useCallback } from 'react'
import TryOnCanvas from './components/TryOnCanvas'
import './styles/global.css'

/**
 * TryonKit App — Phase 3
 * Pseudo-3D face coordinate system.
 * Debug panel shows live yaw / pitch / roll / scale / depth.
 */
export default function App() {
  const [faceDetected, setFaceDetected] = useState(false)
  const [transform,    setTransform]    = useState(null)
  const [showMesh,     setShowMesh]     = useState(false)

  const handleLandmarks    = useCallback(() => {},          [])
  const handleFaceDetected = useCallback((b) => setFaceDetected(b), [])
  const handleTransform    = useCallback((t) => setTransform(t),    [])

  const toDeg = (rad) => rad != null ? (rad * 180 / Math.PI).toFixed(1) + '°' : '—'
  const toFixed = (v, n = 3) => v != null ? v.toFixed(n) : '—'

  return (
    <div className="app-v1">
      <header className="header-v1">
        <div className="header-logo">
          <span className="logo-gem">💎</span>
          <span className="logo-text">TryonKit</span>
        </div>
        <div className="header-controls">
          <button
            className={`toggle-btn ${showMesh ? 'toggle-btn-active' : ''}`}
            onClick={() => setShowMesh(v => !v)}
          >
            {showMesh ? '◉ Mesh on' : '◎ Mesh off'}
          </button>
          <div className="header-phase">Phase 3 — Face Coordinate System</div>
        </div>
      </header>

      <main className="main-v1">
        <TryOnCanvas
          showMesh={showMesh}
          onLandmarks={handleLandmarks}
          onFaceDetected={handleFaceDetected}
          onTransform={handleTransform}
        />

        {/* ── Live transform debug panel ─────────────────── */}
        <div className="debug-panel">
          <h3 className="debug-title">Phase 3 — Face Transform (smoothed, live)</h3>
          <div className="debug-grid">
            <DebugItem label="Yaw   (left/right)"  value={toDeg(transform?.yaw)}        active={!!transform} />
            <DebugItem label="Pitch (up/down)"      value={toDeg(transform?.pitch)}      active={!!transform} />
            <DebugItem label="Roll  (head tilt)"    value={toDeg(transform?.roll)}       active={!!transform} />
            <DebugItem label="Face width"           value={toFixed(transform?.faceWidth)} active={!!transform} />
            <DebugItem label="Face height"          value={toFixed(transform?.faceHeight)} active={!!transform} />
            <DebugItem label="Depth offset"         value={toFixed(transform?.depth)}    active={!!transform} />
          </div>
          <p className="debug-note">
            The gold cube is now placed via a weighted ear+jaw anchor, scaled
            to face distance, and rotated to match head yaw/pitch/roll.
            Turn your head and tilt — the cube should follow cleanly.
            Phase 4 replaces this cube with a real GLB earring model.
          </p>
        </div>
      </main>
    </div>
  )
}

function DebugItem({ label, value, active }) {
  return (
    <div className={`debug-item ${active ? 'debug-item-active' : ''}`}>
      <span className="debug-label">{label}</span>
      <span className="debug-value">{value}</span>
    </div>
  )
}
