import { Router } from 'express'
import {
  getAllProducts,
  getProductById,
  getProductsByCategory,
} from '../controllers/products.js'

export const productRoutes = Router()

productRoutes.get('/',                   getAllProducts)
productRoutes.get('/category/:category', getProductsByCategory)
productRoutes.get('/:id',                getProductById)
