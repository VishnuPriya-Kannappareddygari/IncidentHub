import { HttpError } from '../lib/errors.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found', details: [] } })
}

// Maps Prisma known errors to HTTP statuses (P2002 unique, P2025 missing, P2003 FK).
const prismaStatus = { P2002: [409, 'CONFLICT'], P2025: [404, 'NOT_FOUND'], P2003: [400, 'VALIDATION_ERROR'] }

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body', details: [] } })
  }
  if (err?.code && prismaStatus[err.code]) {
    const [status, code] = prismaStatus[err.code]
    return res.status(status).json({ error: { code, message: 'Database constraint failed', details: [] } })
  }

  console.error(JSON.stringify({ level: 'error', message: err?.message, stack: err?.stack }))
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', details: [] } })
}
