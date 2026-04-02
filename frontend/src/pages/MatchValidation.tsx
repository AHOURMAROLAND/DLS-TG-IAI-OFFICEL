import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit3, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useMatches } from '../hooks/useTournament'
import { getCreatorSession, matchPhaseLabel, matchAllowsExtraTime } from '../lib/utils'
import api from '../lib/api'
import type { Match, TrackerSuggestion } from '../lib/api'

export default function MatchValidation() {
  const navigate = useNavigate()
  const { slug, matchId } = useParams<{ slug: string; matchId?: string }>()
  const qc = useQueryClient()
  const { data: matches = [] } = useMatches(slug)
  const session = getCreatorSession()

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [suggestions, setSuggestions] = useState<TrackerSuggestion[]>([])
  const [selected, setSelected] = useState<TrackerSuggestion | null>(null)
  const [manualHome, setManualHome] = useState('')
  const [manualAway, setManualAway] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)

  const pending = matches.filter(m => m.status === 'pending_validation' || m.status === 'scheduled')

  useEffect(() => {
    const m = matchId
      ? matches.find(m => m.id === matchId)
      : pending[0]
    if (m) {
      setSelectedMatch(m)
      loadSuggestions(m.id)
    }
  }, [matches, matchId])

  const loadSuggestions = async (mid: string) => {
    if (!session) return
    setLoading(true)
    try {
      const res = await api.getTrackerSuggestions(mid, session)
      setSuggestions(res.suggestions)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const validate = async () => {
    if (!selectedMatch || !session) return
    const isManual = !selected && (manualHome !== '' || manualAway !== '')
    if (!selected && !isManual) { toast.error('Sélectionnez un match ou entrez un score manuel'); return }

    const _allowsExtra = matchAllowsExtraTime(selectedMatch.phase, selectedMatch.round_number)
    void _allowsExtra // utilisé pour la logique de filtrage des suggestions

    setValidating(true)
    try {
      await api.validateMatch({
        match_id: selectedMatch.id,
        creator_session: session,
        home_score: selected ? selected.home_score : parseInt(manualHome),
        away_score: selected ? selected.away_score : parseInt(manualAway),
        home_scorers: selected?.home_scorers ?? [],
        away_scorers: selected?.away_scorers ?? [],
        motm: selected?.motm ?? '',
        is_manual: isManual,
        minutes_played: selected?.minutes ?? null,
        dll_match_timestamp: selected ? String(selected.timestamp) : null,
      })
      toast.success('Score validé !')
      qc.invalidateQueries({ queryKey: ['matches', slug] })
      navigate(`/dashboard/${slug}`)
    } catch {
      toast.error('Erreur lors de la validation')
    } finally {
      setValidating(false)
    }
  }

  if (!selectedMatch && pending.length === 0) {
    return (
      <div className="dls-page max-w-xl mx-auto text-center">
        <div className="dls-card p-10">
          <CheckCircle size={40} style={{ color: '#4ADE80', margin: '0 auto 12px' }} />
          <p className="font-bold text-white mb-1">Aucun match en attente</p>
          <button onClick={() => navigate(`/dashboard/${slug}`)}
            className="dls-btn dls-btn-secondary mt-4">Retour</button>
        </div>
      </div>
    )
  }

  const match = selectedMatch

  return (
    <div className="dls-page max-w-2xl mx-auto">
      <button onClick={() => navigate(`/dashboard/${slug}`)}
        className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5 mb-6"
        style={{ color: '#94A3B8' }}>
        <ArrowLeft size={14} /> Dashboard
      </button>

      <h1 className="text-xl font-bold text-white mb-5">Validation de match</h1>

      {/* Sélecteur de match si plusieurs en attente */}
      {pending.length > 1 && (
        <div className="mb-5">
          <p className="dls-label mb-2">Choisir le match à valider</p>
          <div className="flex flex-col gap-2">
            {pending.map(m => (
              <button key={m.id} onClick={() => { setSelectedMatch(m); loadSuggestions(m.id); setSelected(null) }}
                className="dls-card p-3 text-left flex items-center gap-3 transition-all"
                style={{ borderColor: selectedMatch?.id === m.id ? '#1155CC' : undefined }}>
                <span className="text-sm text-white">{m.home_player?.pseudo} vs {m.away_player?.pseudo}</span>
                <span className="text-xs ml-auto" style={{ color: '#64748B' }}>{matchPhaseLabel(m.phase)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {match && (
        <>
          {/* En-tête match */}
          <div className="dls-card p-5 mb-5">
            <p className="text-xs mb-3 text-center" style={{ color: '#64748B' }}>{matchPhaseLabel(match.phase)}</p>
            <div className="flex items-center justify-between gap-4">
              <PlayerSide player={match.home_player} side="Domicile" />
              <span className="text-lg font-bold" style={{ color: '#64748B' }}>VS</span>
              <PlayerSide player={match.away_player} side="Extérieur" right />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {/* Suggestions tracker */}
            <div className="dls-card p-4">
              <p className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Clock size={14} style={{ color: '#4D8EFF' }} /> 3 derniers matchs FTGames
              </p>
              {loading ? (
                <div className="flex justify-center py-6"><span className="dls-spinner dls-spinner-sm" /></div>
              ) : suggestions.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: '#64748B' }}>Aucun match trouvé</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {suggestions.map((s, i) => {
                    const filtered = !matchAllowsExtraTime(match.phase, match.round_number) && s.extra_time
                    return (
                      <button key={i} onClick={() => !filtered && setSelected(s)} disabled={filtered}
                        className="rounded-lg p-3 text-left transition-all"
                        style={{
                          background: selected === s ? 'rgba(17,85,204,0.15)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${selected === s ? '#1155CC' : 'rgba(91,29,176,0.2)'}`,
                          opacity: filtered ? 0.35 : 1,
                          cursor: filtered ? 'not-allowed' : 'pointer',
                        }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-base font-bold text-white">{s.home_score} – {s.away_score}</span>
                          <span className="text-xs" style={{ color: '#64748B' }}>{s.minutes}min</span>
                        </div>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{s.heure}</p>
                        {filtered && <p className="text-xs mt-1" style={{ color: '#F87171' }}>Prolongations — non valide pour ce format</p>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Score manuel */}
            <div className="dls-card p-4">
              <p className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
                <Edit3 size={14} style={{ color: '#F87171' }} /> Score manuel
              </p>
              <div className="rounded-lg p-2 mb-3 text-xs" style={{ background: 'rgba(168,11,28,0.1)', color: '#F87171' }}>
                ⚠️ Apparaîtra en rouge pour tous les participants
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs mb-1 truncate" style={{ color: '#64748B' }}>{match.home_player?.pseudo}</p>
                  <input type="number" min={0} value={manualHome}
                    onChange={e => { setManualHome(e.target.value); setSelected(null) }}
                    className="dls-input text-center text-xl font-bold"
                    style={{ borderColor: 'rgba(168,11,28,0.4)' }} placeholder="0" />
                </div>
                <div>
                  <p className="text-xs mb-1 truncate" style={{ color: '#64748B' }}>{match.away_player?.pseudo}</p>
                  <input type="number" min={0} value={manualAway}
                    onChange={e => { setManualAway(e.target.value); setSelected(null) }}
                    className="dls-input text-center text-xl font-bold"
                    style={{ borderColor: 'rgba(168,11,28,0.4)' }} placeholder="0" />
                </div>
              </div>
            </div>
          </div>

          <button onClick={validate} disabled={validating || (!selected && !manualHome && !manualAway)}
            className="dls-btn dls-btn-primary dls-btn-full dls-btn-lg flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
            {validating ? <span className="dls-spinner dls-spinner-sm" /> : <CheckCircle size={18} />}
            {validating ? 'Validation...' : 'Valider ce score'}
          </button>
        </>
      )}
    </div>
  )
}

function PlayerSide({ player, side, right }: { player: any; side: string; right?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 flex-1 ${right ? 'items-end' : 'items-start'}`}>
      {player?.team_logo_url
        ? <img src={player.team_logo_url} alt={player.pseudo} className="w-12 h-12 rounded-lg object-cover" />
        : <div className="w-12 h-12 rounded-lg" style={{ background: 'rgba(17,85,204,0.15)' }} />
      }
      <p className="font-semibold text-white text-sm">{player?.pseudo ?? 'TBD'}</p>
      <p className="text-xs" style={{ color: '#64748B' }}>{side}</p>
    </div>
  )
}
