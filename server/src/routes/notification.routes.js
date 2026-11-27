import { Router } from 'express'
import * as notifications from '../services/notification.service.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { stringIdSchema } from '../validators/index.js'

const router = Router()
router.use(requireAuth)
router.get('/', asyncHandler(async (req, res) => res.json(await notifications.listNotifications(req.user.id))))
router.post('/read-all', asyncHandler(async (req, res) => res.json(await notifications.markAllRead(req.user.id))))
router.patch('/:id/read', validate(stringIdSchema, 'params'), asyncHandler(async (req, res) => res.json(await notifications.markRead(req.user.id, req.valid.params.id))))
export default router
