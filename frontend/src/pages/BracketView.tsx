import React, { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trophy, Edit3, Circle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBracket, useTournament } from '../hooks/useTournament'
import { useWebSocket } from '../hooks/useWebSocket'
import { matchPhaseLabel } from '../lib/utils'
import TournamentNav from '../components/layout/TournamentNav'
import type { Match } from '../lib/api'

export default function BracketView() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: t } = useTournament(slug)
  const { data: bracketData, isLoading } = useBracket(slug)
  const qc = useQueryClient()
  const [isLive, setIsLive] = useState(false)
  const [activeTab, setActiveTab] = useState<'winners' | 'losers'>('winners')

  const onWsMessage = useCallback((msg: any) => {
    if (msg.event === 'match_validated') {
      qc.invalidateQueries({ queryKey: ['bracket', slug] })
    }
  }, [slug, qc])

  useWebSocket(t?.id, onWsMessage)

  const PHASE_ORDER = ['r16', 'quarterfinal', 'semifinal', 'final', 'double_first', 'double_second']
  const bracket = bracketData?.bracket ?? {}

  const winnerPhases = PHASE_ORDER.filter(p => bracket[p]?.length)
  const loserPhases = ['double_first', 'double_second'].filter(p => bracket[p]?.length)

  const phases = activeTab === 'winners' ? winnerPhases : loserPhases

  return (
    <div className="dls-page max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Bracket</h1>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'dls-live-dot' : ''}`}
            style={{ background: isLive ? '#16A34A' : '#334155' }} />
          <span className="text-xs" style={{ color: '#64748B' }}>{isLive ? 'Live' : 'Hors ligne'}</span>
        </div>
      </div>

      <TournamentNav />

      {/* Onglets Winners/Losers */}
      {t?.elimination_type === 'double' && (
        <div className="flex gap-2 mb-5">
          {(['winners', 'losers'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`dls-btn dls-btn-sm capitalize ${activeTab === tab ? 'dls-btn-primary' : 'dls-btn-secondary'}`}>
              {tab === 'winners' ? 'Winners' : 'Losers'}
            </button>
          ))}
        </div>
      )}

      {/* Légende */}
      <div className="flex flex-wrap gap-4 mb-5 text-xs" style={{ color: '#64748B' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2" style={{ borderColor: '#16A34A' }} /> Vainqueur
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2" style={{ borderColor: '#A80B1C' }} /> Score manuel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="dls-live-dot w-2 h-2" /> Live
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><span className="dls-spinner dls-spinner-lg" /></div>
      ) : phases.length === 0 ? (
        <div className="dls-card p-10 text-center">
          <Trophy size={40} style={{ color: '#334155', margin: '0 auto 12px' }} />
          <p className="text-white font-medium">Bracket non disponible</p>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Le tirage n'a pas encore été effectué</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {phases.map(phase => (
            <div key={phase} className="flex-shrink-0 w-64">
              <p className="text-xs font-bold mb-3 text-center" style={{ color: '#A78BFA' }}>
                {matchPhaseLabel(phase as any)}
              </p>
              <div className="flex flex-col gap-3">
                {(bracket[phase] ?? []).map((m: Match) => (
                  <MatchCard key={m.id} match={m}
                    onPlayerClick={(pid) => navigate(`/tournament/${slug}/player/${pid}`)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, onPlayerClick }: { match: Match; onPlayerClick: (id: string) => void }) {
  const isLive = match.status === 'scheduled'
  const isManual = match.is_manual
  const homeWins = (match.home_score ?? 0) > (match.away_score ?? 0)
  const awayWins = (match.away_score ?? 0) > (match.home_score ?? 0)

  return (
    <div className={`dls-match-card ${isManual ? 'dls-match-card-manual' : ''}`}>
      {[
        { player: match.home_player, score: match.home_score, wins: homeWins },
        { player: match.away_player, score: match.away_score, wins: awayWins },
      ].map(({ player, score, wins }, i) => (
        <div key={i} className={`flex items-center gap-2 py-1.5 ${i === 0 ? 'border-b' : ''}`}
          style={{ borderColor: 'rgba(91,29,176,0.15)' }}>
          {player?.team_logo_url
            ? <img src={player.team_logo_url} alt={player.pseudo} className="w-7 h-7 rounded object-cover flex-shrink-0" />
            : <div className="w-7 h-7 rounded flex-shrink-0" style={{ background: 'rgba(17,85,204,0.15)' }} />
          }
          <button onClick={() => player && onPlayerClick(player.id)}
            className="flex-1 text-left text-sm truncate hover:underline"
            style={{ color: wins ? '#fff' : '#94A3B8', fontWeight: wins ? 600 : 400 }}>
            {player?.pseudo ?? 'TBD'}
          </button>
          <span className={`text-sm font-bold ${isManual ? 'dls-score-manual' : wins ? 'dls-score-winner' : 'dls-score-loser'}`}>
            {score ?? '–'}
            {isManual && <Edit3 size={10} className="inline ml-0.5" />}
          </span>
        </div>
      ))}
    </div>
  )
}
