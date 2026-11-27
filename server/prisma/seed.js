import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SLA = { SEV1: [15, 240], SEV2: [30, 480], SEV3: [120, 1440], SEV4: [480, 4320] }
const ago = (minutes) => new Date(Date.now() - minutes * 60000)

// Dev/test data only. Never run against production.
async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password) throw new Error('SEED_ADMIN_PASSWORD is required')
  const passwordHash = await bcrypt.hash(password, 10)

  const platform = await prisma.team.upsert({ where: { name: 'Platform Engineering' }, update: {}, create: { name: 'Platform Engineering', description: 'Infrastructure, databases and deployments' } })
  await prisma.team.upsert({ where: { name: 'Service Desk' }, update: {}, create: { name: 'Service Desk', description: 'First-line user support' } })

  const upsertUser = (email, name, role, teamId) =>
    prisma.user.upsert({ where: { email }, update: {}, create: { email, name, role, passwordHash, teamId } })

  const admin = await upsertUser('admin@incidenthub.test', 'Ada Admin', 'ADMIN', platform.id)
  const responder = await upsertUser('responder@incidenthub.test', 'Rex Responder', 'RESPONDER', platform.id)
  const reporter = await upsertUser('reporter@incidenthub.test', 'Rita Reporter', 'REPORTER', null)

  const upsertAsset = (assetTag, name, type, criticality, ownerId) =>
    prisma.asset.upsert({ where: { assetTag }, update: {}, create: { assetTag, name, type, criticality, ownerId, environment: 'production' } })
  const checkout = await upsertAsset('APP-001', 'Checkout Service', 'APPLICATION', 'CRITICAL', responder.id)
  const ordersDb = await upsertAsset('DB-001', 'Orders Database', 'DATABASE', 'CRITICAL', responder.id)
  const mail = await upsertAsset('SRV-010', 'Mail Relay', 'SERVER', 'MEDIUM', admin.id)
  await upsertAsset('NET-001', 'Edge Firewall', 'NETWORK', 'HIGH', admin.id)

  if ((await prisma.incident.count()) > 0) {
    console.log('Incidents already present; skipping sample incidents.')
    return
  }

  const samples = [
    { title: 'Checkout API returning 500s', description: 'Error rate above 20% since 09:10 UTC.', severity: 'SEV1', status: 'INVESTIGATING', category: 'APPLICATION', assigneeId: responder.id, assetId: checkout.id, age: 100, responded: 90 },
    { title: 'DB latency spike', description: 'p95 above 2s on the orders cluster.', severity: 'SEV2', status: 'MITIGATED', category: 'DATABASE', assigneeId: responder.id, assetId: ordersDb.id, age: 300, responded: 280 },
    { title: 'Email notifications delayed', description: 'Queue depth growing, about 15 min delay.', severity: 'SEV3', status: 'OPEN', category: 'EMAIL', assigneeId: null, assetId: mail.id, age: 60, responded: null },
    { title: 'Typo on status page', description: 'Cosmetic copy fix.', severity: 'SEV4', status: 'RESOLVED', category: 'APPLICATION', assigneeId: admin.id, assetId: null, age: 1000, responded: 900, resolved: 400, rootCause: 'Copy not proofread before publishing', resolutionNotes: 'Corrected wording and redeployed status page' },
  ]
  for (const { age, responded, resolved, ...s } of samples) {
    const createdAt = ago(age)
    const [responseMin, resolveMin] = SLA[s.severity]
    await prisma.incident.create({
      data: {
        ...s,
        reporterId: reporter.id,
        createdAt,
        respondedAt: responded === null ? null : ago(responded),
        resolvedAt: resolved ? ago(resolved) : null,
        responseDueAt: new Date(createdAt.getTime() + responseMin * 60000),
        resolveDueAt: new Date(createdAt.getTime() + resolveMin * 60000),
        events: { create: { actorId: reporter.id, type: 'CREATED', data: { severity: s.severity } } },
      },
    })
  }
  console.log('Seeded 3 users, 2 teams, 4 assets and 4 incidents.')
}

main().finally(() => prisma.$disconnect())
