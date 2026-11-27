import { Router } from 'express'
import * as c from '../controllers/incident.controller.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  commentSchema,
  createIncidentSchema,
  escalateSchema,
  incidentIdSchema,
  listIncidentsSchema,
  updateIncidentSchema,
} from '../validators/index.js'

const router = Router()
const idParam = validate(incidentIdSchema, 'params')
router.use(requireAuth)
router.get('/', validate(listIncidentsSchema, 'query'), asyncHandler(c.list))
router.post('/', validate(createIncidentSchema), asyncHandler(c.create))
router.get('/:id', idParam, asyncHandler(c.get))
router.get('/:id/similar', idParam, asyncHandler(c.similar))
router.patch('/:id', idParam, validate(updateIncidentSchema), asyncHandler(c.update))
router.post('/:id/comments', idParam, validate(commentSchema), asyncHandler(c.addComment))
router.post('/:id/acknowledge', requireRole('ADMIN', 'RESPONDER'), idParam, asyncHandler(c.acknowledge))
router.post('/:id/escalate', requireRole('ADMIN', 'RESPONDER'), idParam, validate(escalateSchema), asyncHandler(c.escalate))
export default router
