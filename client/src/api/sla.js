import { http } from './http.js'

export const fetchPolicies = () => http('/sla/policies')
export const fetchSlaStatus = () => http('/sla/status')
export const runSlaCheck = () => http('/sla/check', { method: 'POST' })
