import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api from '../lib/api'
import type { AuthUser } from '../lib/api'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (pseudo: string, password: string) => Promise<void>
  register: (pseudo: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)
const TOKEN_KEY = 'dls_auth_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Vérifier la session au chargement
  useEffect(() => {
    api.getMe()
      .then(u => setUser(u))
      .finally(() => setLoading(false))
  }, [])

  const login = async (pseudo: string, password: string) => {
    const data = await api.login(pseudo, password)
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token)
      api.setToken(data.token)
    }
    setUser({ id: data.id, pseudo: data.pseudo })
  }

  const register = async (pseudo: string, password: string) => {
    const data = await api.register(pseudo, password)
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token)
      api.setToken(data.token)
    }
    setUser({ id: data.id, pseudo: data.pseudo })
  }

  const logout = async () => {
    await api.logout()
    localStorage.removeItem(TOKEN_KEY)
    api.setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
