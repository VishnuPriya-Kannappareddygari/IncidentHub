import { http } from './http.js'

export const fetchActivity = (query) => http('/activity', { query })
