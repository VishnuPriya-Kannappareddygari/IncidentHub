import { download, http } from './http.js'

export const fetchSummary = (days) => http('/reports/summary', { query: { days } })
export const downloadIncidentsCsv = (query) => download('/reports/incidents.csv', 'incidents.csv', query)
export const downloadIncidentsJson = (query) => download('/reports/incidents.json', 'incidents.json', query)
export const downloadSlaCsv = () => download('/reports/sla.csv', 'sla.csv')
