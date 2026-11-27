import { z } from 'zod'

export const STATUSES = ['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED']
export const SEVERITIES = ['SEV1', 'SEV2', 'SEV3', 'SEV4']
export const ROLES = ['ADMIN', 'RESPONDER', 'REPORTER']
export const CATEGORIES = ['NETWORK', 'DATABASE', 'APPLICATION', 'SECURITY', 'INFRASTRUCTURE', 'ACCESS', 'EMAIL', 'PERFORMANCE', 'HARDWARE', 'OTHER']
export const ASSET_TYPES = ['SERVER', 'DATABASE', 'NETWORK', 'APPLICATION', 'ENDPOINT', 'CLOUD', 'OTHER']
export const ASSET_STATUSES = ['ACTIVE', 'MAINTENANCE', 'RETIRED']
export const CRITICALITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const id = z.string().min(1).max(60)
const optionalText = (max) => z.string().trim().max(max)

export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(8).max(100),
  })
  .strict()

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1).max(100),
  })
  .strict()

export const createIncidentSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(1).max(5000),
    severity: z.enum(SEVERITIES),
    category: z.enum(CATEGORIES).optional(),
    assetId: id.optional(),
    teamId: id.optional(),
  })
  .strict()

export const updateIncidentSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(1).max(5000),
    severity: z.enum(SEVERITIES),
    status: z.enum(STATUSES),
    assigneeId: id.nullable(),
    category: z.enum(CATEGORIES).nullable(),
    assetId: id.nullable(),
    teamId: id.nullable(),
    rootCause: optionalText(2000).nullable(),
    resolutionNotes: optionalText(4000).nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' })

export const listIncidentsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    status: z.enum(STATUSES).optional(),
    severity: z.enum(SEVERITIES).optional(),
    category: z.enum(CATEGORIES).optional(),
    assigneeId: z.string().min(1).optional(),
    teamId: id.optional(),
    assetId: id.optional(),
    sla: z.enum(['breached', 'at_risk']).optional(),
    escalated: z.enum(['true']).optional(),
    q: z.string().trim().max(100).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'severity', 'status']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()

export const incidentIdSchema = z.object({ id: z.coerce.number().int().positive() })

export const commentSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict()

export const escalateSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict()

export const userIdSchema = z.object({ id: z.string().min(1) })

export const updateRoleSchema = z.object({ role: z.enum(ROLES) }).strict()

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(8).max(100),
    role: z.enum(ROLES).default('REPORTER'),
    teamId: id.optional(),
  })
  .strict()

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    role: z.enum(ROLES),
    teamId: id.nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' })

export const teamSchema = z.object({ name: z.string().trim().min(2).max(80), description: optionalText(300).nullable().optional() }).strict()
export const updateTeamSchema = teamSchema.partial().refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' })

export const assetSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    assetTag: z.string().trim().min(2).max(60),
    type: z.enum(ASSET_TYPES).default('OTHER'),
    status: z.enum(ASSET_STATUSES).default('ACTIVE'),
    criticality: z.enum(CRITICALITIES).default('MEDIUM'),
    environment: z.string().trim().min(1).max(40).default('production'),
    location: optionalText(120).nullable().optional(),
    description: optionalText(1000).nullable().optional(),
    ownerId: id.nullable().optional(),
  })
  .strict()
export const updateAssetSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    assetTag: z.string().trim().min(2).max(60),
    type: z.enum(ASSET_TYPES),
    status: z.enum(ASSET_STATUSES),
    criticality: z.enum(CRITICALITIES),
    environment: z.string().trim().min(1).max(40),
    location: optionalText(120).nullable(),
    description: optionalText(1000).nullable(),
    ownerId: id.nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' })
export const listAssetsSchema = z
  .object({ type: z.enum(ASSET_TYPES).optional(), status: z.enum(ASSET_STATUSES).optional(), q: z.string().trim().max(100).optional() })
  .strict()

export const stringIdSchema = z.object({ id: z.string().min(1).max(60) })

export const triageSchema = z
  .object({ title: z.string().trim().min(3).max(150), description: z.string().trim().min(1).max(5000), assetId: id.optional() })
  .strict()
export const agentParamsSchema = z.object({ id: z.coerce.number().int().positive(), agent: z.string().min(1).max(60) })
export const feedbackSchema = z
  .object({ accepted: z.boolean(), rating: z.number().int().min(1).max(5).optional(), comment: z.string().trim().max(500).optional() })
  .strict()
export const daysQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).strict()
export const executiveReportSchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).strict()
export const evalRunSchema = z.object({ mode: z.enum(['heuristic', 'live']).default('heuristic') }).strict()

export const activityQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(200).default(50), source: z.enum(['incident', 'audit', 'agent']).optional() })
  .strict()

export const exportQuerySchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    severity: z.enum(SEVERITIES).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict()
