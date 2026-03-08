import { db } from './index.js'

const products = [
  {
    name:            'Gold Hoop Earrings',
    category:        'earring',
    price:           999.00,
    model_url:       '/models/placeholder-earring.glb',
    thumbnail:       '/thumbnails/placeholder-earring.jpg',
    anchor_type:     'left_ear',
    scale:           1.0,
    position_offset: [0, 0, 0],
    rotation_offset: [0, 0, 0],
  },
  {
    name:            'Diamond Stud Earrings',
    category:        'earring',
    price:           2499.00,
    model_url:       '/models/placeholder-earring.glb',
    thumbnail:       '/thumbnails/placeholder-earring.jpg',
    anchor_type:     'left_ear',
    scale:           0.8,
    position_offset: [0, 0, 0],
    rotation_offset: [0, 0, 0],
  },
  {
    name:            'Gold Chain Necklace',
    category:        'necklace',
    price:           1499.00,
    model_url:       '/models/placeholder-necklace.glb',
    thumbnail:       '/thumbnails/placeholder-necklace.jpg',
    anchor_type:     'neck',
    scale:           1.0,
    position_offset: [0, 0, 0],
    rotation_offset: [0, 0, 0],
  },
  {
    name:            'Classic Nose Pin',
    category:        'nose_ring',
    price:           499.00,
    model_url:       '/models/placeholder-nosering.glb',
    thumbnail:       '/thumbnails/placeholder-nosering.jpg',
    anchor_type:     'nose',
    scale:           0.5,
    position_offset: [0, 0, 0],
    rotation_offset: [0, 0, 0],
  },
]

const seed = async () => {
  console.log('Seeding database...')

  for (const p of products) {
    await db.query(
      `INSERT INTO products
         (name, category, price, model_url, thumbnail, anchor_type, scale, position_offset, rotation_offset)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
       ON CONFLICT DO NOTHING`,
      [
        p.name, p.category, p.price,
        p.model_url, p.thumbnail, p.anchor_type,
        p.scale,
        JSON.stringify(p.position_offset),
        JSON.stringify(p.rotation_offset),
      ]
    )
    console.log(`  ✔ ${p.name}`)
  }

  console.log('✅ Seed complete')
  await db.end()
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
