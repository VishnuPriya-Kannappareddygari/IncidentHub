// Domain knowledge for the deterministic (offline) agents: category keywords, RCA hypotheses and resolution playbooks.
export const CATEGORIES = ['NETWORK', 'DATABASE', 'APPLICATION', 'SECURITY', 'INFRASTRUCTURE', 'ACCESS', 'EMAIL', 'PERFORMANCE', 'HARDWARE', 'OTHER']

// Order matters: earlier categories win ties.
export const CATEGORY_KEYWORDS = {
  SECURITY: ['breach', 'malware', 'ransomware', 'phishing', 'unauthorized', 'unauthorised', 'intrusion', 'vulnerability', 'exploit', 'suspicious', 'leak', 'compromised', 'ddos'],
  DATABASE: ['database', 'sql', 'postgres', 'mysql', 'query', 'queries', 'replication', 'deadlock', 'connection pool', 'orders cluster', 'db'],
  NETWORK: ['network', 'vpn', 'dns', 'firewall', 'packet', 'switch', 'router', 'wifi', 'wi-fi', 'bandwidth', 'unreachable', 'load balancer'],
  ACCESS: ['login', 'log in', 'password', 'locked out', 'sso', 'mfa', 'permission', 'access denied', 'sign in', 'account locked', 'authentication'],
  EMAIL: ['email', 'e-mail', 'smtp', 'mailbox', 'outlook', 'notification', 'notifications', 'queue depth'],
  HARDWARE: ['laptop', 'printer', 'monitor', 'keyboard', 'disk failure', 'hardware', 'battery', 'power supply', 'raid'],
  INFRASTRUCTURE: ['kubernetes', 'k8s', 'pod', 'container', 'disk full', 'out of space', 'vm', 'aws', 'azure', 'node down', 'datacenter', 'server', 'cpu', 'memory'],
  PERFORMANCE: ['slow', 'latency', 'p95', 'p99', 'degraded', 'memory leak', 'throughput', 'response time'],
  APPLICATION: ['api', '500', '500s', 'error', 'exception', 'crash', 'bug', 'checkout', 'page', 'feature', 'release', 'regression', 'app', 'typo'],
}

