import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useScorers, useMatches, useTournament } from '../hooks/useTournament'
import { useWebSocket } from '../hooks/useWebSocket'
import TournamentNav from '../components/layout/TournamentNav'
import { SkeletonTable } from '../components/ui/Skeleton'

type Tab = 'scorers' | 'assists' | 'clubs'

const MEDAL = ['#F5A623', '#94A3B8', '#CD7F32']

export default function StatisticsView() {
  const { slug } = useParams<{ slug: string }>()
  const { data: t } = useTournament(slug)
  const { data: scorers = [], isLoading } = useScorers(slug)
  const { data: matches = [] } = useMatches(slug)
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('scorers')

  const onWs = useCallback((msg: any) => {
    if (msg.event === 'match_validated') {
      qc.invalidateQueries({ queryKey: ['scorers', slug] })
      qc.invalidateQueries({ queryKey: ['matches', slug] })
    }
  }, [slug, qc])
  useWebSocket(t?.id, onWs)

  // MOTM
  const motmCount: Record<string, number> = {}
  matches.forEach(m => { if (m.motm) motmCount[m.motm] = (motmCount[m.motm] ?? 0) + 1 })
  const topMotm = Object.entries(motmCount).sort((a, b) => b[1] - a[1])[0]

  const topScorers = scorers.filter(s => s.goals > 0)
  const topAssists = scorers.filter(s => s.assists > 0).sort((a, b) => b.assists - a.assists)

  // Stats clubs (depuis les matchs)
  const clubStats: Record<string, { name: string; played: number; won: number; lost: number; draw: number; gf: number; ga: number; pts: number; form: string[] }> = {}
  matches.filter(m => m.status === 'validated' || m.status === 'manual').forEach(m => {
    const h = m.home_player?.pseudo ?? ''
    const a = m.away_player?.pseudo ?? ''
    const hs = m.home_score ?? 0
    const as_ = m.away_score ?? 0
    if (!h || !a) return
    if (!clubStats[h]) clubStats[h] = { name: h, played: 0, won: 0, lost: 0, draw: 0, gf: 0, ga: 0, pts: 0, form: [] }
    if (!clubStats[a]) clubStats[a] = { name: a, played: 0, won: 0, lost: 0, draw: 0, gf: 0, ga: 0, pts: 0, form: [] }
    clubStats[h].played++; clubStats[a].played++
    clubStats[h].gf += hs; clubStats[h].ga += as_
    clubStats[a].gf += as_; clubStats[a].ga += hs
    if (hs > as_) {
      clubStats[h].won++; clubStats[h].pts += 3; clubStats[a].lost++
      clubStats[h].form.push('W'); clubStats[a].form.push('L')
    } else if (hs < as_) {
      clubStats[a].won++; clubStats[a].pts += 3; clubStats[h].lost++
      clubStats[a].form.push('W'); clubStats[h].form.push('L')
    } else {
      clubStats[h].draw++; clubStats[h].pts++; clubStats[a].draw++; clubStats[a].pts++
      clubStats[h].form.push('D'); clubStats[a].form.push('D')
    }
  })
  const clubs = Object.values(clubStats).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga))

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'scorers', label: 'Buteurs', icon: '⚽' },
    { key: 'assists', label: 'Passeurs', icon: '👟' },
    { key: 'clubs', label: 'Classement', icon: '🏆' },
  ]

  return (
    <div className="dls-page max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-4">Statistiques</h1>
      <TournamentNav />

      {/* MOTM */}
      {topMotm && (
        <div className="rounded-xl p-4 mb-5 flex items-center gap-4"
          style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,166,35,0.15)' }}>
            <Star size={22} style={{ color: '#F5A623' }} />
          </div>
          <div>
            <p className="text-xs" style={{ color: '#F5A623' }}>Homme du Match</p>
            <p className="font-bold text-white">{topMotm[0]}</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>{topMotm[1]}× MOTM</p>
          </div>
        </div>
      )}

      {/* Onglets style icônes */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(91,29,176,0.2)' }}>
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === tb.key ? 'rgba(77,142,255,0.15)' : 'transparent',
              color: tab === tb.key ? '#fff' : '#64748B',
              border: tab === tb.key ? '1px solid rgba(77,142,255,0.4)' : '1px solid transparent',
            }}>
            <span>{tb.icon}</span>
            <span className="hidden sm:block">{tb.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu */}
      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : tab === 'scorers' ? (
        <ScorersTable data={topScorers} label="buts" color="#4D8EFF" />
      ) : tab === 'assists' ? (
        <ScorersTable data={topAssists.map(s => ({ ...s, goals: s.assists }))} label="PD" color="#A78BFA" />
      ) : (
        <ClubsTable clubs={clubs} />
      )}
    </div>
  )
}

// ── Tableau buteurs/passeurs ──────────────────────────────────────────────────

