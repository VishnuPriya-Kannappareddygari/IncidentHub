import { Router } from 'express'
import * as teams from '../services/team.service.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { stringIdSchema, teamSchema, updateTeamSchema } from '../validators/index.js'

const router = Router()
const admin = requireRole('ADMIN')
const idParam = validate(stringIdSchema, 'params')

router.use(requireAuth)
router.get('/', asyncHandler(async (req, res) => res.json(await teams.listTeams())))
router.post('/', admin, validate(teamSchema), asyncHandler(async (req, res) => res.status(201).json(await teams.createTeam(req.user, req.valid.body))))
router.patch('/:id', admin, idParam, validate(updateTeamSchema), asyncHandler(async (req, res) => res.json(await teams.updateTeam(req.user, req.valid.params.id, req.valid.body))))
router.delete('/:id', admin, idParam, asyncHandler(async (req, res) => {
  await teams.deleteTeam(req.user, req.valid.params.id)
  res.status(204).end()
}))
export default router
