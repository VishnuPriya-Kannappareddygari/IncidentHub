import { Router } from 'express'
import * as c from '../controllers/auth.controller.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, registerSchema } from '../validators/index.js'

const router = Router()
router.post('/register', validate(registerSchema), asyncHandler(c.register))
router.post('/login', validate(loginSchema), asyncHandler(c.login))
router.get('/me', requireAuth, c.me)
export default router
