import { useNavigate } from 'react-router-dom'
import { Trophy, Settings, UserCheck, Plus, Trash2, LogIn } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { tournamentStatusLabel, tournamentStatusClass, tournamentTypeLabel } from '../lib/utils'
import api from '../lib/api'
import type { Tournament } from '../lib/api'
import { SkeletonMatchList } from '../components/ui/Skeleton'
import toast from 'react-hot-toast'

export default function TournamentsList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isAuthenticated } = useAuth()

  const { data: myTournaments = [], isLoading: loadingMine } = useQuery({
    queryKey: ['my-tournaments'],
    queryFn: () => api.getMyTournaments(),
    enabled: isAuthenticated,
  })

  const { data: participating = [], isLoading: loadingPart } = useQuery({
    queryKey: ['participating-tournaments'],
    queryFn: () => api.getParticipatingTournaments(),
    enabled: isAuthenticated,
  })

  const deleteTournament = async (t: Tournament) => {
    if (!window.confirm(`Supprimer "${t.name}" définitivement ?`)) return
    try {
      await api.deleteTournament(t.slug)
      toast.success('Tournoi supprimé')
      qc.invalidateQueries({ queryKey: ['my-tournaments'] })
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="dls-page max-w-md mx-auto text-center">
        <div className="dls-card p-10 flex flex-col items-center gap-5">
          <Trophy size={40} style={{ color: '#334155' }} />
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Connecte-toi</h2>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Pour voir tes tournois créés et tes participations
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/login')} className="dls-btn dls-btn-primary flex items-center gap-1.5">
              <LogIn size={14} /> Se connecter
            </button>
            <button onClick={() => navigate('/register')} className="dls-btn dls-btn-secondary">
              Créer un compte
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dls-page max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Mes tournois</h1>
        <button onClick={() => navigate('/create')}
          className="dls-btn dls-btn-primary dls-btn-sm flex items-center gap-1.5">
          <Plus size={14} /> Créer
        </button>
      </div>

      {/* ── Tournois créés ── */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2"
          style={{ color: '#F5A623' }}>
          <Settings size={16} /> Tournois que j'ai créés
          <span className="dls-badge dls-badge-gold">{myTournaments.length}</span>
        </h2>

        {loadingMine ? <SkeletonMatchList count={2} /> :
          myTournaments.length === 0 ? (
            <div className="dls-card p-8 text-center">
              <p className="text-white font-medium mb-1">Aucun tournoi créé</p>
              <p className="text-sm mb-4" style={{ color: '#64748B' }}>
                Crée ton premier tournoi DLS 26
              </p>
              <button onClick={() => navigate('/create')} className="dls-btn dls-btn-primary dls-btn-sm">
                <Plus size={14} /> Créer un tournoi
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myTournaments.map(t => (
                <div key={t.id} className="dls-card p-4 flex items-center gap-4"
                  style={{ borderColor: 'rgba(245,166,35,0.3)' }}>
                  {t.logo_url
                    ? <img src={t.logo_url} alt={t.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(245,166,35,0.12)' }}>
                        <Trophy size={20} style={{ color: '#F5A623' }} />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-white truncate">{t.name}</p>
                      <span className="dls-badge dls-badge-gold flex-shrink-0">Créateur</span>
                    </div>
                    <p className="text-xs" style={{ color: '#64748B' }}>
                      {tournamentTypeLabel(t.tournament_type)} · {t.max_teams} équipes
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={tournamentStatusClass(t.status)}>
                      {tournamentStatusLabel(t.status)}
                    </span>
                    <button onClick={() => navigate(`/dashboard/${t.slug}`)}
                      className="dls-btn dls-btn-secondary dls-btn-sm">
                      Gérer
                    </button>
                    {(t.status === 'registration' || t.status === 'draft') && (
                      <button onClick={() => deleteTournament(t)}
                        className="dls-btn dls-btn-danger dls-btn-sm">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </section>

      {/* ── Participations ── */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2"
          style={{ color: '#4ADE80' }}>
          <UserCheck size={16} /> Tournois où je participe
          <span className="dls-badge dls-badge-green">{participating.length}</span>
        </h2>

        {loadingPart ? <SkeletonMatchList count={2} /> :
          participating.length === 0 ? (
            <div className="dls-card p-8 text-center">
              <p className="text-white font-medium mb-1">Aucune participation</p>
              <p className="text-sm mb-4" style={{ color: '#64748B' }}>
                Rejoins un tournoi avec un code d'invitation
              </p>
              <button onClick={() => navigate('/join')} className="dls-btn dls-btn-secondary dls-btn-sm">
                Rejoindre un tournoi
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {participating.map(t => (
                <div key={t.id}
                  onClick={() => navigate(`/tournament/${t.slug}/bracket`)}
                  className="dls-card p-4 flex items-center gap-4 cursor-pointer"
                  style={{ borderColor: 'rgba(22,163,74,0.3)' }}>
                  {t.logo_url
                    ? <img src={t.logo_url} alt={t.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(22,163,74,0.12)' }}>
                        <Trophy size={20} style={{ color: '#4ADE80' }} />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-white truncate">{t.name}</p>
                      <span className="dls-badge dls-badge-green flex-shrink-0">Inscrit</span>
                    </div>
                    <p className="text-xs" style={{ color: '#64748B' }}>
                      {tournamentTypeLabel(t.tournament_type)} · {t.max_teams} équipes
                    </p>
                  </div>
                  <span className={tournamentStatusClass(t.status)}>
                    {tournamentStatusLabel(t.status)}
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </section>
    </div>
  )
}
