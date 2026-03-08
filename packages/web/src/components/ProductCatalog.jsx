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
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const res  = await fetch('/api/products')
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        setProducts(json.data)
      } catch (err) {
        console.error('Failed to fetch products:', err)
        setError(err.message)
        // Load with placeholder models so try-on still works offline
        setProducts(PLACEHOLDER_PRODUCTS)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [setProducts])

  const tabs = [
    { key: 'earring',   label: '💎 Earrings'  },
    { key: 'necklace',  label: '📿 Necklaces'  },
    { key: 'nose_ring', label: '✦ Nose Rings'  },
  ]

  const filtered  = products.filter(p => p.category === activeTab)
  const selected  = activeTab === 'earring'   ? selectedEarring
                  : activeTab === 'necklace'  ? selectedNecklace
                  : selectedNoseRing
  const setSelected = activeTab === 'earring'   ? setSelectedEarring
                    : activeTab === 'necklace'  ? setSelectedNecklace
                    : setSelectedNoseRing

  return (
    <div className={styles.catalog}>
      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {/* None option */}
        <button
          className={`${styles.card} ${!selected ? styles.cardActive : ''}`}
          onClick={() => setSelected(null)}
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
          >
            <div className={styles.cardThumb}>
              {product.thumbnail
                ? <img src={product.thumbnail} alt={product.name} className={styles.cardImg} />
                : <span className={styles.cardEmoji}>
                    {activeTab === 'earring' ? '💎' : activeTab === 'necklace' ? '📿' : '✦'}
                  </span>
              }
            </div>
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
          ⚠ Using offline models — API unreachable
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
