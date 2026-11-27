import { getStats } from '../services/stats.service.js'

export const stats = async (req, res) => res.json(await getStats())
