import { Router } from 'express'
import * as assets from '../services/asset.service.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { assetSchema, listAssetsSchema, stringIdSchema, updateAssetSchema } from '../validators/index.js'

const router = Router()
const staff = requireRole('ADMIN', 'RESPONDER')
const idParam = validate(stringIdSchema, 'params')

router.use(requireAuth)
router.get('/', validate(listAssetsSchema, 'query'), asyncHandler(async (req, res) => res.json(await assets.listAssets(req.valid.query))))
router.post('/', staff, validate(assetSchema), asyncHandler(async (req, res) => res.status(201).json(await assets.createAsset(req.user, req.valid.body))))
router.get('/:id', idParam, asyncHandler(async (req, res) => res.json(await assets.getAsset(req.valid.params.id))))
router.patch('/:id', staff, idParam, validate(updateAssetSchema), asyncHandler(async (req, res) => res.json(await assets.updateAsset(req.user, req.valid.params.id, req.valid.body))))
router.delete('/:id', requireRole('ADMIN'), idParam, asyncHandler(async (req, res) => {
  await assets.deleteAsset(req.user, req.valid.params.id)
  res.status(204).end()
}))
export default router
