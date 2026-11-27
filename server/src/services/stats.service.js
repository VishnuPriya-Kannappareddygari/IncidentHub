import { prisma } from '../lib/prisma.js'
import { buildAnalytics } from './analytics.service.js'

const TREND_DAYS = 14

export async function getStats() {
  const [byStatus, bySeverity, recentEvents, unassignedOpen, analytics] = await Promise.all([
    prisma.incident.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.incident.groupBy({ by: ['severity'], _count: { _all: true } }),
    prisma.incidentEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { actor: { select: { id: true, name: true } }, incident: { select: { id: true, title: true } } },
    }),
    prisma.incident.count({ where: { assigneeId: null, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    buildAnalytics(30, TREND_DAYS),
  ])

  const statusCounts = Object.fromEntries(['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED'].map((s) => [s, 0]))
  byStatus.forEach((r) => (statusCounts[r.status] = r._count._all))
  const severityCounts = Object.fromEntries(['SEV1', 'SEV2', 'SEV3', 'SEV4'].map((s) => [s, 0]))
  bySeverity.forEach((r) => (severityCounts[r.severity] = r._count._all))

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0)
  const active = total - statusCounts.RESOLVED - statusCounts.CLOSED

  return {
    totals: { total, active, unassignedOpen },
    byStatus: statusCounts,
    bySeverity: severityCounts,
    trend: analytics.trend,
    trendResolved: analytics.trendResolved,
    recentActivity: recentEvents,
    kpis: analytics.kpis,
    byCategory: analytics.byCategory,
    workload: analytics.workload,
    byTeam: analytics.byTeam,
    slaWatchlist: analytics.slaWatchlist,
  }
}
