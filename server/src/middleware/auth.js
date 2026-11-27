import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { forbidden, unauthorized } from '../lib/errors.js'
import { asyncHandler } from './async-handler.js'

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw unauthorized()

  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret)
  } catch {
    throw unauthorized('Invalid or expired token')
  }

  // Load the user each request so role changes and deletions take effect immediately.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })
  if (!user) throw unauthorized('Account no longer exists')
  if (!user.isActive) throw unauthorized('This account has been deactivated')
  req.user = user
  next()
})

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(forbidden())
  next()
}
