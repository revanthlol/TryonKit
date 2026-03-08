import React, { useEffect, useState } from 'react'
import { useJewelleryStore } from '../store/useJewelleryStore'
import styles from './ProductCatalog.module.css'

/**
 * ProductCatalog — Phase 6
 *
 * Fetches products from the API and renders a tabbed selector.
 * Selecting a product updates Zustand store → App reads from store
 * → passes model URL to TryOnCanvas.
 */
export default function ProductCatalog() {
  const [activeTab,   setActiveTab]   = useState('earring')
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  const products            = useJewelleryStore(s => s.products)
  const setProducts         = useJewelleryStore(s => s.setProducts)
  const selectedEarring     = useJewelleryStore(s => s.selectedEarring)
  const selectedNecklace    = useJewelleryStore(s => s.selectedNecklace)
  const selectedNoseRing    = useJewelleryStore(s => s.selectedNoseRing)
  const setSelectedEarring  = useJewelleryStore(s => s.setSelectedEarring)
  const setSelectedNecklace = useJewelleryStore(s => s.setSelectedNecklace)
  const setSelectedNoseRing = useJewelleryStore(s => s.setSelectedNoseRing)

  useEffect(() => {
    if (products.length > 0) {
      setLoading(false)
      return
    }

    const controller = new AbortController()
    let cancelled = false

    const fetchProducts = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/products', {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        const raw = await res.text()

        let json = null
        if (raw) {
          try {
            json = JSON.parse(raw)
          } catch {
            json = null
          }
        }

        if (!res.ok) {
          throw new Error(json?.error || `Catalog API error (${res.status})`)
        }
        if (!json?.success || !Array.isArray(json?.data)) {
          throw new Error('Catalog API returned invalid JSON')
        }

        if (cancelled) return
        setProducts(json.data)
        setError(null)
      } catch (err) {
        if (err.name === 'AbortError') return
        console.warn('Catalog API failed, using offline products:', err)
        if (cancelled) return
        setError(err.message || 'Catalog unavailable')
        // Load with placeholder models so try-on still works offline
        setProducts(PLACEHOLDER_PRODUCTS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchProducts()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [products.length, setProducts])

  const tabs = [
    { key: 'earring',   icon: '✦', label: 'Earrings'  },
    { key: 'necklace',  icon: '◍', label: 'Necklaces'  },
    { key: 'nose_ring', icon: '•', label: 'Nose Rings'  },
  ]

  const filtered  = products.filter(p => p.category === activeTab)
  const selected  = activeTab === 'earring'   ? selectedEarring
                  : activeTab === 'necklace'  ? selectedNecklace
                  : selectedNoseRing
  const setSelected = activeTab === 'earring'   ? setSelectedEarring
                    : activeTab === 'necklace'  ? setSelectedNecklace
                    : setSelectedNoseRing
  const selectedCount = selected ? 1 : 0

  return (
    <div className={styles.catalog}>
      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.key)}
            aria-pressed={activeTab === t.key}
          >
            <span className={styles.tabIcon}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaText}>
          {loading ? 'Loading products...' : `${filtered.length} items`}
        </span>
        {selectedCount > 0 && (
          <button className={styles.clearBtn} onClick={() => setSelected(null)}>
            Clear selection
          </button>
        )}
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {/* None option */}
        <button
          className={`${styles.card} ${!selected ? styles.cardActive : ''}`}
          onClick={() => setSelected(null)}
          aria-pressed={!selected}
        >
          <div className={styles.cardThumb} style={{ background: 'transparent' }}>
            <span className={styles.noneIcon}>✕</span>
          </div>
          <span className={styles.cardName}>None</span>
        </button>

        {loading && (
          <div className={styles.loadingRow}>
            <div className={styles.cardSkeleton} />
            <div className={styles.cardSkeleton} />
            <div className={styles.cardSkeleton} />
          </div>
        )}

        {!loading && filtered.map(product => (
          <button
            key={product.id}
            className={`${styles.card} ${selected?.id === product.id ? styles.cardActive : ''}`}
            onClick={() => setSelected(selected?.id === product.id ? null : product)}
            aria-pressed={selected?.id === product.id}
          >
            <div className={styles.cardThumb}>
              {product.thumbnail
                ? <img src={product.thumbnail} alt={product.name} className={styles.cardImg} />
                : <span className={styles.cardEmoji}>
                    {activeTab === 'earring' ? '💎' : activeTab === 'necklace' ? '📿' : '✦'}
                  </span>
              }
            </div>
            {selected?.id === product.id && <span className={styles.cardCheck}>✓</span>}
            <span className={styles.cardName}>{product.name}</span>
            <span className={styles.cardPrice}>₹{Number(product.price).toLocaleString('en-IN')}</span>
          </button>
        ))}

        {!loading && filtered.length === 0 && (
          <p className={styles.empty}>No products in this category yet.</p>
        )}
      </div>

      {error && (
        <p className={styles.errorNote}>
          ⚠ Using offline models — {error}
        </p>
      )}
    </div>
  )
}

// Placeholder products used when API is unreachable
const PLACEHOLDER_PRODUCTS = [
  { id: 'p1', name: 'Dangling Earrings', category: 'earring',   price: 999,  model_url: '/models/earring-dangling.glb', thumbnail: null },
  { id: 'p2', name: 'Hoop Earrings',     category: 'earring',   price: 799,  model_url: '/models/earring-hoop.glb',    thumbnail: null },
  { id: 'p3', name: 'Stud Earrings',     category: 'earring',   price: 599,  model_url: '/models/earring-stud.glb',    thumbnail: null },
  { id: 'p4', name: 'Gold Necklace',     category: 'necklace',  price: 1499, model_url: '/models/necklace-chain.glb',  thumbnail: null },
  { id: 'p5', name: 'Nose Pin',          category: 'nose_ring', price: 499,  model_url: '/models/nose-pin.glb',        thumbnail: null },
  { id: 'p6', name: 'Nose Ring',         category: 'nose_ring', price: 399,  model_url: '/models/nose-ring.glb',       thumbnail: null },
]
