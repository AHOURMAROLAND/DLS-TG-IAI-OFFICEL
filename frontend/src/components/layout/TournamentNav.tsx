import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Trophy, Users, BarChart2, Calendar, Grid } from 'lucide-react'
import { useTournament } from '../../hooks/useTournament'

export default function TournamentNav() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { pathname } = useLocation()
  const { data: t } = useTournament(slug)

  const type = t?.tournament_type

  // Onglets filtrés selon le type de tournoi
  const TABS = [
    // Bracket : élimination directe et poules (phase élim après poules)
    ...(type === 'elimination' || type === 'groups'
      ? [{ label: 'Bracket', icon: <Trophy size={14} />, path: 'bracket' }]
      : []),
    // Poules : uniquement pour les tournois de type "groups"
    ...(type === 'groups'
      ? [{ label: 'Poules', icon: <Grid size={14} />, path: 'groups' }]
      : []),
    // Classement : championnat et poules
    ...(type === 'championship' || type === 'groups'
      ? [{ label: 'Classement', icon: <BarChart2 size={14} />, path: 'standings' }]
      : []),
    // Stats et Calendrier : tous les types
    { label: 'Stats',      icon: <Users size={14} />,    path: 'stats' },
    { label: 'Calendrier', icon: <Calendar size={14} />, path: 'calendar' },
  ]

  return (
    <div className="dls-tabs mb-6 overflow-x-auto">
      {TABS.map(tab => {
        const active = pathname.includes(`/${tab.path}`)
        return (
          <button key={tab.path} onClick={() => navigate(`/tournament/${slug}/${tab.path}`)}
            className={`dls-tab flex items-center gap-1.5 whitespace-nowrap ${active ? 'dls-tab-active' : ''}`}>
            {tab.icon} {tab.label}
          </button>
        )
      })}
    </div>
  )
}
