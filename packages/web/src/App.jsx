import React, { useState, useCallback } from 'react'
import TryOnCanvas   from './components/TryOnCanvas'
import ProductCatalog from './components/ProductCatalog'
import { useJewelleryStore } from './store/useJewelleryStore'
import './styles/global.css'

/**
 * TryonKit App — Phase 5+6
 * Full try-on: earrings + necklace + nose ring
 * Product catalog with live switching
 */
export default function App() {
  const [faceDetected, setFaceDetected] = useState(false)
  const [transform,    setTransform]    = useState(null)
  const [showMesh,     setShowMesh]     = useState(false)

  const selectedEarring  = useJewelleryStore(s => s.selectedEarring)
  const selectedNecklace = useJewelleryStore(s => s.selectedNecklace)
  const selectedNoseRing = useJewelleryStore(s => s.selectedNoseRing)

  const handleFaceDetected = useCallback(b  => setFaceDetected(b), [])
  const handleTransform    = useCallback(t  => setTransform(t),    [])

  const toDeg = r => r != null ? (r * 180 / Math.PI).toFixed(1) + '°' : '—'

  return (
    <div className="app-v1">
      <header className="header-v1">
        <div className="header-logo">
          <span className="logo-gem">💎</span>
          <span className="logo-text">TryonKit</span>
        </div>
        <div className="header-controls">
          <div className={`face-status ${faceDetected ? 'face-status-on' : ''}`}>
            {faceDetected ? '◉ Face tracked' : '◎ No face'}
          </div>
          <button
            className={`toggle-btn ${showMesh ? 'toggle-btn-active' : ''}`}
            onClick={() => setShowMesh(v => !v)}
          >
            {showMesh ? 'Mesh on' : 'Mesh off'}
          </button>
          <div className="header-phase">TryonKit v0.6</div>
        </div>
      </header>

      <main className="main-v2">
        {/* ── Left: viewport ─────────────────────────────── */}
        <section className="viewport-section">
          <TryOnCanvas
            showMesh={showMesh}
            earringUrl={selectedEarring?.model_url  ?? null}
            necklaceUrl={selectedNecklace?.model_url ?? null}
            noseRingUrl={selectedNoseRing?.model_url ?? null}
            onFaceDetected={handleFaceDetected}
            onTransform={handleTransform}
          />

          {/* Active selections display */}
          <div className="active-items">
            <ActiveItem label="Earrings"  item={selectedEarring}  />
            <ActiveItem label="Necklace"  item={selectedNecklace} />
            <ActiveItem label="Nose Ring" item={selectedNoseRing} />
          </div>
        </section>

        {/* ── Right: catalog ──────────────────────────────── */}
        <aside className="catalog-section">
          <h2 className="catalog-heading">Select Jewellery</h2>
          <ProductCatalog />

          {/* Transform debug — collapsed by default */}
          {transform && (
            <details className="transform-debug">
              <summary>Face Transform</summary>
              <div className="debug-grid">
                <DebugItem label="Yaw"   value={toDeg(transform.yaw)}   />
                <DebugItem label="Pitch" value={toDeg(transform.pitch)} />
                <DebugItem label="Roll"  value={toDeg(transform.roll)}  />
                <DebugItem label="Scale" value={transform.faceWidth?.toFixed(3)} />
              </div>
            </details>
          )}
        </aside>
      </main>
    </div>
  )
}

function ActiveItem({ label, item }) {
  if (!item) return null
  return (
    <div className="active-item">
      <span className="active-item-label">{label}</span>
      <span className="active-item-name">{item.name}</span>
    </div>
  )
}

function DebugItem({ label, value }) {
  return (
    <div className="debug-item debug-item-active">
      <span className="debug-label">{label}</span>
      <span className="debug-value">{value ?? '—'}</span>
    </div>
  )
}
