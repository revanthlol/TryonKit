# TryonKit

> Real-time virtual jewellery try-on using MediaPipe FaceMesh + Three.js

## Stack

| Layer    | Technology                            |
|----------|---------------------------------------|
| Frontend | React 18 · Vite · Three.js · Zustand  |
| Tracking | MediaPipe FaceMesh (468 landmarks)    |
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

Web app   → http://localhost:3000  
API       → http://localhost:5000  
Health    → http://localhost:5000/health

## MVP Phases

- [x] Phase 0 — Project structure
- [ ] Phase 1 — Camera + Face Detection
- [ ] Phase 2 — Three.js scene setup
- [ ] Phase 3 — Pseudo-3D face coordinate system
- [ ] Phase 4 — Earring model integration
- [ ] Phase 5 — Necklace + Nose ring
- [ ] Phase 6 — Product catalog UI
- [ ] Phase 7 — React Native mobile port
