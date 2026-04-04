import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserPlus, Eye, EyeOff, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { debounce } from '../lib/utils'

interface PwdRule { label: string; ok: boolean }

function checkPassword(pwd: string): PwdRule[] {
  return [
    { label: 'Au moins 6 caractères', ok: pwd.length >= 6 },
    { label: 'Une majuscule', ok: /[A-Z]/.test(pwd) },
    { label: 'Un chiffre', ok: /\d/.test(pwd) },
    { label: 'Un caractère spécial (!@#$...)', ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd) },
  ]
}

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pseudoStatus, setPseudoStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle')
  const [suggestions, setSuggestions] = useState<string[]>([])

  const pwdRules = checkPassword(password)
  const pwdValid = pwdRules.every(r => r.ok)

  // Vérification pseudo en temps réel
  useEffect(() => {
    if (pseudo.length < 3) { setPseudoStatus('idle'); setSuggestions([]); return }
    setPseudoStatus('checking')
    const check = debounce(async () => {
      const res = await api.checkPseudo(pseudo)
      setPseudoStatus(res.available ? 'ok' : 'taken')
      setSuggestions(res.available ? [] : res.suggestions)
    }, 600)
    check()
  }, [pseudo])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwdValid || pseudoStatus !== 'ok') return
    setLoading(true)
    try {
      await register(pseudo.trim(), password)
      toast.success(`Compte créé ! Bienvenue ${pseudo} 🎉`)
      navigate('/')
    } catch (e: any) {
      const detail = e?.response?.data
      if (detail?.suggestions) {
        setSuggestions(detail.suggestions)
        setPseudoStatus('taken')
        toast.error(detail.message || 'Pseudo déjà pris')
      } else {
        toast.error(detail?.detail || 'Erreur lors de la création du compte')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dls-page max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1 text-center">Créer un compte</h1>
      <p className="text-sm mb-6 text-center" style={{ color: '#94A3B8' }}>
        Pour créer et gérer tes tournois DLS
      </p>

      <form onSubmit={submit} className="dls-card p-6 flex flex-col gap-4">
        {/* Pseudo */}
        <div>
          <label className="dls-label">Pseudo *</label>
          <div className="relative">
            <input className={`dls-input pr-8 ${pseudoStatus === 'taken' ? 'dls-input-error' : ''}`}
              placeholder="Ton pseudo unique (min 3 chars)"
              value={pseudo} onChange={e => setPseudo(e.target.value)} autoFocus />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {pseudoStatus === 'checking' && <span className="dls-spinner dls-spinner-sm" />}
              {pseudoStatus === 'ok' && <Check size={14} style={{ color: '#4ADE80' }} />}
              {pseudoStatus === 'taken' && <X size={14} style={{ color: '#F87171' }} />}
            </div>
          </div>
          {pseudoStatus === 'taken' && suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs mb-1" style={{ color: '#F87171' }}>Pseudo déjà pris. Suggestions :</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.map(s => (
                  <button key={s} type="button" onClick={() => { setPseudo(s); setPseudoStatus('ok') }}
                    className="dls-badge dls-badge-blue cursor-pointer hover:opacity-80">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mot de passe */}
        <div>
          <label className="dls-label">Mot de passe *</label>
          <div className="relative">
            <input className="dls-input pr-10"
              type={showPwd ? 'text' : 'password'}
              placeholder="Min 6 chars, 1 maj, 1 chiffre, 1 spécial"
              value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPwd(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* Règles mot de passe */}
          {password && (
            <div className="mt-2 flex flex-col gap-1">
              {pwdRules.map(r => (
                <div key={r.label} className="flex items-center gap-1.5 text-xs">
                  {r.ok
                    ? <Check size={11} style={{ color: '#4ADE80', flexShrink: 0 }} />
                    : <X size={11} style={{ color: '#F87171', flexShrink: 0 }} />
                  }
                  <span style={{ color: r.ok ? '#4ADE80' : '#F87171' }}>{r.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit"
          disabled={loading || !pwdValid || pseudoStatus !== 'ok'}
          className="dls-btn dls-btn-primary dls-btn-full flex items-center justify-center gap-2 mt-2">
          {loading ? <span className="dls-spinner dls-spinner-sm" /> : <UserPlus size={16} />}
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>

      <p className="text-sm mt-4 text-center" style={{ color: '#64748B' }}>
        Déjà un compte ?{' '}
        <Link to="/login" style={{ color: '#4D8EFF' }}>Se connecter</Link>
      </p>
    </div>
  )
}
