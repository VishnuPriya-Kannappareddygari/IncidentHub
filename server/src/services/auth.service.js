import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { conflict, unauthorized } from '../lib/errors.js'

const publicUser = { id: true, email: true, name: true, role: true, createdAt: true }

const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })

export async function register({ name, email, password }) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw conflict('An account with this email already exists')

  // Self-registration is always REPORTER; only an admin can promote.
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { name, email, passwordHash }, select: publicUser })
  return { user, token: signToken(user) }
}

export async function login({ email, password }) {
  const record = await prisma.user.findUnique({ where: { email } })
  // Same message for unknown email and bad password to avoid account enumeration.
  const valid = record && (await bcrypt.compare(password, record.passwordHash))
  if (!valid) throw unauthorized('Invalid email or password')
  if (!record.isActive) throw unauthorized('This account has been deactivated')

  const { passwordHash, ...user } = record
  return { user, token: signToken(user) }
}
