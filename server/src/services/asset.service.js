import { prisma } from '../lib/prisma.js'
import { audit } from '../lib/audit.js'
import { notFound } from '../lib/errors.js'
import { withSla } from './sla.service.js'

const select = {
  id: true, name: true, assetTag: true, type: true, status: true, criticality: true, environment: true, location: true, description: true,
  ownerId: true, owner: { select: { id: true, name: true } }, createdAt: true, updatedAt: true, _count: { select: { incidents: true } },
}

export async function listAssets({ type, status, q }) {
  const items = await prisma.asset.findMany({
    where: {
      ...(type && { type }),
      ...(status && { status }),
      ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { assetTag: { contains: q, mode: 'insensitive' } }] }),
    },
    select,
    orderBy: { name: 'asc' },
  })
  return { items }
}

export async function getAsset(id) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: {
      ...select,
      incidents: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true, severity: true, createdAt: true, responseDueAt: true, resolveDueAt: true, respondedAt: true, resolvedAt: true },
      },
    },
  })
  if (!asset) throw notFound('Asset not found')
  const { incidents, ...rest } = asset
  return { ...rest, recentIncidents: incidents.map((i) => withSla(i)) }
}

export async function createAsset(actor, input) {
  const asset = await prisma.asset.create({ data: input, select })
  await audit(actor.id, 'ASSET_CREATED', 'Asset', asset.id, { assetTag: asset.assetTag })
  return asset
}

export async function updateAsset(actor, id, input) {
  const asset = await prisma.asset.update({ where: { id }, data: input, select })
  await audit(actor.id, 'ASSET_UPDATED', 'Asset', id, input)
  return asset
}

export async function deleteAsset(actor, id) {
  await prisma.asset.delete({ where: { id } })
  await audit(actor.id, 'ASSET_DELETED', 'Asset', id)
}