function ScorersTable({ data, label, color }: { data: any[]; label: string; color: string }) {
  if (data.length === 0) return (
    <div className="dls-card p-10 text-center">
      <p className="text-sm" style={{ color: '#64748B' }}>Aucune donnée disponible</p>
    </div>
  )

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(77,142,255,0.2)', background: 'rgba(13,15,30,0.8)' }}>
      {/* Header */}
      <div className="grid text-xs font-semibold px-4 py-3"
        style={{ gridTemplateColumns: '40px 1fr 60px 60px', color: '#64748B', borderBottom: '1px solid rgba(77,142,255,0.15)' }}>
        <span>Rang</span>
        <span>Joueur</span>
        <span className="text-center">Buts</span>
        <span className="text-center">PD</span>
      </div>

      {data.slice(0, 15).map((s, i) => (
        <div key={s.name}
          className="grid items-center px-4 py-3 transition-all hover:bg-white/5"
          style={{
            gridTemplateColumns: '40px 1fr 60px 60px',
            borderBottom: '1px solid rgba(77,142,255,0.06)',
            background: i === 0 ? 'rgba(245,166,35,0.05)' : 'transparent',
          }}>
          {/* Rang */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: 700,
            background: i < 3 ? MEDAL[i] : 'rgba(255,255,255,0.06)',
            color: i < 3 ? '#07080F' : '#64748B',
          }}>{i + 1}</span>

          {/* Joueur */}
          <div className="flex items-center gap-3 min-w-0">
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${color}33, rgba(255,255,255,0.05))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color,
            }}>
              {s.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-white truncate">{s.name}</span>
          </div>

          {/* Buts */}
          <div className="text-center">
            <span style={{
              fontSize: 16, fontWeight: 800, color,
              textShadow: i === 0 ? `0 0 10px ${color}` : 'none',
            }}>{s.goals}</span>
          </div>

          {/* PD */}
          <div className="text-center">
            <span style={{ fontSize: 13, color: '#A78BFA' }}>{s.assists ?? 0}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tableau classement clubs ──────────────────────────────────────────────────

function ClubsTable({ clubs }: { clubs: any[] }) {
  if (clubs.length === 0) return (
    <div className="dls-card p-10 text-center">
      <p className="text-sm" style={{ color: '#64748B' }}>Aucun match joué</p>
    </div>
  )

  const formColor = (r: string) => r === 'W' ? '#4ADE80' : r === 'L' ? '#F87171' : '#94A3B8'

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(77,142,255,0.2)', background: 'rgba(13,15,30,0.8)' }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '36px 1fr 32px 32px 32px 32px 40px 40px 40px 80px 80px',
        padding: '10px 12px', fontSize: 10, fontWeight: 600, color: '#64748B',
        borderBottom: '1px solid rgba(77,142,255,0.15)',
      }}>
        {['#', 'Équipe', 'J', 'V', 'N', 'D', 'BP', 'BC', 'DB', 'Pts', 'Forme'].map(h => (
          <span key={h} style={{ textAlign: h === 'Équipe' ? 'left' : 'center' }}>{h}</span>
        ))}
      </div>

      {clubs.map((c, i) => {
        const diff = c.gf - c.ga
        const last5 = c.form.slice(-5)
        return (
          <div key={c.name}
            style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr 32px 32px 32px 32px 40px 40px 40px 80px 80px',
              padding: '10px 12px', alignItems: 'center',
              borderBottom: '1px solid rgba(77,142,255,0.06)',
              background: i === 0 ? 'rgba(245,166,35,0.04)' : 'transparent',
            }}>
            {/* Rang */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
              background: i < 3 ? MEDAL[i] : 'rgba(255,255,255,0.06)',
              color: i < 3 ? '#07080F' : '#64748B',
            }}>{i + 1}</span>

            {/* Équipe */}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.name}
            </span>

            {/* Stats */}
            {[c.played, c.won, c.draw, c.lost, c.gf, c.ga].map((v: number, vi: number) => (
              <span key={vi} style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>{v}</span>
            ))}

            {/* Diff */}
            <span style={{ textAlign: 'center', fontSize: 12, color: diff > 0 ? '#4ADE80' : diff < 0 ? '#F87171' : '#94A3B8' }}>
              {diff > 0 ? `+${diff}` : diff}
            </span>

            {/* Points */}
            <span style={{
              textAlign: 'center', fontSize: 15, fontWeight: 800,
              color: i === 0 ? '#F5A623' : '#fff',
              textShadow: i === 0 ? '0 0 10px rgba(245,166,35,0.5)' : 'none',
            }}>{c.pts}</span>

            {/* Forme */}
            <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
              {last5.map((r: string, ri: number) => (
                <span key={ri} style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: formColor(r),
                  display: 'inline-block',
                  boxShadow: `0 0 4px ${formColor(r)}`,
                }} title={r} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
