import 'dotenv/config'
import express  from 'express'
import cors     from 'cors'
import helmet   from 'helmet'
import { productRoutes } from './routes/products.js'

const app  = express()
const PORT = process.env.PORT || 5000
const allowedOrigins = (
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  'http://localhost:4000,http://localhost:3000'
)
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

// ── Middleware ──────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser requests (curl, server-to-server)
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Routes ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'TryonKit API', ts: new Date().toISOString() })
})

app.use('/api/products', productRoutes)

// ── 404 ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

// ── Error handler ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  if (err.message?.startsWith('CORS blocked for origin:')) {
    return res.status(403).json({ success: false, error: err.message })
  }
  res.status(500).json({ success: false, error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`💎 TryonKit API → http://localhost:${PORT}`)
})
