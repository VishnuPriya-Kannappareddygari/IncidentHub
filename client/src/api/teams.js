import { http } from './http.js'

export const fetchTeams = () => http('/teams')
export const createTeam = (body) => http('/teams', { method: 'POST', body })
export const updateTeam = (id, body) => http(`/teams/${id}`, { method: 'PATCH', body })
export const deleteTeam = (id) => http(`/teams/${id}`, { method: 'DELETE' })
