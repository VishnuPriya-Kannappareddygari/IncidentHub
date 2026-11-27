import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { audit } from '../lib/audit.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'

const select = { id: true, name: true, email: true, role: true, isActive: true, teamId: true, team: { select: { id: true, name: true } }, createdAt: true }

export const listUsers = (roles) =>
  prisma.user.findMany({ where: roles ? { role: { in: roles }, isActive: true } : undefined, select, orderBy: { name: 'asc' } })

export async function createUser(actor, { name, email, password, role, teamId }) {
  if (await prisma.user.findUnique({ where: { email } })) throw conflict('An account with this email already exists')
  const user = await prisma.user.create({
    data: { name, email, role, teamId, passwordHash: await bcrypt.hash(password, 10) },
    select,
  })
  await audit(actor.id, 'USER_CREATED', 'User', user.id, { role })
  return user
}

export async function updateUser(actor, id, input) {
  if (actor.id === id && (input.role !== undefined || input.isActive === false)) {
    throw badRequest('You cannot change your own role or deactivate yourself')
  }
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw notFound('User not found')
  const user = await prisma.user.update({ where: { id }, data: input, select })
  await audit(actor.id, 'USER_UPDATED', 'User', id, input)
  return user
}

export const updateRole = (actor, id, role) => updateUser(actor, id, { role })
