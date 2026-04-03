import { useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Star, Target, Zap } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useScorers, useMatches, useTournament } from '../hooks/useTournament'
import { useWebSocket } from '../hooks/useWebSocket'
import TournamentNav from '../components/layout/TournamentNav'
import { SkeletonTable } from '../components/ui/Skeleton'

export default function StatisticsView() {
  const { slug } = useParams<{ slug: string }>()
  const { data: t } = useTournament(slug)
  const { data: scorers = [], isLoading } = useScorers(slug)
  const { data: matches = [] } = useMatches(slug)
  const qc = useQueryClient()

  const onWs = useCallback((msg: any) => {
    if (msg.event === 'match_validated') {
      qc.invalidateQueries({ queryKey: ['scorers', slug] })
      qc.invalidateQueries({ queryKey: ['matches', slug] })
    }
  }, [slug, qc])
  useWebSocket(t?.id, onWs)

  // MOTM le plus fréquent
  const motmCount: Record<string, number> = {}
  matches.forEach(m => { if (m.motm) motmCount[m.motm] = (motmCount[m.motm] ?? 0) + 1 })
  const topMotm = Object.entries(motmCount).sort((a, b) => b[1] - a[1])[0]

  const topScorers = scorers.filter(s => s.goals > 0)
  const topAssists = scorers.filter(s => s.assists > 0).sort((a, b) => b.assists - a.assists)

  const medalColor = (i: number) => i === 0 ? '#F5A623' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : '#334155'

  return (
    <div className="dls-page max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-4">Statistiques</h1>
      <TournamentNav />

      {/* MOTM */}
      {topMotm && (
        <div className="dls-card p-5 mb-5 flex items-center gap-4"
          style={{ background: 'rgba(245,166,35,0.08)', borderColor: 'rgba(245,166,35,0.3)' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,166,35,0.15)' }}>
            <Star size={24} style={{ color: '#F5A623' }} />
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#F5A623' }}>Homme du Match le plus récompensé</p>
            <p className="font-bold text-white text-lg">{topMotm[0]}</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>{topMotm[1]} fois MOTM</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Buteurs */}
        <div className="dls-card overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2"
            style={{ borderColor: 'rgba(91,29,176,0.25)' }}>
            <Target size={16} style={{ color: '#4D8EFF' }} />
            <p className="font-semibold text-white text-sm">Meilleurs buteurs</p>
          </div>
          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : topScorers.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: '#64748B' }}>Aucun but enregistré</p>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {topScorers.slice(0, 10).map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center" style={{ color: medalColor(i) }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-white truncate">{s.name}</span>
                  <span className="font-bold text-sm" style={{ color: '#4D8EFF' }}>{s.goals}</span>
                  <span className="text-xs" style={{ color: '#64748B' }}>buts</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Passeurs */}
        <div className="dls-card overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2"
            style={{ borderColor: 'rgba(91,29,176,0.25)' }}>
            <Zap size={16} style={{ color: '#A78BFA' }} />
            <p className="font-semibold text-white text-sm">Meilleurs passeurs</p>
          </div>
          {topAssists.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: '#64748B' }}>Aucune passe décisive</p>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {topAssists.slice(0, 10).map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center" style={{ color: medalColor(i) }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-white truncate">{s.name}</span>
                  <span className="font-bold text-sm" style={{ color: '#A78BFA' }}>{s.assists}</span>
                  <span className="text-xs" style={{ color: '#64748B' }}>PD</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
