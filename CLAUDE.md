# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all dependencies (root + workspaces)
npm install

# Start both web + server concurrently
npm run dev

# Start only the web frontend (Vite dev server on port 4000)
npm run dev:web

# Start only the Express API server (port 5000, uses nodemon)
npm run dev:server

# Build web frontend for production
npm run build

# Database setup (requires PostgreSQL)
npm run migrate        # create tables
npm run seed           # insert sample product data

# Generate sample earring GLB model into packages/web/public/models/
node generate-earring-glb.mjs
```

No test runner or linter is configured.

## Architecture

**Monorepo** using npm workspaces with two packages:

### `packages/web` — React + Vite + Three.js frontend
Real-time virtual jewellery try-on. The rendering pipeline has three layers composited in a single WebGL canvas:

1. **Background layer**: Orthographic scene with a `VideoTexture` showing the webcam feed
2. **Mesh overlay**: 2D canvas drawn on top showing MediaPipe face landmark wireframe (toggle-able)
3. **Jewellery layer**: Perspective Three.js scene where GLB models are positioned on face anchors

Key data flow: `useFaceTracking` (MediaPipe FaceLandmarker → 468 landmarks) → `useFaceTransform` (EMA-smoothed yaw/pitch/roll/scale) → `TryOnCanvas` (positions GLB models at computed anchor points each frame)

**Hooks** (`src/hooks/`):
- `useFaceTracking` — initializes `@mediapipe/tasks-vision` FaceLandmarker, runs `detectForVideo()` in a rAF loop, draws mesh overlay
- `useFaceTransform` — wraps `computeFaceTransform` with exponential moving average smoothing to reduce jitter
- `useThreeScene` — sets up dual-scene WebGL renderer (background video + jewellery), handles resize
- `useJewelleryLoader` — GLTFLoader with URL-keyed cache, returns clones for multi-placement (e.g. left + right ear)

**Utils** (`src/utils/`):
- `faceGeometry.js` — core math: landmark→world projection, ear/nose/neck anchor computation, visibility fade for ears based on yaw, face rotation application, scale computation
- `anchorPoints.js` — MediaPipe landmark index constants (ear lobes, nostrils, chin, etc.)

**State**: Zustand store (`src/store/useJewelleryStore.js`) holds selected products (earring, necklace, nose ring) and product catalog.

**Path alias**: `@` maps to `packages/web/src/` (configured in vite.config.js).

### `packages/server` — Express + PostgreSQL API
- Entry: `src/index.js` — Express app with helmet, CORS, JSON parsing
- Routes: `/api/products` — product CRUD
- DB: `pg` Pool connecting to `tryonkit` database, configured via env vars or `.env` file
- Schema: single `products` table with columns for category (`earring`/`necklace`/`nose_ring`), `model_url`, `scale`, `position_offset`, `rotation_offset` (JSONB)

### Jewellery categories
Three product types, each anchored to different face landmarks:
- **Earrings**: anchored at ear lobes (landmarks 177/401), mirrored for left/right, fade out based on yaw angle
- **Necklace**: anchored below chin/jaw midpoint
- **Nose ring**: anchored at nostril/nose tip blend

## Deployment

Vercel: builds only `packages/web`, outputs to `packages/web/dist`. API requests to `/api/*` are rewritten to the backend server.
