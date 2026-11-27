import { http } from './http.js'

export const fetchAgents = () => http('/ai/agents')
export const triage = (body) => http('/ai/triage', { method: 'POST', body })
export const analyzeIncident = (id) => http(`/ai/incidents/${id}/analyze`, { method: 'POST' })
export const runAgent = (id, agent) => http(`/ai/incidents/${id}/agents/${agent}`, { method: 'POST' })
export const fetchRuns = (id) => http(`/ai/incidents/${id}/runs`)
export const sendFeedback = (runId, body) => http(`/ai/runs/${runId}/feedback`, { method: 'PATCH', body })
export const monitorSla = () => http('/ai/sla/monitor', { method: 'POST' })
export const executiveReport = (days) => http('/ai/reports/executive', { method: 'POST', body: { days } })
export const fetchObservability = (days = 7) => http('/ai/observability', { query: { days } })
export const fetchGovernance = () => http('/ai/governance')
export const runEvals = (mode) => http('/ai/evals/run', { method: 'POST', body: { mode } })
export const fetchEvals = () => http('/ai/evals')
