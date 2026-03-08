# TryonKit

> Real-time virtual jewellery try-on using MediaPipe Tasks Vision + Three.js

## Stack

| Layer    | Technology                            |
|----------|---------------------------------------|
| Frontend | React 18 · Vite · Three.js · Zustand  |
| Tracking | `@mediapipe/tasks-vision` Face Landmarker (468 landmarks) |
| Backend  | Node.js · Express · PostgreSQL        |
| Mobile   | React Native (Phase 7)                |

## Structure

```
TryonKit/
├── packages/
│   ├── web/        ← React + Vite + Three.js frontend
│   └── server/     ← Express + PostgreSQL API
└── package.json    ← npm workspaces root
```

## Quick Start

```bash
# 1. Install all dependencies
npm install

# 2. Setup PostgreSQL database
sudo -u postgres createdb tryonkit
npm run migrate
npm run seed       # optional sample data

# 3. Configure server env
cp packages/server/.env.example packages/server/.env
# edit packages/server/.env with your DB password

# 4. Start both web + server
npm run dev
```

Web app   → http://localhost:4000  
API       → http://localhost:5000  
Health    → http://localhost:5000/health

## UI + Tracking Enhancements

- Responsive catalog with improved tab/card states and keyboard focus styles.
- Real-time tracking quality states (`Starting`, `Searching`, `Weak`, `Good`, `Excellent`) and FPS display.
- Dark/light theme toggle in header with local persistence (`tryonkit-theme` in `localStorage`).
- Smoother face lock behavior using detection hysteresis to reduce flicker.

## Frontend Performance

- `TryOnCanvas` and `ProductCatalog` are lazy-loaded via `React.lazy`.
- Vendor chunk splitting in Vite:
  - `vendor-react` (`react`, `react-dom`, `zustand`)
  - `vendor-three` (`three`)
  - `vendor-mediapipe` (`@mediapipe/tasks-vision`)
- `build.chunkSizeWarningLimit` is set to `600` to avoid false-positive warnings from the intentionally lazy-loaded `three` vendor chunk.
- Goal: reduce initial JS payload and improve first-load responsiveness.

## Scripts

```bash
npm run dev        # web + server
npm run dev:web    # web only (Vite on :4000)
npm run dev:server # server only (Express on :5000)
npm run build      # production build for web
```

## MVP Phases

- [x] Phase 0 — Project structure
- [x] Phase 1 — Camera + Face Detection
- [x] Phase 2 — Three.js scene setup
- [x] Phase 3 — Pseudo-3D face coordinate system
- [x] Phase 4 — Earring model integration
- [x] Phase 5 — Necklace + Nose ring
- [x] Phase 6 — Product catalog UI
- [ ] Phase 7 — React Native mobile port
