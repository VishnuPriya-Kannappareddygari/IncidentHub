import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import activityRoutes from './routes/activity.routes.js'
import aiRoutes from './routes/ai.routes.js'
import assetRoutes from './routes/asset.routes.js'
import authRoutes from './routes/auth.routes.js'
import incidentRoutes from './routes/incident.routes.js'
import notificationRoutes from './routes/notification.routes.js'
import reportRoutes from './routes/report.routes.js'
import slaRoutes from './routes/sla.routes.js'
import statsRoutes from './routes/stats.routes.js'
import teamRoutes from './routes/team.routes.js'
import userRoutes from './routes/user.routes.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.corsOrigin }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/incidents', incidentRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/stats', statsRoutes)
app.use('/api/v1/assets', assetRoutes)
app.use('/api/v1/teams', teamRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/activity', activityRoutes)
app.use('/api/v1/reports', reportRoutes)
app.use('/api/v1/sla', slaRoutes)
app.use('/api/v1/ai', aiRoutes)

// Single-service hosting: when the client has been built (client/dist), serve it from the same
// origin so one deploy hosts both UI and API. Skipped in dev, where Vite serves the UI.
const clientDist = process.env.CLIENT_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { redirect: false }))
  // SPA fallback: any non-API GET returns index.html so client-side routes survive a refresh.
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

app.use(notFoundHandler)
app.use(errorHandler)
