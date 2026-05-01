import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Edit3, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useMatches, useTournament } from '../hooks/useTournament'
import { useWebSocket } from '../hooks/useWebSocket'
import { matchPhaseLabel, formatDateTime } from '../lib/utils'
import TournamentNav from '../components/layout/TournamentNav'
import type { Match } from '../lib/api'
import { SkeletonMatchList } from '../components/ui/Skeleton'

export default function MatchCalendar() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: t } = useTournament(slug)
  const { data: matches = [], isLoading } = useMatches(slug)
  const qc = useQueryClient()

  const onWs = useCallback((msg: any) => {
    if (msg.event === 'match_validated') {
      qc.invalidateQueries({ queryKey: ['matches', slug] })
      if (msg.home_score !== undefined) {
        toast.success(`${msg.home_score} – ${msg.away_score}${msg.is_manual ? ' (manuel)' : ''}`, {
          duration: 3000,
          style: { background: '#161830', color: '#fff', border: '1px solid rgba(22,163,74,0.4)' },
        })
      }
    }
  }, [slug, qc])
  useWebSocket(t?.id, onWs)

  // Grouper par phase
  const byPhase: Record<string, Match[]> = {}
  matches.forEach(m => {
    const k = matchPhaseLabel(m.phase)
    if (!byPhase[k]) byPhase[k] = []
    byPhase[k].push(m)
  })

  return (
    <div className="dls-page max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-4">Calendrier</h1>
      <TournamentNav />

      {/* Légende */}
      <div className="flex flex-wrap gap-3 mb-5 text-xs" style={{ color: '#64748B' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#16A34A' }} /> Live
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#1155CC' }} /> En attente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#A80B1C' }} /> Manuel
        </span>
      </div>

      {isLoading ? (
        <SkeletonMatchList count={5} />
      ) : matches.length === 0 ? (
        <div className="dls-card p-10 text-center">
          <p className="text-white font-medium">Aucun match programmé</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(byPhase).map(([phase, ms]) => (
            <div key={phase}>
              <p className="text-xs font-bold mb-3" style={{ color: '#A78BFA' }}>{phase}</p>
              <div className="flex flex-col gap-2">
                {ms.map(m => <MatchRow key={m.id} match={m}
                  onPlayerClick={(id) => navigate(`/tournament/${slug}/player/${id}`)} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchRow({ match: m, onPlayerClick }: { match: Match; onPlayerClick: (id: string) => void }) {
  const isLive = m.status === 'pending_validation'
  const isManual = m.is_manual
  const isDone = m.status === 'validated' || m.status === 'manual'
  const homeWins = isDone && (m.home_score ?? 0) > (m.away_score ?? 0)
  const awayWins = isDone && (m.away_score ?? 0) > (m.home_score ?? 0)

  return (
    <div className={`dls-match-card ${isManual ? 'dls-match-card-manual' : isLive ? 'dls-match-card-live' : ''} flex items-center gap-3`}>
      {/* Indicateur statut */}
      <div className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: isManual ? '#A80B1C' : isLive ? '#16A34A' : isDone ? '#334155' : '#1155CC' }} />

      {/* Joueur home */}
      <button onClick={() => m.home_player && onPlayerClick(m.home_player.id)}
        className="flex-1 text-right text-sm truncate hover:underline"
        style={{ color: homeWins ? '#fff' : '#94A3B8', fontWeight: homeWins ? 600 : 400 }}>
        {m.home_player?.pseudo ?? 'TBD'}
      </button>

      {/* Score */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isDone ? (
          <span className="font-bold text-sm px-2" style={{ color: isManual ? '#F87171' : '#fff' }}>
            {m.home_score} – {m.away_score}
            {isManual && <Edit3 size={10} className="inline ml-0.5" />}
          </span>
        ) : (
          <span className="text-xs px-2" style={{ color: '#64748B' }}>
            {isLive ? <span className="flex items-center gap-1"><Circle size={8} style={{ color: '#16A34A' }} className="animate-pulse" /> Live</span> : 'À jouer'}
          </span>
        )}
      </div>

      {/* Joueur away */}
      <button onClick={() => m.away_player && onPlayerClick(m.away_player.id)}
        className="flex-1 text-sm truncate hover:underline"
        style={{ color: awayWins ? '#fff' : '#94A3B8', fontWeight: awayWins ? 600 : 400 }}>
        {m.away_player?.pseudo ?? 'TBD'}
      </button>

      {/* Date */}
      {m.validated_at && (
        <span className="text-xs flex-shrink-0 hidden sm:block" style={{ color: '#64748B' }}>
          {formatDateTime(m.validated_at)}
        </span>
      )}
    </div>
  )
}
