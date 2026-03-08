# Database Setup Guide

This guide covers PostgreSQL setup for TryonKit in local dev and on a VM.

## 1. Prerequisites

- PostgreSQL installed and running.
- Project dependencies installed:

```bash
npm install
```

## 2. Environment File

Create `packages/server/.env`:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tryonkit
DB_USER=postgres
DB_PASSWORD=your_password
CLIENT_URLS=http://localhost:4000,https://tryon-kit-server.vercel.app
```

Notes:
- Use your actual DB password.
- If your VM/Postgres runs on `5433`, set `DB_PORT=5433`.
- Prefer `CLIENT_URLS` for multiple allowed frontends.

## 3. Create Database

```bash
sudo -u postgres createdb tryonkit
```

If your user already owns postgres access:

```bash
createdb -h localhost -p 5432 -U postgres tryonkit
```

## 4. Run Schema + Normalization

Run migration:

```bash
npm run migrate
```

What this does:
- Executes `packages/server/src/db/schema.sql`
- Creates `products` table and indexes
- Normalizes legacy placeholder `model_url` values to valid `.glb` assets
- Clears placeholder thumbnails

## 5. Seed Sample Data

```bash
npm run seed
```

Seed data uses valid model paths (`/models/*.glb`) so jewellery loads in web UI.

## 6. Verify DB Connectivity

```bash
PGPASSWORD=your_password psql -h localhost -p 5432 -U postgres -d tryonkit -c "select 1;"
```

Check rows:

```bash
PGPASSWORD=your_password psql -h localhost -p 5432 -U postgres -d tryonkit -c \
"select id,name,category,model_url,is_active from products order by category,name;"
```

## 7. Verify API

Start backend:

```bash
npm run dev:server
```

Then test:

```bash
curl -i http://localhost:5000/health
curl -i http://localhost:5000/api/products
```

Expected:
- `/health` returns `200` and JSON status.
- `/api/products` returns `200` and product list.

## 8. VM + PM2 (Recommended)

Start with correct working directory so `.env` is picked up:

```bash
pm2 delete tryonkit
pm2 start src/index.js --name tryonkit --cwd /home/ubuntu/TryonKit/packages/server
pm2 save
```

Useful checks:

```bash
pm2 describe tryonkit
pm2 logs tryonkit --lines 200
curl -i http://localhost:5000/api/products
```

## 9. Common Issues

- `ECONNREFUSED 127.0.0.1:5432`:
  - Wrong `DB_PORT` or Postgres not running.
- `500 /api/products`:
  - DB credentials/port mismatch.
- Jewellery not loading with `Unexpected token '<'`:
  - Backend `model_url` points to invalid file; rerun migration/seed.
- CORS errors:
  - Ensure frontend origin is included in `CLIENT_URLS`.
