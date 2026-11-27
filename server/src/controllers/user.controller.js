import * as userService from '../services/user.service.js'

// Admins see everyone; responders only need the assignable (staff) list.
export const list = async (req, res) =>
  res.json(await userService.listUsers(req.user.role === 'ADMIN' ? undefined : ['ADMIN', 'RESPONDER']))
export const create = async (req, res) => res.status(201).json(await userService.createUser(req.user, req.valid.body))
export const update = async (req, res) => res.json(await userService.updateUser(req.user, req.valid.params.id, req.valid.body))
export const updateRole = async (req, res) =>
  res.json(await userService.updateRole(req.user, req.valid.params.id, req.valid.body.role))