export const RCA_LIBRARY = {
  DATABASE: [
    { cause: 'Connection pool exhaustion or long-running queries holding locks', evidence: 'Database symptoms: latency, timeouts or errors under load', verificationSteps: ['Check active connections versus pool limit', 'List longest running queries and blocking locks', 'Compare error onset with recent deploys or traffic spikes'] },
    { cause: 'Missing index or regressed query plan after a schema or data change', evidence: 'Slow queries with stable traffic suggest plan regression', verificationSteps: ['Run EXPLAIN ANALYZE on the slowest query', 'Check recent migrations and table growth'] },
    { cause: 'Replication lag or storage saturation on the primary', evidence: 'Reads stale or writes stall', verificationSteps: ['Check replica lag metrics', 'Check disk and IOPS saturation'] },
  ],
  NETWORK: [
    { cause: 'Misconfigured or failing network device (firewall rule, switch, load balancer)', evidence: 'Connectivity failures across multiple clients', verificationSteps: ['Review recent firewall or routing changes', 'Run traceroute and packet capture between affected hosts'] },
    { cause: 'DNS resolution failure or stale records', evidence: 'Name lookups fail while IP access works', verificationSteps: ['Resolve the hostname from affected and healthy networks', 'Check DNS provider status and TTLs'] },
    { cause: 'Bandwidth saturation or upstream provider outage', evidence: 'Degradation correlates with peak usage', verificationSteps: ['Inspect interface utilisation graphs', 'Check ISP status page'] },
  ],
  APPLICATION: [
    { cause: 'Regression introduced by a recent deployment', evidence: 'Errors began shortly after a release', verificationSteps: ['Compare error onset with deployment timeline', 'Diff the last release and review feature flags', 'Check error logs for the first stack trace'] },
    { cause: 'Failing downstream dependency (third-party API, database, queue)', evidence: 'Errors reference upstream timeouts or 5xx responses', verificationSteps: ['Check dependency health dashboards', 'Inspect timeout and retry metrics'] },
    { cause: 'Configuration or secret change (expired credential, wrong environment variable)', evidence: 'Sudden uniform failure without code change', verificationSteps: ['Audit recent config changes', 'Verify credential and certificate expiry'] },
  ],
  SECURITY: [
    { cause: 'Compromised credential or phishing-led account takeover', evidence: 'Unusual sign-ins or unauthorised activity', verificationSteps: ['Review authentication logs for anomalous locations', 'Check for new MFA devices or forwarding rules'] },
    { cause: 'Exploited unpatched vulnerability', evidence: 'Anomalous process or network behaviour on an exposed system', verificationSteps: ['Compare installed versions with advisories', 'Preserve logs and take a forensic snapshot'] },
  ],
  INFRASTRUCTURE: [
    { cause: 'Resource exhaustion (CPU, memory, disk) on the host or node', evidence: 'Degradation with saturated metrics', verificationSteps: ['Check CPU, memory and disk utilisation history', 'Look for runaway processes or log growth'] },
    { cause: 'Failed rollout or unhealthy container scheduling', evidence: 'Instances restarting or unavailable', verificationSteps: ['Inspect orchestrator events and restart counts', 'Roll back to the last healthy version to test'] },
  ],
  ACCESS: [
    { cause: 'Identity provider, SSO or MFA service disruption', evidence: 'Many users cannot authenticate at once', verificationSteps: ['Check identity provider status', 'Review recent policy or certificate changes'] },
    { cause: 'Account locked or permissions changed for the affected user group', evidence: 'Access denied for a specific group', verificationSteps: ['Inspect account status and group membership', 'Review recent access-control changes'] },
  ],
  EMAIL: [
    { cause: 'Mail queue backlog or relay throttling', evidence: 'Delivery delays with growing queue depth', verificationSteps: ['Check queue depth and oldest message age', 'Check provider rate limits and bounces'] },
    { cause: 'SPF/DKIM or DNS misconfiguration causing rejections', evidence: 'Bounces or spam-folder delivery', verificationSteps: ['Validate SPF, DKIM and DMARC records', 'Review bounce codes'] },
  ],
  PERFORMANCE: [
    { cause: 'Capacity shortfall under increased load', evidence: 'Latency rises with traffic', verificationSteps: ['Compare load against capacity baselines', 'Check autoscaling activity'] },
    { cause: 'Inefficient code path or memory leak introduced recently', evidence: 'Gradual degradation or growth in memory', verificationSteps: ['Profile the hot path', 'Check memory growth across restarts'] },
  ],
  HARDWARE: [
    { cause: 'Physical component failure (disk, power, battery, peripheral)', evidence: 'Hardware fault indicators or SMART warnings', verificationSteps: ['Run vendor diagnostics', 'Swap with a known-good component'] },
  ],
  OTHER: [
    { cause: 'Insufficient information to isolate a single cause', evidence: 'Description lacks technical detail', verificationSteps: ['Ask the reporter for exact error messages and timestamps', 'Identify the affected users, systems and recent changes'] },
  ],
}

