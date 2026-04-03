import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Trophy, Users, ArrowLeft, CheckCircle, Settings } from 'lucide-react'
import api from '../lib/api'
import { tournamentStatusLabel, tournamentStatusClass, tournamentTypeLabel, isCreatorOf } from '../lib/utils'
import type { Tournament } from '../lib/api'

export default function JoinTournament() {
  const navigate = useNavigate()
  const { slug: paramSlug } = useParams<{ slug?: string }>()
  const [code, setCode] = useState(paramSlug?.toUpperCase() ?? '')
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (paramSlug) verify(paramSlug)
  }, [paramSlug])

  const verify = async (slug: string) => {
    if (slug.length < 4) return
    setChecking(true)
    setError('')
    setTournament(null)
    try {
      const t = await api.getTournament(slug.toLowerCase())
      if (t.status === 'finished') {
        navigate(`/tournament/${t.slug}/finished`)
        return
      }
      setTournament(t)
    } catch {
      setError('Tournoi introuvable — vérifie le code')
    } finally {
      setChecking(false)
    }
  }

  const handleInput = (v: string) => {
    const val = v.toUpperCase().slice(0, 8)
    setCode(val)
    setError('')
    if (val.length === 8) verify(val)
  }

  return (
    <div className="dls-page max-w-md mx-auto">
      <button onClick={() => navigate('/')}
        className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5 mb-6"
        style={{ color: '#94A3B8' }}>
        <ArrowLeft size={14} /> Retour
      </button>

      <h1 className="text-2xl font-bold text-white mb-6">Rejoindre un tournoi</h1>

      {/* Champ code */}
      <div className="dls-card p-5 mb-5">
        <label className="dls-label">Code d'invitation (8 caractères)</label>
        <div className="flex gap-2 mt-1">
          <input
            className={`dls-input flex-1 font-mono uppercase tracking-widest text-lg ${error ? 'dls-input-error' : ''}`}
            placeholder="K7F2XQ9A"
            maxLength={8}
            value={code}
            onChange={e => handleInput(e.target.value)}
          />
          <button onClick={() => verify(code)} disabled={checking || code.length < 4}
            className="dls-btn dls-btn-primary">
            {checking ? <span className="dls-spinner dls-spinner-sm" /> : <Search size={16} />}
          </button>
        </div>
        {error && <p className="text-xs mt-2" style={{ color: '#F87171' }}>{error}</p>}
        {tournament && !error && (
          <p className="text-xs mt-2 flex items-center gap-1" style={{ color: '#4ADE80' }}>
            <CheckCircle size={12} /> Tournoi trouvé ✓
          </p>
        )}
      </div>

      {/* Résultat */}
      {tournament && (
        <div className="dls-card p-5 mb-5">
          <div className="flex items-center gap-4 mb-4">
            {tournament.logo_url
              ? <img src={tournament.logo_url} alt={tournament.name} className="w-14 h-14 rounded-xl object-cover" />
              : <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(17,85,204,0.15)' }}>
                  <Trophy size={24} style={{ color: '#4D8EFF' }} />
                </div>
            }
            <div>
              <h2 className="font-bold text-white text-lg">{tournament.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {tournamentTypeLabel(tournament.tournament_type)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <Stat label="Équipes max" value={String(tournament.max_teams)} />
            <Stat label="Statut" value={
              <span className={tournamentStatusClass(tournament.status)}>
                {tournamentStatusLabel(tournament.status)}
              </span>
            } />
          </div>

          <button onClick={() => navigate(`/register/${tournament.slug}`)}
            className="dls-btn dls-btn-primary dls-btn-full flex items-center justify-center gap-2">
            <Users size={16} /> Rejoindre ce tournoi
          </button>
          {isCreatorOf(tournament.creator_session) && (
            <button onClick={() => navigate(`/dashboard/${tournament.slug}`)}
              className="dls-btn dls-btn-secondary dls-btn-full flex items-center justify-center gap-2 mt-2">
              <Settings size={16} /> Gérer ce tournoi (créateur)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(91,29,176,0.2)' }}>
      <p className="text-xs mb-1" style={{ color: '#64748B' }}>{label}</p>
      <div className="font-semibold text-white text-sm">{value}</div>
    </div>
  )
}
