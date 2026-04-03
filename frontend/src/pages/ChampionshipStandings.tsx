import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Medal, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useStandings, useTournament } from '../hooks/useTournament'
import { useWebSocket } from '../hooks/useWebSocket'
import TournamentNav from '../components/layout/TournamentNav'
import { SkeletonTable } from '../components/ui/Skeleton'

export default function ChampionshipStandings() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: t } = useTournament(slug)
  const { data: standings = [], isLoading } = useStandings(slug)
  const qc = useQueryClient()

  const onWs = useCallback((msg: any) => {
    if (msg.event === 'match_validated') qc.invalidateQueries({ queryKey: ['standings', slug] })
  }, [slug, qc])
  useWebSocket(t?.id, onWs)

  const medalColor = (i: number) => i === 0 ? '#F5A623' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : '#334155'

  return (
    <div className="dls-page max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-4">Classement</h1>
      <TournamentNav />

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : standings.length === 0 ? (
        <div className="dls-card p-10 text-center">
          <p className="text-white font-medium">Aucune donnée de classement</p>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Les matchs doivent être validés</p>
        </div>
      ) : (
        <>
          <div className="dls-card overflow-hidden mb-5">
            <table className="dls-table">
              <thead>
                <tr>
                  <th>Pos</th><th>Équipe</th><th>J</th><th>V</th><th>N</th><th>D</th><th>DB</th><th>Pts</th><th>Forme</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.player_id}>
                    <td>
                      <Medal size={16} style={{ color: medalColor(i) }} />
                    </td>
                    <td>
                      <button onClick={() => navigate(`/tournament/${slug}/player/${s.player_id}`)}
                        className="flex items-center gap-2 hover:underline">
                        {s.team_logo_url && (
                          <img src={s.team_logo_url} alt={s.pseudo} className="w-6 h-6 rounded object-cover" />
                        )}
                        <span className="font-medium text-white text-sm">{s.pseudo}</span>
                      </button>
                    </td>
                    <td className="text-center">{s.played}</td>
                    <td className="text-center" style={{ color: '#4ADE80' }}>{s.won}</td>
                    <td className="text-center" style={{ color: '#94A3B8' }}>{s.draw}</td>
                    <td className="text-center" style={{ color: '#F87171' }}>{s.lost}</td>
                    <td className="text-center" style={{ color: s.diff >= 0 ? '#4ADE80' : '#F87171' }}>
                      {s.diff > 0 ? `+${s.diff}` : s.diff}
                    </td>
                    <td className="text-center">
                      <span className="text-base font-bold" style={{ color: i === 0 ? '#F5A623' : '#fff' }}>
                        {s.pts}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-0.5">
                        {s.form.slice(-5).map((f, fi) => (
                          <span key={fi} className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{
                              background: f === 'W' ? 'rgba(22,163,74,0.2)' : f === 'D' ? 'rgba(148,163,184,0.15)' : 'rgba(168,11,28,0.15)',
                            }}>
                            {f === 'W' ? <TrendingUp size={10} style={{ color: '#4ADE80' }} />
                              : f === 'D' ? <Minus size={10} style={{ color: '#94A3B8' }} />
                              : <TrendingDown size={10} style={{ color: '#F87171' }} />}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div className="dls-card p-4 text-xs" style={{ color: '#64748B' }}>
            <p className="font-semibold text-white mb-2">Critères de départage</p>
            <p>1. Points (V=3, N=1, D=0) · 2. Différence de buts · 3. Buts marqués</p>
          </div>
        </>
      )}
    </div>
  )
}
