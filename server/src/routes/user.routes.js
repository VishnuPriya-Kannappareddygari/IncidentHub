import { Router } from 'express'
import * as c from '../controllers/user.controller.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createUserSchema, updateRoleSchema, updateUserSchema, userIdSchema } from '../validators/index.js'

const router = Router()
router.use(requireAuth)
router.get('/', requireRole('ADMIN', 'RESPONDER'), asyncHandler(c.list))
router.post('/', requireRole('ADMIN'), validate(createUserSchema), asyncHandler(c.create))
router.patch('/:id', requireRole('ADMIN'), validate(userIdSchema, 'params'), validate(updateUserSchema), asyncHandler(c.update))
router.patch('/:id/role', requireRole('ADMIN'), validate(userIdSchema, 'params'), validate(updateRoleSchema), asyncHandler(c.updateRole))
export default router
