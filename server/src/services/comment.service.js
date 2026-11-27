import { prisma } from '../lib/prisma.js'
import { notFound } from '../lib/errors.js'

export async function addComment(user, incidentId, body) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId }, select: { id: true } })
  if (!incident) throw notFound('Incident not found')

  // Comment and its audit event are written together or not at all.
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { incidentId, authorId: user.id, body },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    }),
    prisma.incidentEvent.create({ data: { incidentId, actorId: user.id, type: 'COMMENTED' } }),
  ])
  return comment
}