// steps: [action, risk, rollback?]
export const PLAYBOOKS = {
  DATABASE: { steps: [['Confirm scope with connection and slow-query dashboards', 'LOW'], ['Terminate blocking or runaway queries after owner approval', 'MEDIUM', 'Restart the session pool if queries were killed incorrectly'], ['Scale or recycle the connection pool', 'MEDIUM', 'Revert pool settings'], ['Add or restore the missing index once validated in staging', 'HIGH', 'Drop the new index']], prevent: ['Add slow-query and pool-saturation alerts', 'Load-test migrations before release'], minutes: 90 },
  NETWORK: { steps: [['Identify the affected segment and compare with a healthy path', 'LOW'], ['Fail over to the redundant link or device', 'MEDIUM', 'Fail back after validation'], ['Roll back the latest firewall or routing change', 'MEDIUM', 'Re-apply the change after review'], ['Engage the carrier or provider with captured evidence', 'LOW']], prevent: ['Peer-review network changes', 'Add synthetic connectivity probes'], minutes: 120 },
  APPLICATION: { steps: [['Check logs and error rates to confirm blast radius', 'LOW'], ['Roll back or disable the feature flag for the latest release', 'MEDIUM', 'Redeploy the release once fixed'], ['Restart or scale the affected service if state is corrupt', 'MEDIUM', 'Scale back to the previous size'], ['Ship a validated hotfix through the normal pipeline', 'HIGH', 'Roll back the hotfix']], prevent: ['Canary deployments with automatic rollback', 'Add regression tests for this failure'], minutes: 90 },
  SECURITY: { steps: [['Contain: isolate affected hosts or disable affected accounts', 'MEDIUM', 'Re-enable after clearance'], ['Preserve logs and evidence before remediation', 'LOW'], ['Rotate exposed credentials and keys', 'MEDIUM', 'Restore previous keys only if rotation breaks critical services'], ['Patch or block the exploited vector and notify the security team', 'HIGH', 'Revert the patch if it causes outages']], prevent: ['Enforce MFA and patch SLAs', 'Run phishing awareness exercises'], minutes: 240 },
  INFRASTRUCTURE: { steps: [['Check resource saturation and recent changes', 'LOW'], ['Free space or restart the runaway process', 'MEDIUM', 'Restore from backup if data was removed'], ['Scale out or replace the unhealthy node', 'MEDIUM', 'Drain and revert'], ['Roll back the last rollout if instances keep crashing', 'MEDIUM', 'Redeploy after fix']], prevent: ['Capacity alerts at 80%', 'Automated log rotation'], minutes: 90 },
  ACCESS: { steps: [['Verify identity provider status and scope of affected users', 'LOW'], ['Unlock or reset the affected accounts using the approved process', 'LOW'], ['Revert the recent policy or group change', 'MEDIUM', 'Re-apply with corrected scope'], ['Provide a temporary access workaround for critical staff', 'MEDIUM', 'Revoke after resolution']], prevent: ['Staged rollout of policy changes', 'Self-service password reset'], minutes: 45 },
  EMAIL: { steps: [['Check queue depth and delivery logs', 'LOW'], ['Restart the mail relay or increase throughput limits', 'MEDIUM', 'Restore limits'], ['Correct SPF, DKIM or DNS records', 'MEDIUM', 'Revert DNS changes'], ['Notify users of expected delays', 'LOW']], prevent: ['Alert on queue age', 'Monitor sender reputation'], minutes: 60 },
  PERFORMANCE: { steps: [['Capture profiles and metrics for the slow path', 'LOW'], ['Scale horizontally or raise resource limits', 'MEDIUM', 'Scale back down'], ['Enable caching or shed non-critical load', 'MEDIUM', 'Disable the cache layer'], ['Fix the inefficient code path in a patch release', 'HIGH', 'Roll back the patch']], prevent: ['Performance budgets in CI', 'Autoscaling with load tests'], minutes: 120 },
  HARDWARE: { steps: [['Run diagnostics and record the failure', 'LOW'], ['Swap in a loaner or spare device', 'LOW'], ['Raise a vendor warranty claim for the faulty part', 'LOW']], prevent: ['Proactive hardware health monitoring'], minutes: 60 },
  OTHER: { steps: [['Collect missing details from the reporter', 'LOW'], ['Reproduce the issue and capture logs', 'LOW'], ['Re-triage with the new information', 'LOW']], prevent: ['Use an incident template that captures error text and timestamps'], minutes: 60 },
}

export const SEVERITY_SIGNALS = {
  SEV1: ['outage', 'down', 'data loss', 'breach', 'ransomware', 'all users', 'unavailable', 'cannot process', 'payments failing', 'checkout', '500s', 'critical', 'production down'],
  SEV2: ['phishing', 'compromised', 'suspicious', 'major', 'degraded', 'partial', 'many users', 'error rate', 'high latency', 'p95', 'failing', 'replication', 'blocked'],
  SEV3: ['delayed', 'intermittent', 'some users', 'slow', 'workaround', 'queue', 'minor'],
  SEV4: ['typo', 'cosmetic', 'question', 'request', 'copy', 'colour', 'color', 'wording', 'enhancement'],
}
