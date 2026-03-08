import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { useJewelleryStore } from './store/useJewelleryStore'
import './styles/global.css'

const TryOnCanvas = lazy(() => import('./components/TryOnCanvas'))
const ProductCatalog = lazy(() => import('./components/ProductCatalog'))

export default function App() {
  const [faceDetected, setFaceDetected] = useState(false)
  const [transform,    setTransform]    = useState(null)
  const [showMesh,     setShowMesh]     = useState(false)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('tryonkit-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [trackingStats, setTrackingStats] = useState({
    isReady: false,
    faceDetected: false,
    fps: 0,
    quality: 'starting',
  })

  const selectedEarring  = useJewelleryStore(s => s.selectedEarring)
  const selectedNecklace = useJewelleryStore(s => s.selectedNecklace)
  const selectedNoseRing = useJewelleryStore(s => s.selectedNoseRing)
  const setTrackingActive = useJewelleryStore(s => s.setTrackingActive)
  const setStoreFaceDetected = useJewelleryStore(s => s.setFaceDetected)

  const handleFaceDetected = useCallback(b => setFaceDetected(b), [])
  const handleTransform    = useCallback(t => setTransform(t),    [])
  const handleTrackingStats = useCallback((stats) => setTrackingStats(stats), [])

  useEffect(() => {
    setTrackingActive(trackingStats.isReady)
    setStoreFaceDetected(trackingStats.faceDetected)
  }, [trackingStats.isReady, trackingStats.faceDetected, setTrackingActive, setStoreFaceDetected])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tryonkit-theme', theme)
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#0a0a0f' : '#f6f4ee')
  }, [theme])

  const toDeg = r => r != null ? (r * 180 / Math.PI).toFixed(1) + '\u00B0' : '\u2014'
  const qualityLabel =
    trackingStats.quality === 'excellent' ? 'Excellent'
    : trackingStats.quality === 'good' ? 'Good'
    : trackingStats.quality === 'weak' ? 'Weak'
    : trackingStats.quality === 'searching' ? 'Searching'
    : 'Starting'

  return (
    <div className="app-v1">
      <header className="header-v1">
        <div className="header-logo">
          <span className="logo-text">TryonKit</span>
          <span className="logo-sub">AR Jewellery Try-On</span>
        </div>
        <div className="header-controls">
          <div className={`face-status ${faceDetected ? 'face-status-on' : ''}`}>
            {faceDetected ? 'Tracking' : 'No face'}
          </div>
          <div className={`quality-pill quality-${trackingStats.quality}`}>
            {qualityLabel}
          </div>
          <button
            className={`toggle-btn ${showMesh ? 'toggle-btn-active' : ''}`}
            onClick={() => setShowMesh(v => !v)}
          >
            Mesh
          </button>
          <button
            className="toggle-btn"
            onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <div className="header-phase">v0.6</div>
        </div>
      </header>

      <main className="main-v2">
        <section className="viewport-section">
          <Suspense fallback={<div className="canvas-loading">Loading AR canvas...</div>}>
            <TryOnCanvas
              showMesh={showMesh}
              earringUrl={selectedEarring?.model_url  ?? null}
              necklaceUrl={selectedNecklace?.model_url ?? null}
              noseRingUrl={selectedNoseRing?.model_url ?? null}
              onFaceDetected={handleFaceDetected}
              onTransform={handleTransform}
              onTrackingStats={handleTrackingStats}
            />
          </Suspense>

          <div className="active-items">
            <ActiveItem label="Earrings"  item={selectedEarring}  />
            <ActiveItem label="Necklace"  item={selectedNecklace} />
            <ActiveItem label="Nose Ring" item={selectedNoseRing} />
            {trackingStats.isReady && (
              <div className="active-item active-item-fps">
                <span className="active-item-label">FPS</span>
                <span className="active-item-name">{trackingStats.fps}</span>
              </div>
            )}
          </div>
        </section>

        <aside className="catalog-section">
          <h2 className="catalog-heading">Select Jewellery</h2>
          <Suspense fallback={<div className="catalog-loading">Loading catalog...</div>}>
            <ProductCatalog />
          </Suspense>

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
      <span className="debug-value">{value ?? '\u2014'}</span>
    </div>
  )
}
