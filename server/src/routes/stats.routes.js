import { Router } from 'express'
import { stats } from '../controllers/stats.controller.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.get('/', requireAuth, asyncHandler(stats))
export default router
