import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import LottiePlayer from '../components/ui/LottiePlayer'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pseudo.trim() || !password) return
    setLoading(true)
    try {
      await login(pseudo.trim(), password)
      toast.success(`Bienvenue ${pseudo} !`)
      navigate('/')
    } catch (e: any) {
      const status = e?.response?.status
      const detail = e?.response?.data

      if (status === 410 || detail?.expired) {
        toast.error('Compte expiré après 1 mois d\'inactivité — réinscris-toi', { duration: 6000 })
        navigate('/register')
      } else if (status === 401) {
        toast.error('Pseudo ou mot de passe incorrect')
      } else {
        toast.error('Erreur de connexion')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dls-page max-w-sm mx-auto flex flex-col items-center">
      <div className="mb-6">
        <LottiePlayer src="/lottie/soccer-loading.json" style={{ width: 80, height: 80 }}
          fallback={<div className="w-16 h-16 rounded-full" style={{ background: 'rgba(17,85,204,0.15)' }} />} />
      </div>

      <h1 className="text-2xl font-bold text-white mb-1">Connexion</h1>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>Accède à tes tournois DLS</p>

      <form onSubmit={submit} className="dls-card p-6 w-full flex flex-col gap-4">
        <div>
          <label className="dls-label">Pseudo</label>
          <input className="dls-input" placeholder="Ton pseudo" value={pseudo}
            onChange={e => setPseudo(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="dls-label">Mot de passe</label>
          <div className="relative">
            <input
              className="dls-input pr-10"
              type={showPwd ? 'text' : 'password'}
              placeholder="••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShowPwd(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: '#64748B' }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading || !pseudo || !password}
          className="dls-btn dls-btn-primary dls-btn-full flex items-center justify-center gap-2 mt-2">
          {loading ? <span className="dls-spinner dls-spinner-sm" /> : <LogIn size={16} />}
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <p className="text-sm mt-4" style={{ color: '#64748B' }}>
        Pas encore de compte ?{' '}
        <Link to="/register" style={{ color: '#4D8EFF' }}>Créer un compte</Link>
      </p>
    </div>
  )
}
