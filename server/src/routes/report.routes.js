import { Router } from 'express'
import * as reports from '../services/report.service.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { daysQuerySchema, exportQuerySchema } from '../validators/index.js'

const router = Router()
const filters = validate(exportQuerySchema, 'query')

const csv = (filename, build) =>
  asyncHandler(async (req, res) => {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` })
    res.send(await build(req.user, req.valid.query))
  })

router.use(requireAuth, requireRole('ADMIN', 'RESPONDER'))
router.get('/summary', validate(daysQuerySchema, 'query'), asyncHandler(async (req, res) => res.json(await reports.getSummary(req.valid.query.days))))
router.get('/incidents.csv', filters, csv('incidents.csv', reports.incidentsCsv))
router.get('/sla.csv', filters, csv('sla.csv', reports.slaCsv))
router.get('/incidents.json', filters, asyncHandler(async (req, res) => res.json(await reports.incidentsJson(req.user, req.valid.query))))
export default router
