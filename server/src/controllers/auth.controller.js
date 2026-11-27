import * as authService from '../services/auth.service.js'

export const register = async (req, res) => res.status(201).json(await authService.register(req.valid.body))
export const login = async (req, res) => res.json(await authService.login(req.valid.body))
export const me = (req, res) => res.json({ user: req.user })
