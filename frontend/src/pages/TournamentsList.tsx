import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Settings, UserCheck, Plus, Search } from 'lucide-react'
import { useTournaments } from '../hooks/useTournament'
import { tournamentStatusLabel, tournamentStatusClass, tournamentTypeLabel, isCreatorOf } from '../lib/utils'
import type { Tournament } from '../lib/api'
import { SkeletonMatchList } from '../components/ui/Skeleton'

type Tab = 'all' | 'mine' | 'joined'

function getJoinedSlugs(): string[] {
  const slugs: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('player_session_')) slugs.push(key.replace('player_session_', ''))
  }
  return slugs
}

export default function TournamentsList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const { data: tournaments = [], isLoading } = useTournaments()
  const joinedSlugs = useMemo(() => getJoinedSlugs(), [])

  const myTournaments = tournaments.filter(t => isCreatorOf(t.creator_session))
  const joinedTournaments = tournaments.filter(t => joinedSlugs.includes(t.slug) && !isCreatorOf(t.creator_session))

  const filtered = (tab === 'mine' ? myTournaments : tab === 'joined' ? joinedTournaments : tournaments)
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))

  const handleClick = (t: Tournament) => {
    // Toujours passer par /join/:slug — TournamentDetail redirigera vers le bon endroit
    navigate(`/join/${t.slug}`)
  }

  const TABS: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'all',    label: 'Tous',           count: tournaments.length,      color: '#94A3B8' },
    { key: 'mine',   label: 'Mes tournois',   count: myTournaments.length,    color: '#F5A623' },
    { key: 'joined', label: 'Mes inscriptions', count: joinedTournaments.length, color: '#4ADE80' },
  ]

  return (
    <div className="dls-page max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy size={22} style={{ color: '#4D8EFF' }} /> Tournois
        </h1>
        <button onClick={() => navigate('/create')}
          className="dls-btn dls-btn-primary dls-btn-sm flex items-center gap-1.5">
          <Plus size={14} /> Créer
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="dls-btn dls-btn-sm flex items-center gap-1.5 whitespace-nowrap transition-all"
            style={{
              background: tab === t.key ? 'rgba(17,85,204,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === t.key ? '#1155CC' : 'rgba(91,29,176,0.25)'}`,
              color: tab === t.key ? '#fff' : t.color,
            }}>
            {t.label}
            <span className="dls-badge" style={{
              background: tab === t.key ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
              color: tab === t.key ? '#fff' : '#64748B',
              padding: '0 6px',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative mb-5">
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
        <input
          className="dls-input"
          style={{ paddingLeft: '2rem' }}
          placeholder="Rechercher un tournoi..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Liste */}
      {isLoading ? (
        <SkeletonMatchList count={4} />
      ) : filtered.length === 0 ? (
        <div className="dls-card p-10 text-center">
          <Trophy size={40} style={{ color: '#334155', margin: '0 auto 12px' }} />
          <p className="text-white font-medium mb-1">
            {tab === 'mine' ? 'Aucun tournoi créé' : tab === 'joined' ? 'Aucune inscription' : 'Aucun tournoi'}
          </p>
          {tab === 'mine' && (
            <button onClick={() => navigate('/create')} className="dls-btn dls-btn-primary dls-btn-sm mt-3">
              <Plus size={14} /> Créer mon premier tournoi
            </button>
          )}
          {tab === 'joined' && (
            <button onClick={() => navigate('/join')} className="dls-btn dls-btn-secondary dls-btn-sm mt-3">
              Rejoindre un tournoi
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(t => {
            const isOwner = isCreatorOf(t.creator_session)
            const isPlayer = joinedSlugs.includes(t.slug) && !isOwner
            return (
              <div key={t.id} onClick={() => handleClick(t)}
                className="dls-card p-4 flex items-center gap-4 cursor-pointer transition-all"
                style={{
                  borderColor: isOwner ? 'rgba(245,166,35,0.3)' : isPlayer ? 'rgba(22,163,74,0.3)' : undefined,
                }}>
                {t.logo_url
                  ? <img src={t.logo_url} alt={t.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  : <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: isOwner ? 'rgba(245,166,35,0.12)' : isPlayer ? 'rgba(22,163,74,0.12)' : 'rgba(17,85,204,0.15)' }}>
                      <Trophy size={20} style={{ color: isOwner ? '#F5A623' : isPlayer ? '#4ADE80' : '#4D8EFF' }} />
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-white truncate">{t.name}</p>
                    {isOwner && <span className="dls-badge dls-badge-gold flex-shrink-0 flex items-center gap-1"><Settings size={9} /> Créateur</span>}
                    {isPlayer && <span className="dls-badge dls-badge-green flex-shrink-0 flex items-center gap-1"><UserCheck size={9} /> Inscrit</span>}
                  </div>
                  <p className="text-xs" style={{ color: '#64748B' }}>
                    {tournamentTypeLabel(t.tournament_type)} · {t.max_teams} équipes
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={tournamentStatusClass(t.status)}>
                    {tournamentStatusLabel(t.status)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lien rejoindre */}
      <div className="mt-6 text-center">
        <p className="text-xs mb-2" style={{ color: '#64748B' }}>Vous avez un code d'invitation ?</p>
        <button onClick={() => navigate('/join')}
          className="dls-btn dls-btn-secondary dls-btn-sm">
          Rejoindre avec un code
        </button>
      </div>
    </div>
  )
}
