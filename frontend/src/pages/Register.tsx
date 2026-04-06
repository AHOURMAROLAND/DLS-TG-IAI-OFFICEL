import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { UserPlus, Eye, EyeOff, Check, X, Search, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { debounce, divisionLabel, divisionClass } from '../lib/utils'
import type { PlayerInfo } from '../lib/api'

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
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const { register } = useAuth()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pseudoStatus, setPseudoStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle')
  const [suggestions, setSuggestions] = useState<string[]>([])

  // IDX DLS optionnel (v2)
  const [dllIdx, setDllIdx] = useState('')
  const [idxInfo, setIdxInfo] = useState<PlayerInfo | null>(null)
  const [idxStatus, setIdxStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')

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

  // Vérification idx DLS en temps réel (debounce 800ms)
  useEffect(() => {
    const normalized = dllIdx.trim().toLowerCase()
    if (normalized.length < 8) { setIdxInfo(null); setIdxStatus('idle'); return }
    setIdxStatus('checking')
    const check = debounce(async () => {
      try {
        const info = await api.verifyPlayer(normalized)
        setIdxInfo(info)
        setIdxStatus('ok')
      } catch {
        setIdxInfo(null)
        setIdxStatus('error')
      }
    }, 800)
    check()
  }, [dllIdx])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwdValid || pseudoStatus !== 'ok') return
    // Bloquer si idx saisi mais invalide
    if (dllIdx.trim() && idxStatus !== 'ok') {
      toast.error('Identifiant DLS invalide — corrige-le ou laisse-le vide')
      return
    }
    setLoading(true)
    try {
      await register(pseudo.trim(), password, dllIdx.trim() || undefined)
      toast.success(`Compte créé ! Bienvenue ${pseudo} 🎉`)
      navigate(redirect)
    } catch (e: any) {
      const detail = e?.response?.data
      if (detail?.suggestions) {
        setSuggestions(detail.suggestions)
        setPseudoStatus('taken')
        toast.error(detail.message || 'Pseudo déjà pris')
      } else {
        toast.error(detail?.detail || detail?.error?.message || 'Erreur lors de la création du compte')
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

        {/* IDX DLS optionnel (v2) */}
        <div>
          <label className="dls-label">
            Identifiant DLS (optionnel)
            <span className="ml-1 text-xs" style={{ color: '#64748B' }}>— pour rejoindre les tournois plus vite</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                className={`dls-input font-mono pr-8 ${idxStatus === 'error' ? 'dls-input-error' : ''}`}
                placeholder="Ex: abc123xy"
                value={dllIdx}
                onChange={e => { setDllIdx(e.target.value); setIdxInfo(null); setIdxStatus('idle') }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {idxStatus === 'checking' && <span className="dls-spinner dls-spinner-sm" />}
                {idxStatus === 'ok' && <Check size={14} style={{ color: '#4ADE80' }} />}
                {idxStatus === 'error' && <X size={14} style={{ color: '#F87171' }} />}
              </div>
            </div>
          </div>
          {dllIdx.length > 0 && dllIdx.length < 8 && (
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>L'idx doit contenir au moins 8 caractères</p>
          )}
          {idxStatus === 'error' && (
            <p className="text-xs mt-1" style={{ color: '#F87171' }}>Identifiant DLS introuvable sur le tracker</p>
          )}
          {/* Fiche joueur si idx valide */}
          {idxInfo && idxStatus === 'ok' && (
            <div className="mt-2 rounded-xl p-3" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)' }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={13} style={{ color: '#4ADE80' }} />
                <span className="text-xs font-semibold" style={{ color: '#4ADE80' }}>Joueur vérifié</span>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs" style={{ color: '#64748B' }}>Équipe</p>
                  <p className="text-sm font-semibold text-white">{idxInfo.team_name}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#64748B' }}>Division</p>
                  <span className={divisionClass(idxInfo.division)}>{divisionLabel(idxInfo.division)}</span>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs" style={{ color: '#64748B' }}>Win rate</p>
                  <p className="text-sm font-bold" style={{ color: '#F5A623' }}>{idxInfo.win_rate}%</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button type="submit"
          disabled={loading || !pwdValid || pseudoStatus !== 'ok' || (dllIdx.trim().length > 0 && idxStatus === 'checking')}
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
