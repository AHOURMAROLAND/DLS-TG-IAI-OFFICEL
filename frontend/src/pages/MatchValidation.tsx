import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit3, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useMatches } from '../hooks/useTournament'
import { matchPhaseLabel, matchAllowsExtraTime } from '../lib/utils'
import api from '../lib/api'
import type { Match, TrackerSuggestion, GoalEvent, CardEvent } from '../lib/api'
import LottiePlayer from '../components/ui/LottiePlayer'

export default function MatchValidation() {
  const navigate = useNavigate()
  const { slug, matchId } = useParams<{ slug: string; matchId?: string }>()
  const qc = useQueryClient()
  const { data: matches = [] } = useMatches(slug)

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [suggestions, setSuggestions] = useState<TrackerSuggestion[]>([])
  const [selected, setSelected] = useState<TrackerSuggestion | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [manualHome, setManualHome] = useState('')
  const [manualAway, setManualAway] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)

  const pending = matches.filter(m => m.status === 'pending_validation' || m.status === 'scheduled')

  useEffect(() => {
    const m = matchId ? matches.find(m => m.id === matchId) : pending[0]
    if (m) { setSelectedMatch(m); loadSuggestions(m.id) }
  }, [matches, matchId])

  const loadSuggestions = async (mid: string) => {
    setLoading(true)
    try {
      const res = await api.getTrackerSuggestions(mid)
      setSuggestions(res.suggestions)
    } catch { setSuggestions([]) }
    finally { setLoading(false) }
  }

  const validate = async () => {
    if (!selectedMatch) return
    const isManual = !selected && (manualHome !== '' || manualAway !== '')
    if (!selected && !isManual) { toast.error('Sélectionnez un match ou entrez un score manuel'); return }
    setValidating(true)
    try {
      await api.validateMatch({
        match_id: selectedMatch.id,
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
    } catch { toast.error('Erreur lors de la validation') }
    finally { setValidating(false) }
  }

  if (!selectedMatch && pending.length === 0) {
    return (
      <div className="dls-page max-w-xl mx-auto text-center">
        <div className="dls-card p-10 flex flex-col items-center gap-4">
          <LottiePlayer
            src="/lottie/checkmark-success.json"
            loop={false}
            style={{ width: 80, height: 80 }}
            fallback={<CheckCircle size={40} style={{ color: '#4ADE80' }} />}
          />
          <p className="font-bold text-white">Aucun match en attente</p>
          <button onClick={() => navigate(`/dashboard/${slug}`)} className="dls-btn dls-btn-secondary">Retour</button>
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

      {/* Sélecteur si plusieurs matchs en attente */}
      {pending.length > 1 && (
        <div className="mb-5">
          <p className="dls-label mb-2">Choisir le match à valider</p>
          <div className="flex flex-col gap-2">
            {pending.map(m => (
              <button key={m.id} onClick={() => { setSelectedMatch(m); loadSuggestions(m.id); setSelected(null); setExpanded(null) }}
                className="dls-card p-3 text-left flex items-center gap-3"
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

          {/* Suggestions tracker */}
          <div className="dls-card p-4 mb-4">
            <p className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <Clock size={14} style={{ color: '#4D8EFF' }} /> Matchs récents FTGames
            </p>

            {loading ? (
              <div className="flex justify-center py-6"><span className="dls-spinner dls-spinner-sm" /></div>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: '#64748B' }}>Aucun match trouvé entre ces deux joueurs</p>
            ) : (
              <div className="flex flex-col gap-2">
                {suggestions.map((s, i) => {
                  const filtered = !matchAllowsExtraTime(match.phase, match.round_number) && s.extra_time
                  const isExpanded = expanded === i
                  const isSelected = selected === s

                  return (
                    <div key={i} className="rounded-xl overflow-hidden transition-all"
                      style={{
                        border: `1px solid ${isSelected ? '#1155CC' : filtered ? 'rgba(168,11,28,0.2)' : 'rgba(91,29,176,0.2)'}`,
                        background: isSelected ? 'rgba(17,85,204,0.1)' : 'rgba(255,255,255,0.02)',
                        opacity: filtered ? 0.4 : 1,
                      }}>

                      {/* Ligne principale — clic pour sélectionner */}
                      <button
                        onClick={() => !filtered && setSelected(isSelected ? null : s)}
                        disabled={filtered}
                        className="w-full p-3 text-left"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-3">
                            {/* Score */}
                            <span className="text-lg font-extrabold text-white">
                              {s.home_score} – {s.away_score}
                            </span>
                            {/* Badges */}
                            {s.extra_time && <span className="dls-badge dls-badge-gold">AET</span>}
                            {s.penalties && <span className="dls-badge dls-badge-violet">PK</span>}
                            {filtered && <span className="dls-badge dls-badge-red">Non valide</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: '#64748B' }}>
                              {s.minutes > 90 ? `${s.minutes}'` : `${s.minutes}'`}
                            </span>
                            <span className="text-xs" style={{ color: '#64748B' }}>{s.heure}</span>
                          </div>
                        </div>

                        {/* Adversaire */}
                        <p className="text-xs" style={{ color: '#94A3B8' }}>
                          vs {s.opponent_team}
                        </p>

                        {/* Buteurs résumé */}
                        <div className="flex gap-4 mt-2">
                          <GoalsSummary goals={s.home_scorers} color="#4ADE80" />
                          <GoalsSummary goals={s.away_scorers} color="#F87171" />
                        </div>

                        {s.motm && (
                          <p className="text-xs mt-1.5" style={{ color: '#F5A623' }}>
                            ⭐ MOTM : {s.motm}
                          </p>
                        )}
                      </button>

                      {/* Bouton détails */}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : i)}
                        className="w-full px-3 py-2 flex items-center justify-center gap-1 text-xs transition-all"
                        style={{
                          borderTop: '1px solid rgba(91,29,176,0.15)',
                          color: '#64748B',
                          background: 'rgba(255,255,255,0.02)',
                        }}>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isExpanded ? 'Masquer les détails' : 'Voir les détails'}
                      </button>

                      {/* Détails complets */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2">
                          <MatchDetail suggestion={s}
                            homeTeam={match.home_player?.team_name ?? 'Domicile'}
                            awayTeam={match.away_player?.team_name ?? 'Extérieur'} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Score manuel */}
          <div className="dls-card p-4 mb-5">
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

// ── Sous-composants ────────────────────────────────────────────────────────────

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

function GoalsSummary({ goals, color }: { goals: GoalEvent[]; color: string }) {
  if (!goals?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {goals.map((g, i) => (
        <span key={i} className="text-xs" style={{ color }}>
          ⚽ {g.scorer} {g.minute}'
        </span>
      ))}
    </div>
  )
}

function MatchDetail({ suggestion: s, homeTeam, awayTeam }: {
  suggestion: TrackerSuggestion
  homeTeam: string
  awayTeam: string
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Score principal */}
      <div className="text-center py-2">
        <div className="flex items-center justify-center gap-4">
          <span className="text-sm font-medium text-white truncate max-w-[100px]">{homeTeam}</span>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-extrabold text-white">{s.home_score}</span>
            <span style={{ color: '#64748B' }}>–</span>
            <span className="text-3xl font-extrabold text-white">{s.away_score}</span>
          </div>
          <span className="text-sm font-medium text-white truncate max-w-[100px]">{awayTeam}</span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-xs" style={{ color: '#64748B' }}>
            {s.minutes > 90 ? 'AET' : 'FT'} {s.minutes}'
          </span>
          {s.penalties && <span className="dls-badge dls-badge-violet">PK {s.gcr}</span>}
        </div>
      </div>

      {/* Buteurs côte à côte */}
      <div className="grid grid-cols-2 gap-3">
        <GoalList goals={s.home_scorers} side="home" />
        <GoalList goals={s.away_scorers} side="away" />
      </div>

      {/* MOTM */}
      {s.motm && (
        <div className="rounded-lg p-3 text-center"
          style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)' }}>
          <p className="text-xs mb-0.5" style={{ color: '#F5A623' }}>⭐ Homme du Match</p>
          <p className="font-bold text-white">{s.motm}</p>
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold mb-1" style={{ color: '#64748B' }}>Statistiques</p>
        <StatBar label="Possession" home={s.user_possession} away={s.opp_possession} unit="%" isPercent />
        <StatBar label="Tirs" home={s.user_shots} away={s.opp_shots} />
        <StatBar label="Tirs cadrés" home={s.user_shots_on_target} away={s.opp_shots_on_target} />
        <StatBar label="Fautes" home={countFouls(s.user_cards)} away={countFouls(s.opp_cards)} />
        <StatBar label="Cartons jaunes" home={countYellow(s.user_cards)} away={countYellow(s.opp_cards)} color="#F5A623" />
        <StatBar label="Cartons rouges" home={countRed(s.user_cards)} away={countRed(s.opp_cards)} color="#F87171" />
      </div>

      {/* Cartons */}
      {(s.user_cards?.length > 0 || s.opp_cards?.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <CardList cards={s.user_cards} side="home" />
          <CardList cards={s.opp_cards} side="away" />
        </div>
      )}
    </div>
  )
}

function GoalList({ goals, side }: { goals: GoalEvent[]; side: 'home' | 'away' }) {
  if (!goals?.length) return <div />
  const color = side === 'home' ? '#4ADE80' : '#F87171'
  return (
    <div className={`flex flex-col gap-1 ${side === 'away' ? 'items-end text-right' : ''}`}>
      {goals.map((g, i) => (
        <div key={i}>
          <p className="text-xs font-medium" style={{ color }}>
            ⚽ {g.minute}' {g.scorer}
            {g.type !== 'Pied' && <span style={{ color: '#94A3B8' }}> ({g.type})</span>}
          </p>
          {g.assister && (
            <p className="text-xs" style={{ color: '#64748B' }}>
              🅰️ {g.assister}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function CardList({ cards, side }: { cards: CardEvent[]; side: 'home' | 'away' }) {
  if (!cards?.length) return null
  return (
    <div className={`flex flex-col gap-1 ${side === 'away' ? 'items-end text-right' : ''}`}>
      {cards.map((c, i) => (
        <p key={i} className="text-xs" style={{ color: c.Ye ? '#F5A623' : '#F87171' }}>
          {c.Ye ? '🟨' : '🟥'} {c.Ti}' {c.player}
        </p>
      ))}
    </div>
  )
}

function StatBar({ label, home, away, unit = '', color }: {
  label: string; home: number; away: number; unit?: string; isPercent?: boolean; color?: string
}) {
  const total = home + away || 1
  const homePct = Math.round((home / total) * 100)
  const awayPct = 100 - homePct
  const barColor = color ?? '#1155CC'

  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="font-medium text-white">{home}{unit}</span>
        <span style={{ color: '#64748B' }}>{label}</span>
        <span className="font-medium text-white">{away}{unit}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${homePct}%`, background: barColor, borderRadius: '9999px 0 0 9999px' }} />
        <div style={{ width: `${awayPct}%`, background: 'rgba(168,11,28,0.5)', borderRadius: '0 9999px 9999px 0' }} />
      </div>
    </div>
  )
}

// Helpers cartons
function countYellow(cards: CardEvent[]) { return (cards ?? []).filter(c => c.Ye).length }
function countRed(cards: CardEvent[]) { return (cards ?? []).filter(c => !c.Ye).length }
function countFouls(cards: CardEvent[]) { return (cards ?? []).length }
