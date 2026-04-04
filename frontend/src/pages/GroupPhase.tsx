import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Edit3, ChevronRight } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useGroups, useTournament } from '../hooks/useTournament'
import { useWebSocket } from '../hooks/useWebSocket'
import TournamentNav from '../components/layout/TournamentNav'
import { SkeletonTable } from '../components/ui/Skeleton'

const NEON = '#4D8EFF'

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
  const qualifiedPer = data?.qualified_per_group ?? 2
  const current = groups.find(g => g.group_id === activeGroup) ?? groups[0]

  return (
    <div className="dls-page max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-4">Phase de poules</h1>
      <TournamentNav />

      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : groups.length === 0 ? (
        <div className="dls-card p-10 text-center">
          <p className="text-white font-medium">Aucune poule disponible</p>
        </div>
      ) : (
        <>
          {/* ── Vue d'ensemble toutes les poules ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {groups.map(g => {
              const isActive = (activeGroup ?? groups[0]?.group_id) === g.group_id
              const top = g.players.slice(0, qualifiedPer)
              return (
                <button key={g.group_id} onClick={() => setActiveGroup(g.group_id)}
                  className="text-left rounded-xl p-3 transition-all"
                  style={{
                    background: isActive ? 'rgba(77,142,255,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? 'rgba(77,142,255,0.5)' : 'rgba(91,29,176,0.2)'}`,
                    boxShadow: isActive ? '0 0 12px rgba(77,142,255,0.2)' : 'none',
                  }}>
                  {/* Header groupe */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold" style={{ color: NEON }}>
                      GROUPE {g.group_id.replace('G', '')}
                    </span>
                    <ChevronRight size={12} style={{ color: isActive ? NEON : '#64748B' }} />
                  </div>
                  {/* Top équipes */}
                  <div className="flex flex-col gap-1">
                    {g.players.slice(0, 4).map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center gap-1.5">
                        <span className="text-xs w-3" style={{
                          color: i < qualifiedPer ? '#4ADE80' : '#64748B',
                          fontWeight: i < qualifiedPer ? 700 : 400,
                        }}>{i + 1}</span>
                        <span className="text-xs flex-1 truncate" style={{
                          color: i < qualifiedPer ? '#fff' : '#64748B',
                        }}>{p.pseudo}</span>
                        <span className="text-xs font-bold" style={{ color: i < qualifiedPer ? '#4ADE80' : '#94A3B8' }}>
                          {p.pts}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Barre qualifiés */}
                  {g.players.length > qualifiedPer && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px dashed rgba(77,142,255,0.2)' }}>
                      <span className="text-xs" style={{ color: '#4ADE80' }}>
                        ↑ {qualifiedPer} qualifié{qualifiedPer > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Détail groupe sélectionné ── */}
          {current && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              {/* Tableau classement */}
              <div className="lg:col-span-3 rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(77,142,255,0.25)', background: 'rgba(13,15,30,0.8)' }}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ background: 'rgba(77,142,255,0.1)', borderBottom: '1px solid rgba(77,142,255,0.2)' }}>
                  <div>
                    <p className="font-bold text-white">Groupe {current.group_id.replace('G', '')}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                      {qualifiedPer} premier{qualifiedPer > 1 ? 's' : ''} qualifié{qualifiedPer > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#4ADE80' }} />
                    <span className="text-xs" style={{ color: '#4ADE80' }}>Qualifié</span>
                  </div>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(77,142,255,0.15)' }}>
                      {['#', 'Équipe', 'J', 'V', 'N', 'D', 'BP', 'BC', 'DB', 'Pts'].map(h => (
                        <th key={h} style={{
                          padding: '8px 6px', fontSize: 10, color: '#64748B',
                          textAlign: h === 'Équipe' ? 'left' : 'center', fontWeight: 600,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.players.map((p: any, i: number) => {
                      const qualified = i < qualifiedPer
                      const isFirst = i === 0
                      const isSecond = i === 1
                      return (
                        <tr key={p.id} style={{
                          borderBottom: i === qualifiedPer - 1
                            ? '2px dashed rgba(77,142,255,0.3)'
                            : '1px solid rgba(77,142,255,0.08)',
                          background: qualified ? 'rgba(74,222,128,0.04)' : 'transparent',
                          transition: 'background 0.2s',
                        }}>
                          <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                              background: isFirst ? '#F5A623' : isSecond ? '#94A3B8' : 'rgba(255,255,255,0.06)',
                              color: isFirst || isSecond ? '#07080F' : '#94A3B8',
                            }}>{i + 1}</span>
                          </td>
                          <td style={{ padding: '10px 6px' }}>
                            <button onClick={() => navigate(`/tournament/${slug}/player/${p.id}`)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                color: qualified ? '#fff' : '#94A3B8', fontWeight: qualified ? 600 : 400,
                                fontSize: 13, textAlign: 'left',
                              }}>
                              {p.pseudo}
                            </button>
                          </td>
                          {[p.played, p.won, p.draw, p.lost, p.gf, p.ga].map((v: number, vi: number) => (
                            <td key={vi} style={{ padding: '10px 4px', textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
                              {v ?? 0}
                            </td>
                          ))}
                          <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: 12 }}>
                            <span style={{ color: (p.diff ?? 0) > 0 ? '#4ADE80' : (p.diff ?? 0) < 0 ? '#F87171' : '#94A3B8' }}>
                              {(p.diff ?? 0) > 0 ? `+${p.diff}` : p.diff ?? 0}
                            </span>
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 14, fontWeight: 800,
                              color: qualified ? '#4ADE80' : '#fff',
                              textShadow: qualified ? '0 0 8px rgba(74,222,128,0.5)' : 'none',
                            }}>{p.pts}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Résultats + matchs à venir */}
              <div className="lg:col-span-2 flex flex-col gap-3">
                {/* Résultats */}
                <div className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid rgba(77,142,255,0.2)', background: 'rgba(13,15,30,0.8)' }}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(77,142,255,0.15)' }}>
                    <p className="text-sm font-semibold text-white">Résultats</p>
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    {current.matches.filter((m: any) => m.status === 'validated' || m.status === 'manual').length === 0 ? (
                      <p className="text-xs text-center py-3" style={{ color: '#64748B' }}>Aucun résultat</p>
                    ) : current.matches
                      .filter((m: any) => m.status === 'validated' || m.status === 'manual')
                      .map((m: any) => (
                        <MatchRow key={m.id} match={m} />
                      ))
                    }
                  </div>
                </div>

                {/* Matchs à jouer */}
                {current.matches.filter((m: any) => m.status === 'scheduled' || m.status === 'pending_validation').length > 0 && (
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(91,29,176,0.2)', background: 'rgba(13,15,30,0.8)' }}>
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(91,29,176,0.15)' }}>
                      <p className="text-sm font-semibold text-white">À jouer</p>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                      {current.matches
                        .filter((m: any) => m.status === 'scheduled' || m.status === 'pending_validation')
                        .map((m: any) => (
                          <MatchRow key={m.id} match={m} pending />
                        ))
                      }
                    </div>
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

function MatchRow({ match: m, pending }: { match: any; pending?: boolean }) {
  const homeWins = !pending && (m.home_score ?? 0) > (m.away_score ?? 0)
  const awayWins = !pending && (m.away_score ?? 0) > (m.home_score ?? 0)

  return (
    <div style={{
      borderRadius: 8, padding: '8px 10px',
      background: pending ? 'rgba(255,255,255,0.02)' : 'rgba(77,142,255,0.05)',
      border: `1px solid ${pending ? 'rgba(91,29,176,0.15)' : 'rgba(77,142,255,0.2)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          flex: 1, fontSize: 12, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: homeWins ? '#fff' : '#94A3B8', fontWeight: homeWins ? 700 : 400,
        }}>{m.home_player?.pseudo ?? 'TBD'}</span>

        <span style={{
          fontSize: 13, fontWeight: 800, minWidth: 48, textAlign: 'center',
          color: pending ? '#475569' : m.is_manual ? '#F87171' : '#fff',
          background: pending ? 'rgba(255,255,255,0.04)' : 'rgba(77,142,255,0.1)',
          borderRadius: 6, padding: '2px 8px',
        }}>
          {pending ? 'vs' : `${m.home_score} – ${m.away_score}`}
          {m.is_manual && <Edit3 size={9} style={{ display: 'inline', marginLeft: 2 }} />}
        </span>

        <span style={{
          flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: awayWins ? '#fff' : '#94A3B8', fontWeight: awayWins ? 700 : 400,
        }}>{m.away_player?.pseudo ?? 'TBD'}</span>
      </div>
    </div>
  )
}
