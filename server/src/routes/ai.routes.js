import { Router } from 'express'
import * as ai from '../services/ai.service.js'
import { analyzeIncident, triage } from '../ai/orchestrator.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { agentParamsSchema, daysQuerySchema, evalRunSchema, executiveReportSchema, feedbackSchema, incidentIdSchema, stringIdSchema, triageSchema } from '../validators/index.js'

const router = Router()
const staff = requireRole('ADMIN', 'RESPONDER')
const wrap = (fn) => asyncHandler(async (req, res) => res.json(await fn(req)))

router.use(requireAuth)
router.get('/agents', wrap(() => ai.listAgents()))
// Triage preview is the only agent endpoint open to reporters (their own draft text only).
router.post('/triage', validate(triageSchema), wrap((req) => triage(req.user, req.valid.body)))

router.post('/incidents/:id/analyze', staff, validate(incidentIdSchema, 'params'), wrap((req) => analyzeIncident(req.user, req.valid.params.id)))
router.post('/incidents/:id/agents/:agent', staff, validate(agentParamsSchema, 'params'), wrap((req) => ai.runAgentOnIncident(req.user, req.valid.params.id, req.valid.params.agent)))
router.get('/incidents/:id/runs', staff, validate(incidentIdSchema, 'params'), wrap((req) => ai.listRuns(req.valid.params.id)))
router.patch('/runs/:id/feedback', staff, validate(stringIdSchema, 'params'), validate(feedbackSchema), wrap((req) => ai.recordFeedback(req.user, req.valid.params.id, req.valid.body)))

router.post('/sla/monitor', staff, wrap((req) => ai.monitorSla(req.user)))
router.post('/reports/executive', staff, validate(executiveReportSchema), wrap((req) => ai.executiveReport(req.user, req.valid.body.days)))

router.get('/observability', staff, validate(daysQuerySchema.extend({ days: daysQuerySchema.shape.days.default(7) }), 'query'), wrap((req) => ai.observability(req.valid.query.days)))
router.get('/governance', staff, wrap(() => ai.governance()))
router.post('/evals/run', requireRole('ADMIN'), validate(evalRunSchema), wrap((req) => ai.runAndStoreEvals(req.user, req.valid.body.mode)))
router.get('/evals', staff, wrap(() => ai.listEvals()))
export default router
