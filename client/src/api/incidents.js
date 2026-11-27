import { http } from './http.js'

export const login = (body) => http('/auth/login', { method: 'POST', body })
export const register = (body) => http('/auth/register', { method: 'POST', body })
export const fetchMe = () => http('/auth/me')

export const fetchStats = () => http('/stats')
export const fetchIncidents = (query) => http('/incidents', { query })
export const fetchIncident = (id) => http(`/incidents/${id}`)
export const createIncident = (body) => http('/incidents', { method: 'POST', body })
export const updateIncident = (id, body) => http(`/incidents/${id}`, { method: 'PATCH', body })
export const addComment = (id, body) => http(`/incidents/${id}/comments`, { method: 'POST', body: { body } })
export const acknowledgeIncident = (id) => http(`/incidents/${id}/acknowledge`, { method: 'POST' })
export const escalateIncident = (id, reason) => http(`/incidents/${id}/escalate`, { method: 'POST', body: { reason } })
export const fetchSimilar = (id) => http(`/incidents/${id}/similar`)

export const fetchUsers = () => http('/users')
export const updateUserRole = (id, role) => http(`/users/${id}/role`, { method: 'PATCH', body: { role } })
export const createUser = (body) => http('/users', { method: 'POST', body })
export const updateUser = (id, body) => http(`/users/${id}`, { method: 'PATCH', body })
