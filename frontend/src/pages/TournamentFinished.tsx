import { useParams } from 'react-router-dom'
import { Trophy, Share2, Medal } from 'lucide-react'
import { useStandings, useScorers, useMatches } from '../hooks/useTournament'
import { copyToClipboard } from '../lib/utils'
import toast from 'react-hot-toast'
import LottiePlayer from '../components/ui/LottiePlayer'

export default function TournamentFinished() {
  const { slug } = useParams<{ slug: string }>()
  const { data: standings = [] } = useStandings(slug)
  const { data: scorers = [] } = useScorers(slug)
  const { data: matches = [] } = useMatches(slug)

  const champion = standings[0]
  const second = standings[1]
  const third = standings[2]
  const totalGoals = matches.reduce((acc, m) => acc + (m.home_score ?? 0) + (m.away_score ?? 0), 0)
  const topScorer = scorers[0]

  const share = () => {
    copyToClipboard(`${window.location.origin}/tournament/${slug}/finished`)
    toast.success('Lien copié !')
  }

  return (
    <div className="dls-page max-w-lg mx-auto text-center">
      {/* Champion */}
      <div className="dls-card dls-podium-1 p-8 mb-5">
        {/* Animation trophée Lottie */}
        <div className="flex justify-center mb-2">
          <LottiePlayer
            src="/lottie/trophy.json"
            loop={false}
            style={{ width: 100, height: 100 }}
            fallback={
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(245,166,35,0.2)' }}>
                <Trophy size={32} style={{ color: '#F5A623' }} />
              </div>
            }
          />
        </div>
        {/* Confettis */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <LottiePlayer
            src="/lottie/confetti.json"
            loop={false}
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          />
        </div>
        <p className="text-xs font-bold mb-2" style={{ color: '#F5A623' }}>CHAMPION</p>        {champion ? (
          <>
            {champion.team_logo_url && (
              <img src={champion.team_logo_url} alt={champion.pseudo}
                className="w-16 h-16 rounded-xl object-cover mx-auto mb-3" />
            )}
            <h1 className="text-2xl font-extrabold text-white mb-1">{champion.pseudo}</h1>
            <p className="text-sm" style={{ color: '#94A3B8' }}>{champion.team_name}</p>
          </>
        ) : (
          <p className="text-white font-bold">Tournoi terminé</p>
        )}
      </div>

      {/* Podium 2 & 3 */}
      {(second || third) && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[second, third].map((p, i) => p ? (
            <div key={p.player_id} className={`dls-card p-4 ${i === 0 ? 'dls-podium-2' : 'dls-podium-3'}`}>
              <Medal size={20} style={{ color: i === 0 ? '#94A3B8' : '#CD7F32', marginBottom: 8 }} />
              <p className="font-bold text-white text-sm">{p.pseudo}</p>
              <p className="text-xs" style={{ color: '#64748B' }}>{p.team_name}</p>
            </div>
          ) : <div key={i} />)}
        </div>
      )}

      {/* Stats globales */}
      <div className="dls-card p-5 mb-5">
        <p className="text-sm font-semibold text-white mb-4">Statistiques du tournoi</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Matchs joués', value: matches.filter(m => m.status === 'validated' || m.status === 'manual').length },
            { label: 'Buts marqués', value: totalGoals },
            { label: 'Top buteur', value: topScorer?.name ?? '—' },
            { label: 'Buts', value: topScorer?.goals ?? 0 },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(91,29,176,0.2)' }}>
              <p className="text-xs mb-1" style={{ color: '#64748B' }}>{s.label}</p>
              <p className="font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <button onClick={share} className="dls-btn dls-btn-secondary dls-btn-full flex items-center justify-center gap-2">
        <Share2 size={16} /> Partager le palmarès
      </button>
    </div>
  )
}
