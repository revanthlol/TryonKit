import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

export const db = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'tryonkit',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

db.on('connect', () => console.log('🐘 PostgreSQL connected'))
db.on('error',   (err) => console.error('PostgreSQL error:', err.message))
