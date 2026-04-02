import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Users, CheckCircle, XCircle, ArrowLeft, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { usePlayers, useTournament } from '../hooks/useTournament'
import { divisionLabel, divisionClass, getCreatorSession } from '../lib/utils'
import api from '../lib/api'
import type { PlayerStatus } from '../lib/api'

type Filter = 'all' | PlayerStatus

export default function ManageRegistrations() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()
  const { data: t } = useTournament(slug)
  const { data: players = [], isLoading } = usePlayers(slug)
  const [filter, setFilter] = useState<Filter>('all')
  const [acting, setActing] = useState<string | null>(null)

  const session = getCreatorSession()

  const decide = async (playerId: string, decision: 'accept' | 'reject') => {
    if (!session) { toast.error('Session expirée'); return }
    setActing(playerId)
    try {
      await api.playerDecision(playerId, decision, session)
      toast.success(decision === 'accept' ? 'Joueur accepté' : 'Joueur refusé')
      qc.invalidateQueries({ queryKey: ['players', slug] })
    } catch {
      toast.error('Erreur')
    } finally {
      setActing(null)
    }
  }

  const filtered = filter === 'all' ? players : players.filter(p => p.status === filter)
  const counts = {
    all: players.length,
    pending: players.filter(p => p.status === 'pending').length,
    accepted: players.filter(p => p.status === 'accepted').length,
    rejected: players.filter(p => p.status === 'rejected').length,
  }

  const FILTERS: { key: Filter; label: string; color: string }[] = [
    { key: 'all',      label: `Tous (${counts.all})`,           color: '#94A3B8' },
    { key: 'pending',  label: `En attente (${counts.pending})`, color: '#4D8EFF' },
    { key: 'accepted', label: `Acceptés (${counts.accepted})`,  color: '#4ADE80' },
    { key: 'rejected', label: `Refusés (${counts.rejected})`,   color: '#F87171' },
  ]

  return (
    <div className="dls-page max-w-2xl mx-auto">
      <button onClick={() => navigate(`/dashboard/${slug}`)}
        className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5 mb-6"
        style={{ color: '#94A3B8' }}>
        <ArrowLeft size={14} /> Dashboard
      </button>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Inscriptions</h1>
        {t && <span className="text-sm" style={{ color: '#64748B' }}>{t.name}</span>}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap mb-5">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="dls-btn dls-btn-sm transition-all"
            style={{
              background: filter === f.key ? 'rgba(17,85,204,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filter === f.key ? '#1155CC' : 'rgba(91,29,176,0.25)'}`,
              color: filter === f.key ? '#fff' : f.color,
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><span className="dls-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="dls-card p-10 text-center">
          <Users size={36} style={{ color: '#334155', margin: '0 auto 12px' }} />
          <p className="text-white font-medium">Aucun joueur</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(p => (
            <div key={p.id} className="dls-card p-4 flex items-center gap-4">
              {p.team_logo_url
                ? <img src={p.team_logo_url} alt={p.team_name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(17,85,204,0.12)' }}>
                    <Users size={18} style={{ color: '#4D8EFF' }} />
                  </div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-white truncate">{p.pseudo}</p>
                  {p.is_creator && <span className="dls-badge dls-badge-gold text-xs">Créateur</span>}
                </div>
                <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{p.team_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={divisionClass(p.dll_division)}>{divisionLabel(p.dll_division)}</span>
                  <span className="text-xs" style={{ color: '#64748B' }}>
                    {p.dll_won}V · {p.dll_lost}D · {p.dll_played}J
                  </span>
                </div>
              </div>

              {p.status === 'pending' ? (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => decide(p.id, 'accept')} disabled={acting === p.id}
                    className="dls-btn dls-btn-sm flex items-center gap-1"
                    style={{ background: 'rgba(22,163,74,0.15)', color: '#4ADE80', border: '1px solid rgba(22,163,74,0.3)' }}>
                    {acting === p.id ? <span className="dls-spinner dls-spinner-sm" /> : <CheckCircle size={14} />}
                    Accepter
                  </button>
                  <button onClick={() => decide(p.id, 'reject')} disabled={acting === p.id}
                    className="dls-btn dls-btn-sm flex items-center gap-1"
                    style={{ background: 'rgba(168,11,28,0.12)', color: '#F87171', border: '1px solid rgba(168,11,28,0.3)' }}>
                    <XCircle size={14} /> Refuser
                  </button>
                </div>
              ) : (
                <span className={p.status === 'accepted' ? 'dls-badge dls-badge-green' : 'dls-badge dls-badge-red'}>
                  {p.status === 'accepted' ? 'Accepté' : 'Refusé'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
