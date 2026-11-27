import { app } from './app.js'
import { env } from './config/env.js'
import { startSlaSweeper } from './services/sla.service.js'

app.listen(env.port, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', message: `API listening on port ${env.port}`, env: env.nodeEnv }))
  startSlaSweeper(env.slaSweepIntervalSeconds)
})
