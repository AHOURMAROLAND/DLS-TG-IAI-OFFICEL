import React, { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trophy, Edit3 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useGroups, useTournament } from '../hooks/useTournament'
import { useWebSocket } from '../hooks/useWebSocket'
import TournamentNav from '../components/layout/TournamentNav'

export default function GroupPhase() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: t } = useTournament(slug)
  const { data, isLoading } = useGroups(slug)
  const qc = useQueryClient()
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  const onWs = useCallback((msg: any) => {
    if (msg.event === 'match_validated') qc.invalidateQueries({ queryKey: ['groups', slug] })
  }, [slug, qc])
  useWebSocket(t?.id, onWs)

  const groups = data?.groups ?? []
  const current = groups.find(g => g.group_id === activeGroup) ?? groups[0]

  return (
    <div className="dls-page max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-4">Phase de poules</h1>
      <TournamentNav />

      {isLoading ? (
        <div className="flex justify-center py-16"><span className="dls-spinner dls-spinner-lg" /></div>
      ) : groups.length === 0 ? (
        <div className="dls-card p-10 text-center">
          <p className="text-white font-medium">Aucune poule disponible</p>
        </div>
      ) : (
        <>
          {/* Onglets groupes */}
          <div className="flex gap-2 mb-5 overflow-x-auto">
            {groups.map(g => (
              <button key={g.group_id}
                onClick={() => setActiveGroup(g.group_id)}
                className={`dls-btn dls-btn-sm whitespace-nowrap ${(activeGroup ?? groups[0]?.group_id) === g.group_id ? 'dls-btn-primary' : 'dls-btn-secondary'}`}>
                Groupe {g.group_id.replace('G', '')}
              </button>
            ))}
          </div>

          {current && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Tableau classement */}
              <div className="lg:col-span-2 dls-card overflow-hidden">
                <div className="p-4 border-b" style={{ borderColor: 'rgba(91,29,176,0.25)' }}>
                  <p className="font-semibold text-white">Groupe {current.group_id.replace('G', '')}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                    Les {data?.qualified_per_group ?? 2} premiers se qualifient
                  </p>
                </div>
                <table className="dls-table">
                  <thead>
                    <tr>
                      <th>Pos</th><th>Équipe</th><th>J</th><th>V</th><th>D</th><th>DB</th><th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.players.map((p: any, i: number) => (
                      <tr key={p.id} className={p.qualified ? 'dls-table-qualified' : ''}>
                        <td>
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              background: i === 0 ? '#F5A623' : i === 1 ? '#94A3B8' : 'rgba(255,255,255,0.08)',
                              color: i < 2 ? '#07080F' : '#94A3B8',
                              display: 'inline-flex',
                            }}>
                            {i + 1}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => navigate(`/tournament/${slug}/player/${p.id}`)}
                            className="font-medium text-white hover:underline text-sm">
                            {p.pseudo}
                          </button>
                        </td>
                        <td className="text-center">{p.played}</td>
                        <td className="text-center" style={{ color: '#4ADE80' }}>{p.won}</td>
                        <td className="text-center" style={{ color: '#F87171' }}>{p.lost}</td>
                        <td className="text-center" style={{ color: p.diff >= 0 ? '#4ADE80' : '#F87171' }}>
                          {p.diff > 0 ? `+${p.diff}` : p.diff}
                        </td>
                        <td className="text-center font-bold" style={{ color: p.qualified ? '#4ADE80' : '#fff' }}>
                          {p.pts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Derniers résultats */}
              <div className="dls-card p-4">
                <p className="text-sm font-semibold text-white mb-3">Résultats</p>
                {current.matches.filter((m: any) => m.status === 'validated' || m.status === 'manual').length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: '#64748B' }}>Aucun résultat</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {current.matches
                      .filter((m: any) => m.status === 'validated' || m.status === 'manual')
                      .map((m: any) => (
                        <div key={m.id} className={`dls-match-card ${m.is_manual ? 'dls-match-card-manual' : ''} p-3`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white truncate flex-1">{m.home_player?.pseudo}</span>
                            <span className="font-bold mx-2" style={{ color: m.is_manual ? '#F87171' : '#fff' }}>
                              {m.home_score} – {m.away_score}
                              {m.is_manual && <Edit3 size={10} className="inline ml-0.5" />}
                            </span>
                            <span className="text-white truncate flex-1 text-right">{m.away_player?.pseudo}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
