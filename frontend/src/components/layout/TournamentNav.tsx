import React from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Trophy, Users, BarChart2, Calendar, Grid } from 'lucide-react'

const TABS = [
  { label: 'Bracket',    icon: <Trophy size={14} />,    path: 'bracket' },
  { label: 'Poules',     icon: <Grid size={14} />,      path: 'groups' },
  { label: 'Classement', icon: <BarChart2 size={14} />, path: 'standings' },
  { label: 'Stats',      icon: <Users size={14} />,     path: 'stats' },
  { label: 'Calendrier', icon: <Calendar size={14} />,  path: 'calendar' },
]

export default function TournamentNav() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { pathname } = useLocation()

  return (
    <div className="dls-tabs mb-6 overflow-x-auto">
      {TABS.map(t => {
        const active = pathname.includes(`/${t.path}`)
        return (
          <button key={t.path} onClick={() => navigate(`/tournament/${slug}/${t.path}`)}
            className={`dls-tab flex items-center gap-1.5 whitespace-nowrap ${active ? 'dls-tab-active' : ''}`}>
            {t.icon} {t.label}
          </button>
        )
      })}
    </div>
  )
}
