import { prisma } from '../lib/prisma.js'
import { notFound } from '../lib/errors.js'

export async function notifyUsers(userIds, { type, title, body = null, incidentId = null }) {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return 0
  const res = await prisma.notification.createMany({ data: unique.map((userId) => ({ userId, type, title, body, incidentId })) })
  return res.count
}

export async function listNotifications(userId) {
  const [items, unread] = await prisma.$transaction([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])
  return { items, unread }
}

export async function markRead(userId, id) {
  const res = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } })
  if (res.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } })
    if (!exists) throw notFound('Notification not found')
  }
  return { ok: true }
}

export async function markAllRead(userId) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })
  return { ok: true }
}
