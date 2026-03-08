import { create } from 'zustand'

/**
 * Global state for TryonKit.
 * Grows as each phase adds features.
 */
export const useJewelleryStore = create((set) => ({
  // Active product selections
  selectedEarring:   null,
  selectedNecklace:  null,
  selectedNoseRing:  null,

  // Product catalog
  products: [],

  // Face tracking state
  isTrackingActive: false,
  faceDetected:     false,

  // Actions
  setSelectedEarring:   (p) => set({ selectedEarring: p }),
  setSelectedNecklace:  (p) => set({ selectedNecklace: p }),
  setSelectedNoseRing:  (p) => set({ selectedNoseRing: p }),
  setProducts:          (p) => set({ products: p }),
  setTrackingActive:    (v) => set({ isTrackingActive: v }),
  setFaceDetected:      (v) => set({ faceDetected: v }),
}))
