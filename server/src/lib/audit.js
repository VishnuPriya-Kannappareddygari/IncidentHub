import { prisma } from './prisma.js'

// Records non-incident administrative actions. Failures are logged and swallowed: auditing must not break the action.
export async function audit(actorId, action, entity, entityId = null, data = undefined) {
  try {
    await prisma.auditLog.create({ data: { actorId, action, entity, entityId: entityId == null ? null : String(entityId), data } })
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', event: 'audit_failed', action, message: err?.message }))
  }
}
