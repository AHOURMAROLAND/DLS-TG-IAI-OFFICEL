import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Star, Target, Zap, Trophy, Edit3 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMatches } from '../hooks/useTournament'
import { divisionLabel, divisionClass, matchPhaseLabel } from '../lib/utils'
import api from '../lib/api'

export default function PlayerProfile() {
  const navigate = useNavigate()
  const { slug, playerId } = useParams<{ slug: string; playerId: string }>()

  const { data: player, isLoading } = useQuery({
    queryKey: ['player', playerId],
    queryFn: () => api.getPlayer(playerId!),
    enabled: !!playerId,
  })

  const { data: matches = [] } = useMatches(slug)

  if (isLoading) return (
    <div className="dls-page flex justify-center"><span className="dls-spinner dls-spinner-lg" /></div>
  )
  if (!player) return null

  const playerMatches = matches.filter(
    m => m.home_player?.id === playerId || m.away_player?.id === playerId
  ).filter(m => m.status === 'validated' || m.status === 'manual')

  // Stats tournoi
  let goals = 0, assists = 0, motmCount = 0, wins = 0, draws = 0, losses = 0
  playerMatches.forEach(m => {
    const isHome = m.home_player?.id === playerId
    const myScore = isHome ? (m.home_score ?? 0) : (m.away_score ?? 0)
    const oppScore = isHome ? (m.away_score ?? 0) : (m.home_score ?? 0)
    if (myScore > oppScore) wins++
    else if (myScore === oppScore) draws++
    else losses++
    const scorers = isHome ? m.home_scorers : m.away_scorers
    scorers?.forEach((g: any) => {
      if (typeof g === 'object') {
        goals++
        if (g.assist) assists++
      }
    })
    if (m.motm === player.pseudo) motmCount++
  })

  return (
    <div className="dls-page max-w-lg mx-auto">
      <button onClick={() => navigate(-1)}
        className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5 mb-6"
        style={{ color: '#94A3B8' }}>
        <ArrowLeft size={14} /> Retour
      </button>

      {/* Hero joueur */}
      <div className="dls-card p-6 text-center mb-5">
        {player.team_logo_url
          ? <img src={player.team_logo_url} alt={player.team_name}
              className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3" />
          : <div className="w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'rgba(17,85,204,0.15)' }}>
              <Trophy size={32} style={{ color: '#4D8EFF' }} />
            </div>
        }
        <h1 className="text-xl font-bold text-white mb-1">{player.pseudo}</h1>
        <p className="text-sm mb-2" style={{ color: '#94A3B8' }}>{player.team_name}</p>
        <span className={divisionClass(player.dll_division)}>{divisionLabel(player.dll_division)}</span>
      </div>

      {/* Stats tournoi */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Joués', value: playerMatches.length, color: '#fff' },
          { label: 'Victoires', value: wins, color: '#4ADE80' },
          { label: 'Défaites', value: losses, color: '#F87171' },
          { label: 'Buts', value: goals, color: '#F5A623', icon: <Target size={12} /> },
          { label: 'Passes D.', value: assists, color: '#A78BFA', icon: <Zap size={12} /> },
          { label: 'MOTM', value: motmCount, color: '#F5A623', icon: <Star size={12} /> },
        ].map(s => (
          <div key={s.label} className="dls-card p-3 text-center">
            <p className="text-xs mb-1 flex items-center justify-center gap-1" style={{ color: '#64748B' }}>
              {s.icon}{s.label}
            </p>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Historique matchs */}
      <div className="dls-card overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: 'rgba(91,29,176,0.25)' }}>
          <p className="font-semibold text-white text-sm">Historique dans le tournoi</p>
        </div>
        {playerMatches.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: '#64748B' }}>Aucun match joué</p>
        ) : (
          <div className="flex flex-col">
            {playerMatches.map(m => {
              const isHome = m.home_player?.id === playerId
              const myScore = isHome ? m.home_score : m.away_score
              const oppScore = isHome ? m.away_score : m.home_score
              const opp = isHome ? m.away_player : m.home_player
              const result = (myScore ?? 0) > (oppScore ?? 0) ? 'W' : (myScore ?? 0) === (oppScore ?? 0) ? 'D' : 'L'
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(91,29,176,0.1)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: result === 'W' ? 'rgba(22,163,74,0.2)' : result === 'D' ? 'rgba(148,163,184,0.1)' : 'rgba(168,11,28,0.15)',
                      color: result === 'W' ? '#4ADE80' : result === 'D' ? '#94A3B8' : '#F87171',
                    }}>
                    {result}
                  </span>
                  <span className="flex-1 text-sm text-white truncate">vs {opp?.pseudo ?? 'TBD'}</span>
                  <span className="font-bold text-sm" style={{ color: m.is_manual ? '#F87171' : '#fff' }}>
                    {myScore} – {oppScore}
                    {m.is_manual && <Edit3 size={10} className="inline ml-0.5" />}
                  </span>
                  <span className="text-xs hidden sm:block" style={{ color: '#64748B' }}>
                    {matchPhaseLabel(m.phase)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
