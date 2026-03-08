import { db } from './index.js'

const migrate = async () => {
  console.log('Running migrations...')

  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id               SERIAL PRIMARY KEY,
      name             VARCHAR(255)    NOT NULL,
      category         VARCHAR(50)     NOT NULL
                         CHECK (category IN ('earring', 'necklace', 'nose_ring')),
      price            DECIMAL(10, 2)  NOT NULL,
      model_url        TEXT            NOT NULL,
      thumbnail        TEXT,
      anchor_type      VARCHAR(50),
      scale            DECIMAL(5, 3)   NOT NULL DEFAULT 1.0,
      position_offset  JSONB           NOT NULL DEFAULT '[0,0,0]',
      rotation_offset  JSONB           NOT NULL DEFAULT '[0,0,0]',
      is_active        BOOLEAN         NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    );
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_products_category   ON products (category);
    CREATE INDEX IF NOT EXISTS idx_products_is_active  ON products (is_active);
  `)

  console.log('✅ Migrations complete')
  await db.end()
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message)
  process.exit(1)
})
