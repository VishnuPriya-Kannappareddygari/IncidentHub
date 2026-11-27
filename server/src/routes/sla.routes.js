import { Router } from 'express'
import * as sla from '../services/sla.service.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)
router.get('/policies', (req, res) => res.json({ items: sla.listPolicies() }))
router.get('/status', asyncHandler(async (req, res) => res.json(await sla.getSlaStatus())))
router.post('/check', requireRole('ADMIN', 'RESPONDER'), asyncHandler(async (req, res) => res.json(await sla.runSlaSweep())))
export default router
