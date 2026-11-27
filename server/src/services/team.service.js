import { prisma } from '../lib/prisma.js'
import { audit } from '../lib/audit.js'

const select = {
  id: true,
  name: true,
  description: true,
  members: { where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } },
  _count: { select: { incidents: true } },
}

export const listTeams = async () => ({ items: await prisma.team.findMany({ select, orderBy: { name: 'asc' } }) })

export async function createTeam(actor, input) {
  const team = await prisma.team.create({ data: input, select })
  await audit(actor.id, 'TEAM_CREATED', 'Team', team.id, { name: team.name })
  return team
}

export async function updateTeam(actor, id, input) {
  const team = await prisma.team.update({ where: { id }, data: input, select })
  await audit(actor.id, 'TEAM_UPDATED', 'Team', id, input)
  return team
}

export async function deleteTeam(actor, id) {
  await prisma.team.delete({ where: { id } })
  await audit(actor.id, 'TEAM_DELETED', 'Team', id)
}
