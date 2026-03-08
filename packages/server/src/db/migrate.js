import { db } from './index.js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, 'schema.sql')

const migrate = async () => {
  console.log('Running migrations...')
  const schemaSql = await readFile(schemaPath, 'utf8')
  await db.query(schemaSql)

  console.log('✅ Migrations complete')
  await db.end()
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message)
  process.exit(1)
})
