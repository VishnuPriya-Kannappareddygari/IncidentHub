import * as incidentService from '../services/incident.service.js'
import * as commentService from '../services/comment.service.js'

export const list = async (req, res) => res.json(await incidentService.listIncidents(req.valid.query))
export const get = async (req, res) => res.json(await incidentService.getIncident(req.valid.params.id))
export const create = async (req, res) => res.status(201).json(await incidentService.createIncident(req.user, req.valid.body))
export const update = async (req, res) =>
  res.json(await incidentService.updateIncident(req.user, req.valid.params.id, req.valid.body))
export const addComment = async (req, res) =>
  res.status(201).json(await commentService.addComment(req.user, req.valid.params.id, req.valid.body.body))
export const acknowledge = async (req, res) => res.json(await incidentService.acknowledgeIncident(req.user, req.valid.params.id))
export const escalate = async (req, res) =>
  res.json(await incidentService.escalate(req.user, req.valid.params.id, req.valid.body.reason))
export const similar = async (req, res) => res.json(await incidentService.getSimilarIncidents(req.valid.params.id))
