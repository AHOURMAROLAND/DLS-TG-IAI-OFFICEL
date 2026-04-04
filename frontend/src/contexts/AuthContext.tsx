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
    // Restaurer le token depuis localStorage immédiatement
    const savedToken = localStorage.getItem(TOKEN_KEY)
    if (savedToken) {
      api.setToken(savedToken)
      // Décoder le token JWT localement pour restaurer l'user sans appel réseau
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]))
        const exp = payload.exp * 1000
        if (exp > Date.now()) {
          // Token encore valide — restaurer l'user immédiatement
          setUser({ id: payload.sub, pseudo: payload.pseudo })
          setLoading(false)
          // Vérifier en arrière-plan (sans bloquer l'UI)
          api.getMe().then(u => { if (u) setUser(u) }).catch(() => {})
          return
        }
      } catch {
        // Token malformé — continuer avec la vérification normale
      }
    }

    api.getMe()
      .then(u => { if (u) setUser(u) })
      .catch(() => {})
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
