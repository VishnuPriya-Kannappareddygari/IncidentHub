import { http } from './http.js'

export const fetchNotifications = () => http('/notifications')
export const markAllRead = () => http('/notifications/read-all', { method: 'POST' })
export const markRead = (id) => http(`/notifications/${id}/read`, { method: 'PATCH' })
