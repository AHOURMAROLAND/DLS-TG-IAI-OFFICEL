import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Trophy, Users, ArrowLeft, CheckCircle, Settings, QrCode, Lock } from 'lucide-react'
import api from '../lib/api'
import { tournamentStatusLabel, tournamentStatusClass, tournamentTypeLabel } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import type { Tournament, Player } from '../lib/api'
import QRScanner from '../components/ui/QRScanner'

export default function JoinTournament() {
  const navigate = useNavigate()
  const { slug: paramSlug } = useParams<{ slug?: string }>()
  const { user } = useAuth()
  const [code, setCode] = useState(paramSlug?.toUpperCase() ?? '')
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [showScanner, setShowScanner] = useState(false)

  useEffect(() => {
    if (paramSlug) verify(paramSlug)
  }, [paramSlug])

  const verify = async (slug: string) => {
    if (slug.length < 4) return
    setChecking(true)
    setError('')
    setTournament(null)
    setPlayers([])
    try {
      const t = await api.getTournament(slug.toLowerCase())
      if (t.status === 'finished') {
        navigate(`/tournament/${t.slug}/finished`)
        return
      }
      setTournament(t)
      // Charger les joueurs pour afficher le remplissage
      try {
        const ps = await api.getTournamentPlayers(slug.toLowerCase())
        setPlayers(ps)
      } catch {
        // Non bloquant
      }
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
      {showScanner && (
        <QRScanner
          onScan={(slug) => {
            setShowScanner(false)
            setCode(slug.slice(0, 8))
            verify(slug)
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
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
          <button onClick={() => setShowScanner(true)}
            className="dls-btn dls-btn-secondary" title="Scanner un QR Code">
            <QrCode size={16} />
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

          {/* Remplissage du tournoi */}
          {(() => {
            const accepted = players.filter(p => p.status === 'accepted').length
            const isFull = accepted >= tournament.max_teams
            return (
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1" style={{ color: '#64748B' }}>
                  <span>{accepted} joueur{accepted > 1 ? 's' : ''} inscrit{accepted > 1 ? 's' : ''}</span>
                  <span className={isFull ? 'font-bold' : ''} style={{ color: isFull ? '#F87171' : '#64748B' }}>
                    {isFull ? '🔴 Complet' : `${tournament.max_teams} max`}
                  </span>
                </div>
                <div className="dls-progress-bar">
                  <div className="dls-progress-fill"
                    style={{
                      width: `${Math.min((accepted / tournament.max_teams) * 100, 100)}%`,
                      background: isFull ? '#F87171' : undefined,
                    }} />
                </div>
              </div>
            )
          })()}

          <div className="grid grid-cols-2 gap-3 mb-5">
            <Stat label="Équipes max" value={String(tournament.max_teams)} />
            <Stat label="Statut" value={
              <span className={tournamentStatusClass(tournament.status)}>
                {tournamentStatusLabel(tournament.status)}
              </span>
            } />
          </div>

          {tournament.status !== 'registration' ? (
            <div className="rounded-xl p-3 text-center text-sm mb-3"
              style={{ background: 'rgba(168,11,28,0.1)', color: '#F87171', border: '1px solid rgba(168,11,28,0.2)' }}>
              {tournament.status === 'finished' ? '🏆 Tournoi terminé' : '🔒 Inscriptions fermées'}
            </div>
          ) : players.filter(p => p.status === 'accepted').length >= tournament.max_teams ? (
            <div className="rounded-xl p-3 text-center text-sm mb-3 flex items-center justify-center gap-2"
              style={{ background: 'rgba(168,11,28,0.1)', color: '#F87171', border: '1px solid rgba(168,11,28,0.2)' }}>
              <Lock size={14} /> Tournoi complet — plus de place disponible
            </div>
          ) : (
            <button onClick={() => navigate(`/register/${tournament.slug}`)}
              className="dls-btn dls-btn-primary dls-btn-full flex items-center justify-center gap-2">
              <Users size={16} /> Rejoindre ce tournoi
            </button>
          )}
          {user && tournament.creator_id === user.id && (
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
