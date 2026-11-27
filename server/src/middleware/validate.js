import { badRequest } from '../lib/errors.js'

// source: 'body' | 'query' | 'params'. Parsed (coerced) values replace the raw ones.
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source])
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    return next(badRequest('Invalid request', details))
  }
  // req.query is a getter in some Express versions; store parsed data separately.
  req.valid = { ...(req.valid || {}), [source]: result.data }
  next()
}
