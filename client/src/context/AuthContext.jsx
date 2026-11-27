import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../api/incidents.js'
import { tokenStore } from '../api/http.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(tokenStore.get()))

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!tokenStore.get()) return
    api
      .fetchMe()
      .then((res) => setUser(res.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const finish = useCallback((res) => {
    tokenStore.set(res.token)
    setUser(res.user)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (credentials) => finish(await api.login(credentials)),
      register: async (details) => finish(await api.register(details)),
      logout: () => {
        tokenStore.clear()
        setUser(null)
      },
    }),
    [user, loading, finish],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
