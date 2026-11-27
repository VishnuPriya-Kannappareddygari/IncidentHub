import * as analysis from './agents/incident-analysis.js'
import * as priority from './agents/priority-classification.js'
import * as rca from './agents/root-cause-analysis.js'
import * as resolution from './agents/resolution-recommendation.js'
import * as sla from './agents/sla-monitoring.js'
import * as reporting from './agents/reporting.js'

// The six specialised agents. Add a new agent here and in evals/cases.js.
export const AGENTS = [analysis, priority, rca, resolution, sla, reporting]

export const getAgent = (name) => AGENTS.find((a) => a.name === name)

export const describeAgents = () =>
  AGENTS.map(({ name, title, description, publicAccess }) => ({ name, title, description, mutates: false, publicAccess: Boolean(publicAccess) }))

export { analysis, priority, rca, resolution, sla, reporting }
