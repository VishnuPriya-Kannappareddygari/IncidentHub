// Golden cases for agent evaluation. Add a case whenever an agent gets something wrong in production.
// expect: category | severity | anyOf (keywords expected somewhere in the text of the output) | sla counts | reporting keywords

const T = (title, description, extra = {}) => ({ title, description, ...extra })

const triageCases = [
  { name: 'checkout 500s', input: T('Checkout API returning 500s', 'Error rate above 20% since 09:10 UTC for all users in production.'), category: 'APPLICATION', severity: 'SEV1' },
  { name: 'db latency', input: T('DB latency spike', 'p95 above 2s on the orders cluster, queries timing out.'), category: 'DATABASE', severity: 'SEV2' },
  { name: 'email delays', input: T('Email notifications delayed', 'Queue depth growing, about 15 min delay for some users.'), category: 'EMAIL', severity: 'SEV3' },
  { name: 'status page typo', input: T('Typo on status page', 'Cosmetic copy fix needed on the wording of the footer.'), category: 'APPLICATION', severity: 'SEV4' },
  { name: 'vpn outage', input: T('VPN unreachable for remote staff', 'VPN gateway down, 300 employees cannot reach the office network. Firewall change last night.'), category: 'NETWORK', severity: 'SEV1' },
  { name: 'phishing', input: T('Phishing email reported', 'Several staff received a suspicious phishing email and one user clicked the link. Possible compromised account.'), category: 'SECURITY', severity: 'SEV2' },
  { name: 'sso lockout', input: T('Users locked out of SSO', 'Many users cannot sign in, authentication fails with access denied after MFA prompt.'), category: 'ACCESS', severity: 'SEV2' },
  { name: 'laptop battery', input: T('Laptop battery not charging', 'Single laptop battery will not charge; request replacement hardware.'), category: 'HARDWARE', severity: 'SEV4' },
  { name: 'disk full', input: T('Server disk full on app host', 'Disk full on the app server, out of space causing failing writes; workaround is to purge logs.'), category: 'INFRASTRUCTURE', severity: 'SEV2' },
  { name: 'ransomware', input: T('Ransomware note on file share', 'Ransomware detected on the finance file share, data loss possible, production affected.'), category: 'SECURITY', severity: 'SEV1' },
]

const rcaCases = [
  { name: 'rca database', input: { ...T('DB latency spike', 'p95 above 2s on the orders cluster, queries timing out.'), category: 'DATABASE' }, anyOf: ['connection pool', 'query', 'index'] },
  { name: 'rca network', input: { ...T('VPN unreachable', 'VPN gateway down after firewall change, DNS lookups failing.'), category: 'NETWORK' }, anyOf: ['firewall', 'dns', 'network'] },
  { name: 'rca application', input: { ...T('Checkout API 500s', 'Error rate above 20% after release.'), category: 'APPLICATION' }, anyOf: ['deployment', 'regression', 'dependency'] },
  { name: 'rca uses similar incident', input: { ...T('Orders slow', 'Order queries slow again.'), category: 'DATABASE', similar: [{ id: 7, score: 0.8, rootCause: 'Vacuum job starved autovacuum workers' }] }, anyOf: ['autovacuum'] },
]

const resolutionCases = [
  { name: 'resolution database', input: { ...T('DB latency spike', 'p95 above 2s'), category: 'DATABASE' }, anyOf: ['query', 'pool', 'index'] },
  { name: 'resolution security', input: { ...T('Suspicious login', 'Compromised account suspected'), category: 'SECURITY' }, anyOf: ['isolate', 'rotate', 'contain'] },
  { name: 'resolution reuses fix', input: { ...T('Mail delays', 'queue depth growing'), category: 'EMAIL', similar: [{ id: 3, resolutionNotes: 'Raised relay throttle limit' }] }, anyOf: ['relay throttle'] },
]

const slaCases = [
  {
    name: 'sla counts',
    input: {
      incidents: [
        { id: 1, severity: 'SEV1', status: 'INVESTIGATING', assignee: 'Rex', escalationLevel: 1, sla: { overall: 'BREACHED', resolution: { minutesRemaining: -45 } } },
        { id: 2, severity: 'SEV2', status: 'OPEN', assignee: null, escalationLevel: 0, sla: { overall: 'AT_RISK', resolution: { minutesRemaining: 90 } } },
        { id: 3, severity: 'SEV3', status: 'OPEN', assignee: 'Ada', escalationLevel: 0, sla: { overall: 'ON_TRACK', resolution: { minutesRemaining: 900 } } },
      ],
    },
    counts: { breached: 1, atRisk: 1, healthy: 1 },
    mustMention: [1, 2],
  },
]

const reportingCases = [
  {
    name: 'report summary',
    input: { period: { days: 30 }, totals: { created: 42, resolved: 38, active: 4 }, kpis: { slaCompliancePct: 85, mttrMinutes: 180, breached: 2 }, bySeverity: { SEV1: 1 }, byCategory: { DATABASE: 12, NETWORK: 5 }, sla: { compliancePct: 85 }, topAssets: [{ name: 'orders-db', count: 9 }] },
    mustInclude: ['42', '85', 'database'],
  },
]

export const CASES = [
  ...triageCases.map((c) => ({ agent: 'incident-analysis', ...c })),
  ...triageCases.map((c) => ({ agent: 'priority-classification', ...c })),
  ...rcaCases.map((c) => ({ agent: 'root-cause-analysis', ...c })),
  ...resolutionCases.map((c) => ({ agent: 'resolution-recommendation', ...c })),
  ...slaCases.map((c) => ({ agent: 'sla-monitoring', ...c })),
  ...reportingCases.map((c) => ({ agent: 'reporting', ...c })),
]
