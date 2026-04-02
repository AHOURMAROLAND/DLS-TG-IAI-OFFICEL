import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trophy, Users, Calendar, Settings, Shuffle, CheckSquare, Copy, Check, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTournament, usePlayers, useMatches } from '../hooks/useTournament'
import { tournamentStatusLabel, tournamentStatusClass, tournamentTypeLabel, copyToClipboard, isCreatorOf, formatRelative } from '../lib/utils'

export default function CreatorDashboard() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: t, isLoading } = useTournament(slug)
  const { data: players = [] } = usePlayers(slug)
  const { data: matches = [] } = useMatches(slug)
  const [copied, setCopied] = useState(false)

  if (isLoading) return <Loader />
  if (!t) return null

  const isCreator = isCreatorOf(t.creator_session)
  const pending = players.filter(p => p.status === 'pending').length
  const accepted = players.filter(p => p.status === 'accepted').length
  const validated = matches.filter(m => m.status === 'validated' || m.status === 'manual').length
  const awaitingValidation = matches.filter(m => m.status === 'pending_validation').length
  const inviteUrl = `${window.location.origin}/join/${t.slug}`

  const copy = async () => {
    await copyToClipboard(inviteUrl)
    setCopied(true)
    toast.success('Lien copié !')
    setTimeout(() => setCopied(false), 2000)
  }

  const actions = [
    {
      icon: <Users size={20} />, label: 'Inscriptions', badge: pending || undefined,
      desc: `${accepted} acceptés · ${pending} en attente`,
      color: '#4D8EFF', bg: 'rgba(17,85,204,0.12)',
      onClick: () => navigate(`/dashboard/${slug}/registrations`),
      disabled: false,
    },
    {
      icon: <Shuffle size={20} />, label: 'Tirage au sort', badge: undefined,
      desc: t.status === 'registration' ? `${accepted}/${t.max_teams} joueurs` : 'Tirage effectué',
      color: '#A78BFA', bg: 'rgba(91,29,176,0.12)',
      onClick: () => navigate(`/dashboard/${slug}/draw`),
      disabled: accepted < 2,
    },
    {
      icon: <CheckSquare size={20} />, label: 'Valider match', badge: awaitingValidation || undefined,
      desc: awaitingValidation ? `${awaitingValidation} match(s) en attente` : 'Aucun match en attente',
      color: '#4ADE80', bg: 'rgba(22,163,74,0.12)',
      onClick: () => navigate(`/dashboard/${slug}/validate`),
      disabled: awaitingValidation === 0,
    },
    {
      icon: <Settings size={20} />, label: 'Paramètres', badge: undefined,
      desc: 'Modifier le tournoi',
      color: '#94A3B8', bg: 'rgba(148,163,184,0.08)',
      onClick: () => navigate(`/dashboard/${slug}/settings`),
      disabled: false,
    },
  ]

  return (
    <div className="dls-page max-w-2xl mx-auto">
      {/* Header tournoi */}
      <div className="flex items-center gap-4 mb-6">
        {t.logo_url
          ? <img src={t.logo_url} alt={t.name} className="w-14 h-14 rounded-xl object-cover" />
          : <div className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(17,85,204,0.15)' }}>
              <Trophy size={24} style={{ color: '#4D8EFF' }} />
            </div>
        }
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{t.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={tournamentStatusClass(t.status)}>{tournamentStatusLabel(t.status)}</span>
            <span className="text-xs" style={{ color: '#64748B' }}>{tournamentTypeLabel(t.tournament_type)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Joueurs', value: `${accepted}/${t.max_teams}`, sub: `${pending} en attente` },
          { label: 'Matchs joués', value: String(validated), sub: `${awaitingValidation} en attente` },
          { label: 'Format', value: t.elimination_type === 'double' ? 'Double élim.' : tournamentTypeLabel(t.tournament_type), sub: '' },
          { label: 'Statut', value: tournamentStatusLabel(t.status), sub: '' },
        ].map(s => (
          <div key={s.label} className="dls-card p-4">
            <p className="text-xs mb-1" style={{ color: '#64748B' }}>{s.label}</p>
            <p className="font-bold text-white text-sm">{s.value}</p>
            {s.sub && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Lien invitation */}
      <div className="dls-card p-4 mb-6">
        <p className="text-xs mb-2" style={{ color: '#64748B' }}>Lien d'invitation</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono rounded-lg px-3 py-2 truncate"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#4D8EFF', border: '1px solid rgba(17,85,204,0.2)' }}>
            {t.slug.toUpperCase()}
          </code>
          <button onClick={copy} className="dls-btn dls-btn-secondary dls-btn-sm flex items-center gap-1.5">
            {copied ? <Check size={14} style={{ color: '#4ADE80' }} /> : <Copy size={14} />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {actions.map(a => (
          <button key={a.label} onClick={a.onClick} disabled={a.disabled}
            className="dls-card p-4 text-left transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed relative">
            {a.badge ? (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: '#A80B1C', color: '#fff' }}>{a.badge}</span>
            ) : null}
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: a.bg, color: a.color }}>
              {a.icon}
            </div>
            <p className="font-semibold text-white text-sm">{a.label}</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{a.desc}</p>
          </button>
        ))}
      </div>

      {/* Voir les vues tournoi */}
      {t.status === 'in_progress' || t.status === 'finished' ? (
        <div className="dls-card p-4">
          <p className="text-xs mb-3" style={{ color: '#64748B' }}>Vues du tournoi</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Bracket', path: `/tournament/${slug}/bracket` },
              { label: 'Poules', path: `/tournament/${slug}/groups` },
              { label: 'Classement', path: `/tournament/${slug}/standings` },
              { label: 'Stats', path: `/tournament/${slug}/stats` },
              { label: 'Calendrier', path: `/tournament/${slug}/calendar` },
            ].map(v => (
              <button key={v.label} onClick={() => navigate(v.path)}
                className="dls-btn dls-btn-secondary dls-btn-sm flex items-center gap-1">
                {v.label} <ArrowRight size={12} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Loader() {
  return (
    <div className="dls-page flex items-center justify-center">
      <span className="dls-spinner dls-spinner-lg" />
    </div>
  )
}
