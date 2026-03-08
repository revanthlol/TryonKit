-- TryonKit canonical schema + data normalization

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

CREATE INDEX IF NOT EXISTS idx_products_category   ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_is_active  ON products (is_active);

-- Normalize any legacy placeholder model URLs to working assets.
UPDATE products
SET model_url = '/models/earring-dangling.glb'
WHERE category = 'earring'
  AND (model_url IS NULL OR model_url = '' OR model_url LIKE '/models/placeholder-%');

UPDATE products
SET model_url = '/models/necklace-chain.glb'
WHERE category = 'necklace'
  AND (model_url IS NULL OR model_url = '' OR model_url LIKE '/models/placeholder-%');

UPDATE products
SET model_url = '/models/nose-pin.glb'
WHERE category = 'nose_ring'
  AND (model_url IS NULL OR model_url = '' OR model_url LIKE '/models/placeholder-%');

-- Drop unusable placeholder thumbnails so frontend can fall back cleanly.
UPDATE products
SET thumbnail = NULL
WHERE thumbnail LIKE '/thumbnails/placeholder-%';
