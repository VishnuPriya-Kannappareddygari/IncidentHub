import { Router } from 'express'
import { listActivity } from '../services/activity.service.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { activityQuerySchema } from '../validators/index.js'

const router = Router()
router.use(requireAuth, requireRole('ADMIN', 'RESPONDER'))
router.get('/', validate(activityQuerySchema, 'query'), asyncHandler(async (req, res) => res.json(await listActivity(req.valid.query))))
export default router
