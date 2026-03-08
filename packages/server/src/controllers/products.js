import { db } from '../db/index.js'

export const getAllProducts = async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM products WHERE is_active = TRUE ORDER BY category, name'
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const getProductById = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = TRUE',
      [req.params.id]
    )
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const getProductsByCategory = async (req, res) => {
  const valid = ['earring', 'necklace', 'nose_ring']
  if (!valid.includes(req.params.category)) {
    return res.status(400).json({ success: false, error: 'Invalid category' })
  }
  try {
    const { rows } = await db.query(
      'SELECT * FROM products WHERE category = $1 AND is_active = TRUE ORDER BY name',
      [req.params.category]
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}
