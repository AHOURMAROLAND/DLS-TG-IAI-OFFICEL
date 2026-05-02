/**
 * TournamentPublic — Page de détail d'un tournoi public
 *
 * Affichée quand un visiteur clique sur un tournoi depuis la Home.
 * Gère tous les cas selon le statut de l'utilisateur :
 *
 *  - Non connecté            → bouton "Se connecter pour s'inscrire"
 *  - Connecté, pas inscrit   → bouton "S'inscrire" (si inscriptions ouvertes)
 *  - Connecté, en attente    → message "Demande en attente"
 *  - Connecté, accepté       → bouton "Voir le tournoi"
 *  - Connecté, refusé        → message "Demande refusée" + possibilité de re-tenter
 *  - Créateur                → bouton "Gérer le tournoi"
 *  - Tournoi en cours/fini   → vue bracket/résultats directement
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Trophy, Users, Clock, User, ArrowLeft,
  CheckCircle, XCircle, Timer, Settings, LogIn, ArrowRight
} from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import {
  tournamentStatusLabel, tournamentStatusClass,
  tournamentTypeLabel, formatTournamentDate
} from '../lib/utils'
import type { Tournament, Player } from '../lib/api'
import { SkeletonMatchList } from '../components/ui/Skeleton'

export default function TournamentPublic() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { user, isAuthenticated } = useAuth()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    load()
  }, [slug])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [t, ps] = await Promise.all([
        api.getTournament(slug!.toLowerCase()),
        api.getTournamentPlayers(slug!.toLowerCase()).catch(() => []),
      ])
      setTournament(t)
      setPlayers(ps)
    } catch {
      setError('Tournoi introuvable')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="dls-page max-w-lg mx-auto">
      <SkeletonMatchList count={3} />
    </div>
  )

  if (error || !tournament) return (
    <div className="dls-page max-w-lg mx-auto text-center">
      <div className="dls-card p-10">
        <Trophy size={40} style={{ color: '#334155', margin: '0 auto 12px' }} />
        <p className="text-white font-medium mb-1">Tournoi introuvable</p>
        <button onClick={() => navigate('/')} className="dls-btn dls-btn-secondary mt-4">
          Retour à l'accueil
        </button>
      </div>
    </div>
  )

  const accepted = players.filter(p => p.status === 'accepted').length
  const isFull = accepted >= tournament.max_teams
  const isCreator = user && tournament.creator_id === user.id

  // Statut de l'utilisateur dans ce tournoi
  const myPlayer = user ? players.find(p => p.user_id === user.id) : null
  const myStatus = myPlayer?.status ?? null

  const dateStr = formatTournamentDate(tournament.created_at)

  // ── Rendu du CTA selon le contexte ──────────────────────────────────────

  const renderCTA = () => {
    // Créateur → dashboard
    if (isCreator) {
      return (
        <button onClick={() => navigate(`/dashboard/${tournament.slug}`)}
          className="dls-btn dls-btn-primary dls-btn-full flex items-center justify-center gap-2">
          <Settings size={16} /> Gérer ce tournoi
        </button>
      )
    }

    // Tournoi terminé
    if (tournament.status === 'finished') {
      return (
        <button onClick={() => navigate(`/tournament/${tournament.slug}/finished`)}
          className="dls-btn dls-btn-secondary dls-btn-full flex items-center justify-center gap-2">
          <Trophy size={16} /> Voir les résultats
        </button>
      )
    }

    // Tournoi en cours → voir le bracket
    if (tournament.status === 'in_progress' || tournament.status === 'draw') {
      return (
        <button onClick={() => navigate(`/tournament/${tournament.slug}/bracket`)}
          className="dls-btn dls-btn-secondary dls-btn-full flex items-center justify-center gap-2">
          <ArrowRight size={16} /> Voir le bracket
        </button>
      )
    }

    // Inscriptions ouvertes
    if (tournament.status === 'registration') {
      // Déjà accepté
      if (myStatus === 'accepted') {
        return (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)' }}>
              <CheckCircle size={20} style={{ color: '#4ADE80', flexShrink: 0 }} />
              <div>
                <p className="font-semibold text-white text-sm">Tu es inscrit !</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                  Ta demande a été acceptée par le créateur.
                </p>
              </div>
            </div>
            <button onClick={() => navigate(`/tournament/${tournament.slug}/bracket`)}
              className="dls-btn dls-btn-secondary dls-btn-full flex items-center justify-center gap-2">
              <ArrowRight size={16} /> Voir le bracket
            </button>
          </div>
        )
      }

      // En attente de validation
      if (myStatus === 'pending') {
        return (
          <div className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: 'rgba(77,142,255,0.08)', border: '1px solid rgba(77,142,255,0.3)' }}>
            <Timer size={20} style={{ color: '#4D8EFF', flexShrink: 0 }} />
            <div>
              <p className="font-semibold text-white text-sm">Demande en attente</p>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                Le créateur doit valider ta demande d'inscription.
              </p>
            </div>
          </div>
        )
      }

      // Refusé → peut re-tenter
      if (myStatus === 'rejected') {
        return (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(168,11,28,0.1)', border: '1px solid rgba(168,11,28,0.3)' }}>
              <XCircle size={20} style={{ color: '#F87171', flexShrink: 0 }} />
              <div>
                <p className="font-semibold" style={{ color: '#F87171' }}>Demande refusée</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                  Le créateur a refusé ta demande.
                </p>
              </div>
            </div>
          </div>
        )
      }

      // Tournoi complet
      if (isFull) {
        return (
          <div className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(168,11,28,0.08)', border: '1px solid rgba(168,11,28,0.25)' }}>
            <p className="font-semibold" style={{ color: '#F87171' }}>Tournoi complet</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              Plus de place disponible ({tournament.max_teams}/{tournament.max_teams})
            </p>
          </div>
        )
      }

      // Non connecté
      if (!isAuthenticated) {
        return (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-center" style={{ color: '#94A3B8' }}>
              Connecte-toi pour t'inscrire à ce tournoi
            </p>
            <button
              onClick={() => navigate(`/login?redirect=/tournament-public/${tournament.slug}`)}
              className="dls-btn dls-btn-primary dls-btn-full flex items-center justify-center gap-2">
              <LogIn size={16} /> Se connecter
            </button>
            <button
              onClick={() => navigate(`/register?redirect=/tournament-public/${tournament.slug}`)}
              className="dls-btn dls-btn-secondary dls-btn-full">
              Créer un compte
            </button>
          </div>
        )
      }

      // Connecté, pas encore inscrit → S'inscrire
      return (
        <button
          onClick={() => navigate(`/register/${tournament.slug}`)}
          className="dls-btn dls-btn-primary dls-btn-full flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#1155CC,#1460E8)' }}>
          <Users size={16} /> S'inscrire à ce tournoi
        </button>
      )
    }

    return null
  }

  return (
    <div className="dls-page max-w-lg mx-auto">
      <button onClick={() => navigate(-1)}
        className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5 mb-6"
        style={{ color: '#94A3B8' }}>
        <ArrowLeft size={14} /> Retour
      </button>

      {/* ── Header tournoi ── */}
      <div className="dls-card p-6 mb-4">
        <div className="flex items-center gap-4 mb-5">
          {tournament.logo_url
            ? <img src={tournament.logo_url} alt={tournament.name}
                className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
            : <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(17,85,204,0.15)' }}>
                <Trophy size={28} style={{ color: '#4D8EFF' }} />
              </div>
          }
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{tournament.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
              {tournamentTypeLabel(tournament.tournament_type)}
            </p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {tournament.creator_pseudo && (
                <span className="flex items-center gap-1 text-xs" style={{ color: '#94A3B8' }}>
                  <User size={10} /> {tournament.creator_pseudo}
                </span>
              )}
              {dateStr && (
                <span className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                  <Clock size={10} /> {dateStr}
                </span>
              )}
            </div>
          </div>
          <span className={tournamentStatusClass(tournament.status)}>
            {tournamentStatusLabel(tournament.status)}
          </span>
        </div>

        {/* Barre de remplissage */}
        <div className="mb-5">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: '#64748B' }}>
            <span className="flex items-center gap-1">
              <Users size={11} /> {accepted} joueur{accepted > 1 ? 's' : ''} inscrit{accepted > 1 ? 's' : ''}
            </span>
            <span style={{ color: isFull ? '#F87171' : '#64748B', fontWeight: isFull ? 700 : 400 }}>
              {isFull ? 'Complet' : `${tournament.max_teams} max`}
            </span>
          </div>
          <div className="dls-progress-bar">
            <div className="dls-progress-fill"
              style={{
                width: `${Math.min((accepted / tournament.max_teams) * 100, 100)}%`,
                background: isFull ? '#F87171' : undefined,
              }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Format', value: tournamentTypeLabel(tournament.tournament_type) },
            { label: 'Équipes', value: `${accepted} / ${tournament.max_teams}` },
            ...(tournament.tournament_type === 'elimination'
              ? [{ label: 'Élimination', value: tournament.elimination_type === 'double' ? 'Double' : 'Simple' }]
              : []),
            ...(tournament.tournament_type === 'championship'
              ? [{ label: 'Format', value: tournament.championship_legs === 'double' ? 'Aller-retour' : 'Aller simple' }]
              : []),
            ...(tournament.tournament_type === 'groups' && tournament.group_count
              ? [{ label: 'Poules', value: `${tournament.group_count} × ${tournament.teams_per_group} équipes` }]
              : []),
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(91,29,176,0.2)' }}>
              <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>{s.label}</p>
              <p className="font-semibold text-white text-sm">{s.value}</p>
            </div>
          ))}
        </div>

        {/* CTA principal */}
        {renderCTA()}
      </div>

      {/* ── Liste des joueurs acceptés ── */}
      {accepted > 0 && (
        <div className="dls-card p-4">
          <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Users size={14} style={{ color: '#4D8EFF' }} />
            Participants ({accepted})
          </p>
          <div className="flex flex-col gap-2">
            {players
              .filter(p => p.status === 'accepted')
              .map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 py-1.5"
                  style={{ borderBottom: i < accepted - 1 ? '1px solid rgba(91,29,176,0.1)' : 'none' }}>
                  {p.team_logo_url
                    ? <img src={p.team_logo_url} alt={p.team_name}
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(17,85,204,0.12)' }}>
                        <Users size={12} style={{ color: '#4D8EFF' }} />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                      {p.pseudo}
                      {p.is_creator && (
                        <span className="dls-badge dls-badge-gold text-xs">Créateur</span>
                      )}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#64748B' }}>{p.team_name}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
