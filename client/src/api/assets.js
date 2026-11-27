import { http } from './http.js'

export const fetchAssets = (query) => http('/assets', { query })
export const fetchAsset = (id) => http(`/assets/${id}`)
export const createAsset = (body) => http('/assets', { method: 'POST', body })
export const updateAsset = (id, body) => http(`/assets/${id}`, { method: 'PATCH', body })
export const deleteAsset = (id) => http(`/assets/${id}`, { method: 'DELETE' })
