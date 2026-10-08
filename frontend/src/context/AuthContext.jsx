import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api, { clearAuth, loadAuth, saveAuth } from '../api/client'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadAuth())

  const logout = useCallback(() => { clearAuth(); setAuth(null) }, [])
  useEffect(() => {
    window.addEventListener('auth:logout', logout)
    return () => window.removeEventListener('auth:logout', logout)
  }, [logout])

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    const a = { token: data.access_token, role: data.role, name: data.full_name }
    saveAuth(a)
    setAuth(a)
    return a
  }

  return <AuthCtx.Provider value={{ auth, login, logout }}>{children}</AuthCtx.Provider>
}
