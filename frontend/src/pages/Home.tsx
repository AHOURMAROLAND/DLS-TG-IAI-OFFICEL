import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Plus, LogIn, Zap, Users, Shield, Settings, UserCheck } from 'lucide-react'
import { useTournaments } from '../hooks/useTournament'
import { tournamentStatusLabel, tournamentStatusClass, tournamentTypeLabel, getCreatorSession, isCreatorOf } from '../lib/utils'
import type { Tournament } from '../lib/api'
import { SkeletonMatchList } from '../components/ui/Skeleton'

/** Récupère tous les slugs de tournois où l'utilisateur est inscrit comme joueur */
function getJoinedSlugs(): string[] {
  const slugs: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('player_session_')) {
      slugs.push(key.replace('player_session_', ''))
    }
  }
  return slugs
}

export default function Home() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const { data: tournaments = [], isLoading } = useTournaments()

  const creatorSession = getCreatorSession()
  const joinedSlugs = useMemo(() => getJoinedSlugs(), [])

  // Mes tournois créés
  const myTournaments = creatorSession
    ? tournaments.filter(t => t.creator_session === creatorSession)
    : []

  // Tournois où je suis inscrit (pas créateur)
  const joinedTournaments = tournaments.filter(t =>
    joinedSlugs.includes(t.slug) && t.creator_session !== creatorSession
  )

  // Tous les autres
  const otherTournaments = tournaments.filter(t =>
    t.creator_session !== creatorSession && !joinedSlugs.includes(t.slug)
  )

  const handleJoin = () => {
    const slug = code.trim()
    if (slug) navigate(`/join/${slug}`)
  }

  const handleTournamentClick = (t: Tournament) => {
    if (isCreatorOf(t.creator_session)) {
      navigate(`/dashboard/${t.slug}`)
    } else {
      // Joueur inscrit → aller directement aux vues du tournoi
      navigate(`/tournament/${t.slug}/bracket`)
    }
  }

  return (
    <div className="dls-page">
      {/* ── Hero ── */}
      <section className="dls-hero rounded-2xl mb-8 overflow-hidden">
        <div className="relative z-10 px-6 py-14 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 dls-badge dls-badge-blue mb-5">
            <Zap size={11} /> Tracker FTGames intégré
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
            Gérez vos tournois<br />
            <span style={{ color: '#F5A623' }}>comme un pro</span>
          </h1>
          <p className="text-base mb-7" style={{ color: '#94A3B8' }}>
            Créez, gérez et suivez vos tournois Dream League Soccer 26 avec validation automatique des scores.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/create')}
              className="dls-btn dls-btn-primary dls-btn-lg flex items-center gap-2">
              <Plus size={18} /> Créer un tournoi
            </button>
            <button onClick={() => navigate('/join')}
              className="dls-btn dls-btn-secondary dls-btn-lg flex items-center gap-2">
              <LogIn size={18} /> Rejoindre avec un lien
            </button>
          </div>
        </div>
      </section>

      {/* ── Rejoindre rapide ── */}
      <section className="dls-card p-5 mb-8 max-w-lg mx-auto">
        <p className="text-sm font-medium text-white mb-3">Entrer un code d'invitation</p>
        <div className="flex gap-2">
          <input
            className="dls-input flex-1 font-mono uppercase tracking-widest"
            placeholder="Ex: K7F2XQ9A"
            maxLength={8}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          <button onClick={handleJoin} disabled={code.length < 4}
            className="dls-btn dls-btn-primary">
            Rejoindre
          </button>
        </div>
      </section>

      {/* ── Mes tournois créés ── */}
      {myTournaments.length > 0 && (
        <section className="max-w-3xl mx-auto mb-8">
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <Settings size={16} style={{ color: '#F5A623' }} />
            Mes tournois
            <span className="dls-badge dls-badge-gold">{myTournaments.length}</span>
          </h2>
          <div className="flex flex-col gap-3">
            {myTournaments.map(t => (
              <TournamentRow key={t.id} tournament={t} role="owner" onClick={() => handleTournamentClick(t)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Tournois où je suis inscrit ── */}
      {joinedTournaments.length > 0 && (
        <section className="max-w-3xl mx-auto mb-8">
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <UserCheck size={16} style={{ color: '#4ADE80' }} />
            Mes inscriptions
            <span className="dls-badge dls-badge-green">{joinedTournaments.length}</span>
          </h2>
          <div className="flex flex-col gap-3">
            {joinedTournaments.map(t => (
              <TournamentRow key={t.id} tournament={t} role="player" onClick={() => handleTournamentClick(t)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Features ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto">
        {[
          { icon: <Trophy size={20} />, title: '3 formats', desc: 'Élimination, Poules, Championnat' },
          { icon: <Zap size={20} />, title: 'Tracker auto', desc: 'Scores validés via FTGames' },
          { icon: <Shield size={20} />, title: 'Live WebSocket', desc: 'Mises à jour en temps réel' },
        ].map(f => (
          <div key={f.title} className="dls-card p-5 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(17,85,204,0.15)', color: '#4D8EFF' }}>
              {f.icon}
            </div>
            <p className="font-semibold text-white text-sm mb-1">{f.title}</p>
            <p className="text-xs" style={{ color: '#64748B' }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* ── Tous les tournois ── */}
      <section className="max-w-3xl mx-auto">
        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Users size={16} style={{ color: '#4D8EFF' }} />
          Tournois récents
        </h2>

        {isLoading ? (
          <SkeletonMatchList count={3} />
        ) : otherTournaments.length === 0 && myTournaments.length === 0 && joinedTournaments.length === 0 ? (
          <div className="dls-card p-10 text-center">
            <Trophy size={40} style={{ color: '#334155', margin: '0 auto 12px' }} />
            <p className="text-white font-medium mb-1">Aucun tournoi pour l'instant</p>
            <p className="text-sm" style={{ color: '#64748B' }}>Soyez le premier à en créer un !</p>
          </div>
        ) : otherTournaments.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: '#64748B' }}>
            Aucun autre tournoi en cours
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {otherTournaments.map(t => (
              <TournamentRow key={t.id} tournament={t} role="visitor" onClick={() => handleTournamentClick(t)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TournamentRow({
  tournament: t,
  role,
  onClick,
}: {
  tournament: Tournament
  role: 'owner' | 'player' | 'visitor'
  onClick: () => void
}) {
  const borderColor = role === 'owner' ? 'rgba(245,166,35,0.3)'
    : role === 'player' ? 'rgba(22,163,74,0.3)'
    : undefined

  const iconBg = role === 'owner' ? 'rgba(245,166,35,0.12)'
    : role === 'player' ? 'rgba(22,163,74,0.12)'
    : 'rgba(17,85,204,0.15)'

  const iconColor = role === 'owner' ? '#F5A623'
    : role === 'player' ? '#4ADE80'
    : '#4D8EFF'

  return (
    <div onClick={onClick} className="dls-card p-4 flex items-center gap-4 cursor-pointer transition-all"
      style={{ borderColor }}>
      {t.logo_url
        ? <img src={t.logo_url} alt={t.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        : <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg }}>
            <Trophy size={20} style={{ color: iconColor }} />
          </div>
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white truncate">{t.name}</p>
          {role === 'owner' && <span className="dls-badge dls-badge-gold flex-shrink-0">Créateur</span>}
          {role === 'player' && <span className="dls-badge dls-badge-green flex-shrink-0">Inscrit</span>}
        </div>
        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
          {tournamentTypeLabel(t.tournament_type)} · {t.max_teams} équipes
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={tournamentStatusClass(t.status)}>
          {tournamentStatusLabel(t.status)}
        </span>
        {role === 'owner' && <Settings size={14} style={{ color: '#64748B' }} />}
      </div>
    </div>
  )
}
