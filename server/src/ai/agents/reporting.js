import { z } from 'zod'
import { SYSTEM_PREAMBLE } from './util.js'

export const name = 'reporting'
export const title = 'Reporting Agent'
export const description = 'Writes an executive summary of incident volume, SLA performance, hotspots and recommendations from report data.'

export const schema = z.object({
  headline: z.string().min(1).max(200),
  narrative: z.string().min(1).max(1200),
  highlights: z.array(z.string().max(250)).max(8),
  risks: z.array(z.string().max(250)).max(6),
  recommendations: z.array(z.string().max(250)).max(6),
})

const top = (obj = {}) => Object.entries(obj).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0]

// input: report summary { period, totals, kpis, bySeverity, byCategory, sla, topAssets }
export function heuristic(input) {
  const { period = {}, totals = {}, kpis = {}, bySeverity = {}, byCategory = {}, sla = {}, topAssets = [] } = input
  const topCat = top(byCategory)
  const highlights = [
    `${totals.created ?? 0} incidents created and ${totals.resolved ?? 0} resolved in the last ${period.days ?? 30} days`,
    `SLA compliance ${sla.compliancePct ?? kpis.slaCompliancePct ?? 100}%`,
  ]
  if (kpis.mttrMinutes) highlights.push(`Mean time to resolve ${Math.round(kpis.mttrMinutes)} minutes`)
  if (topCat) highlights.push(`Most common category: ${topCat[0].toLowerCase()} (${topCat[1]})`)
  if (topAssets[0]) highlights.push(`Most affected asset: ${topAssets[0].name} (${topAssets[0].count} incidents)`)

  const risks = []
  if ((kpis.breached ?? 0) > 0) risks.push(`${kpis.breached} incident(s) currently breaching SLA`)
  if ((bySeverity.SEV1 ?? 0) > 0) risks.push(`${bySeverity.SEV1} SEV1 incident(s) in the period`)
  if ((totals.active ?? 0) > (totals.resolved ?? 0)) risks.push('Backlog is growing: active incidents exceed resolutions')

  const recommendations = []
  if (topCat) recommendations.push(`Run a problem-management review for recurring ${topCat[0].toLowerCase()} incidents`)
  if (topAssets[0]) recommendations.push(`Schedule a health review of ${topAssets[0].name}`)
  if ((kpis.slaCompliancePct ?? 100) < 90) recommendations.push('Review staffing and escalation paths: SLA compliance is below 90%')
  if (recommendations.length === 0) recommendations.push('Maintain current practices and keep monitoring SLA trends')

  const compliance = sla.compliancePct ?? kpis.slaCompliancePct ?? 100
  return {
    headline: `${compliance >= 90 ? 'Stable' : 'Attention needed'}: ${totals.created ?? 0} incidents, ${compliance}% SLA compliance`,
    narrative: `Over the last ${period.days ?? 30} days the team handled ${totals.created ?? 0} incidents and resolved ${totals.resolved ?? 0}. ${risks.length ? `Key risks: ${risks.join('; ')}.` : 'No significant risks were detected.'}`.slice(0, 1200),
    highlights,
    risks,
    recommendations,
  }
}

export function prompt(input) {
  return {
    system: SYSTEM_PREAMBLE,
    user: `<context_data>\n${JSON.stringify(input).slice(0, 4000)}\n</context_data>\n\nWrite an executive incident report for IT leadership using only the numbers given. Return JSON: {"headline": string, "narrative": string, "highlights": string[], "risks": string[], "recommendations": string[]}`,
    maxTokens: 1000,
  }
}
