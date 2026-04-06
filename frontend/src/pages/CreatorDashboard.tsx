import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trophy, Users, Settings, Shuffle, CheckSquare, Copy, Check, ArrowRight, UserPlus, Upload, Lock, UserCheck, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useTournament, usePlayers, useMatches } from '../hooks/useTournament'
import { useWebSocket } from '../hooks/useWebSocket'
import { tournamentStatusLabel, tournamentStatusClass, tournamentTypeLabel, copyToClipboard, formatRelative, divisionLabel } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import type { PlayerInfo } from '../lib/api'

interface ActivityItem {
  id: string
  text: string
  time: Date
  type: 'registration' | 'decision' | 'match' | 'draw'
}

export default function CreatorDashboard() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()
  const { data: t, isLoading } = useTournament(slug)
  const { data: players = [] } = usePlayers(slug)
  const { data: matches = [] } = useMatches(slug)
  const [copied, setCopied] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [onlineCount, setOnlineCount] = useState(0)

  // Modal inscription créateur
  const [showCreatorModal, setShowCreatorModal] = useState(false)
  const [creatorPseudo, setCreatorPseudo] = useState('')
  const [creatorIdx, setCreatorIdx] = useState('')
  const [creatorLogo, setCreatorLogo] = useState<File | null>(null)
  const [registering, setRegistering] = useState(false)

  // Modal ajout manuel (v2)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addIdx, setAddIdx] = useState('')
  const [addPseudo, setAddPseudo] = useState('')
  const [addIdxInfo, setAddIdxInfo] = useState<PlayerInfo | null>(null)
  const [addIdxStatus, setAddIdxStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [userSuggestions, setUserSuggestions] = useState<{ id: string; pseudo: string }[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const { user: _user } = useAuth()

  // WebSocket — fil d'activité en temps réel
  const onWs = useCallback((msg: any) => {
    if (msg.event === 'online_count') {
      setOnlineCount(msg.count)
      return
    }
    const newItem: ActivityItem = {
      id: Date.now().toString(),
      time: new Date(),
      type: msg.event === 'new_registration' ? 'registration'
          : msg.event === 'player_decision' ? 'decision'
          : msg.event === 'match_validated' ? 'match'
          : 'draw',
      text: msg.event === 'new_registration'
          ? `${msg.player?.pseudo} a demandé à rejoindre`
          : msg.event === 'player_decision'
          ? `Joueur ${msg.decision === 'accept' ? 'accepté' : 'refusé'}`
          : msg.event === 'match_validated'
          ? `Match validé : ${msg.home_score} – ${msg.away_score}${msg.is_manual ? ' (manuel)' : ''}`
          : 'Tirage confirmé — tournoi lancé',
    }
    setActivity(prev => [newItem, ...prev].slice(0, 10))
    qc.invalidateQueries({ queryKey: ['players', slug] })
    qc.invalidateQueries({ queryKey: ['matches', slug] })
    // Rediriger vers finished si tournoi terminé
    if (msg.tournament_status === 'finished') {
      navigate(`/tournament/${slug}/finished`)
    }
  }, [slug, qc, navigate])

  useWebSocket(t?.id, onWs)

  if (isLoading) return <Loader />
  if (!t) return null

  const pending = players.filter(p => p.status === 'pending').length
  const accepted = players.filter(p => p.status === 'accepted').length
  const validated = matches.filter(m => m.status === 'validated' || m.status === 'manual').length
  const awaitingValidation = matches.filter(m => m.status === 'pending_validation').length
  const inviteUrl = `${window.location.origin}/join/${t.slug}`
  const alreadyRegistered = players.some(p => p.is_creator)

  // Vérification idx pour ajout manuel (debounce 800ms)
  const verifyAddIdx = useCallback(async (val: string) => {
    const normalized = val.trim().toLowerCase()
    if (normalized.length < 8) { setAddIdxInfo(null); setAddIdxStatus('idle'); return }
    setAddIdxStatus('checking')
    try {
      const info = await api.verifyPlayer(normalized)
      setAddIdxInfo(info)
      setAddIdxStatus('ok')
    } catch {
      setAddIdxInfo(null)
      setAddIdxStatus('error')
    }
  }, [])

  // Recherche user par pseudo (debounce 400ms)
  const searchUsers = useCallback(async (val: string) => {
    if (val.trim().length < 2) { setUserSuggestions([]); return }
    try {
      const results = await api.searchUsers(val.trim())
      setUserSuggestions(results)
    } catch {
      setUserSuggestions([])
    }
  }, [])

  const submitAddPlayer = async () => {
    if (!slug || !addIdx.trim() || !addPseudo.trim()) {
      toast.error('Idx et pseudo requis')
      return
    }
    if (addIdxStatus !== 'ok') {
      toast.error('Vérifiez l\'identifiant DLS d\'abord')
      return
    }
    setAdding(true)
    try {
      await api.addPlayerManually(slug, {
        dll_idx: addIdx.trim(),
        pseudo: addPseudo.trim(),
        user_id: selectedUserId ?? undefined,
      })
      toast.success('Participant ajouté !')
      setShowAddModal(false)
      setAddIdx(''); setAddPseudo(''); setAddIdxInfo(null); setAddIdxStatus('idle')
      setUserSuggestions([]); setSelectedUserId(null)
      qc.invalidateQueries({ queryKey: ['players', slug] })
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de l\'ajout')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteGuest = async (playerId: string, pseudo: string) => {
    if (!window.confirm(`Supprimer ${pseudo} ?`)) return
    try {
      await api.deletePlayer(playerId)
      toast.success('Joueur supprimé')
      qc.invalidateQueries({ queryKey: ['players', slug] })
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de la suppression')
    }
  }

  const copy = async () => {
    await copyToClipboard(inviteUrl)
    setCopied(true)
    toast.success('Lien copié !')
    setTimeout(() => setCopied(false), 2000)
  }

  const registerAsCreator = async () => {
    if (!slug) return
    if (!creatorPseudo.trim() || !creatorIdx.trim()) {
      toast.error('Pseudo et idx DLS requis')
      return
    }
    setRegistering(true)
    try {
      const fd = new FormData()
      fd.append('pseudo', creatorPseudo.trim())
      fd.append('dll_idx', creatorIdx.trim())
      if (creatorLogo) fd.append('logo', creatorLogo)
      await api.registerCreator(slug, fd)
      toast.success('Inscrit comme joueur !')
      setShowCreatorModal(false)
      qc.invalidateQueries({ queryKey: ['players', slug] })
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de l\'inscription')
    } finally {
      setRegistering(false)
    }
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
      desc: t.status === 'registration' || t.status === 'draw' ? `${accepted}/${t.max_teams} joueurs` : 'Tirage effectué',
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
      {/* Header */}
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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={tournamentStatusClass(t.status)}>{tournamentStatusLabel(t.status)}</span>
            <span className="text-xs" style={{ color: '#64748B' }}>{tournamentTypeLabel(t.tournament_type)}</span>
            {t.visibility === 'private' && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.2)' }}>
                <Lock size={10} /> Privé
              </span>
            )}
            {onlineCount > 0 && (
              <span className="dls-online-badge">
                <span className="dls-live-dot" style={{ width: 6, height: 6 }} />
                {onlineCount} en ligne
              </span>
            )}
          </div>
          {/* Barre de progression inscriptions */}
          {t.status === 'registration' && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#64748B' }}>
                <span>{accepted} inscrits</span>
                <span>{t.max_teams} max</span>
              </div>
              <div className="dls-progress-bar">
                <div className="dls-progress-fill"
                  style={{ width: `${Math.min((accepted / t.max_teams) * 100, 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        {!alreadyRegistered && (
          <button onClick={() => setShowCreatorModal(true)}
            className="dls-btn dls-btn-secondary dls-btn-sm flex items-center gap-1.5 flex-shrink-0">
            <UserPlus size={14} /> M'inscrire
          </button>
        )}
        {t.status === 'registration' && (
          <button onClick={() => setShowAddModal(true)}
            className="dls-btn dls-btn-secondary dls-btn-sm flex items-center gap-1.5 flex-shrink-0">
            <UserCheck size={14} /> Ajouter
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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
      <div className="dls-card p-4 mb-5">
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
        {/* Token créateur — supprimé, remplacé par le système d'auth */}
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-2 gap-3 mb-5">
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

      {/* Vues tournoi */}
      {(t.status === 'in_progress' || t.status === 'finished') && (
        <div className="dls-card p-4 mb-5">
          <p className="text-xs mb-3" style={{ color: '#64748B' }}>Vues du tournoi</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Bracket',    path: `/tournament/${slug}/bracket` },
              { label: 'Poules',     path: `/tournament/${slug}/groups` },
              { label: 'Classement', path: `/tournament/${slug}/standings` },
              { label: 'Stats',      path: `/tournament/${slug}/stats` },
              { label: 'Calendrier', path: `/tournament/${slug}/calendar` },
            ].map(v => (
              <button key={v.label} onClick={() => navigate(v.path)}
                className="dls-btn dls-btn-secondary dls-btn-sm flex items-center gap-1">
                {v.label} <ArrowRight size={12} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fil d'activité */}
      {activity.length > 0 && (
        <div className="dls-card p-4">
          <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#94A3B8' }}>
            <span className="dls-live-dot" /> Activité récente
          </p>
          <div className="flex flex-col gap-2">
            {activity.map(a => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span style={{ color: a.type === 'registration' ? '#4D8EFF' : a.type === 'match' ? '#4ADE80' : '#A78BFA' }}>
                  {a.type === 'registration' ? '👤' : a.type === 'match' ? '⚽' : a.type === 'draw' ? '🎲' : '✅'}
                </span>
                <span className="flex-1 text-white text-xs">{a.text}</span>
                <span className="text-xs flex-shrink-0" style={{ color: '#64748B' }}>
                  {formatRelative(a.time)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal inscription créateur */}
      {showCreatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => e.target === e.currentTarget && setShowCreatorModal(false)}>
          <div className="dls-card p-6 w-full max-w-sm flex flex-col gap-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus size={16} style={{ color: '#4D8EFF' }} /> M'inscrire comme joueur
            </h2>

            <div>
              <label className="dls-label">Pseudo dans le tournoi *</label>
              <input className="dls-input" placeholder="Ton pseudo"
                value={creatorPseudo} onChange={e => setCreatorPseudo(e.target.value)} />
            </div>

            <div>
              <label className="dls-label">Identifiant DLS (idx) *</label>
              <input className="dls-input font-mono" placeholder="Ex: tqlxy8"
                value={creatorIdx} onChange={e => setCreatorIdx(e.target.value)} />
            </div>

            <div>
              <label className="dls-label">Logo équipe (optionnel)</label>
              <label htmlFor="creator-logo" className="cursor-pointer block">
                <div className="border-2 border-dashed rounded-xl p-3 text-center"
                  style={{ borderColor: 'rgba(91,29,176,0.35)', background: 'rgba(91,29,176,0.05)' }}>
                  <Upload size={16} style={{ color: '#64748B', margin: '0 auto 4px' }} />
                  <p className="text-xs" style={{ color: '#64748B' }}>
                    {creatorLogo ? creatorLogo.name : 'Cliquer pour uploader'}
                  </p>
                </div>
              </label>
              <input id="creator-logo" type="file" accept="image/*" className="hidden"
                onChange={e => setCreatorLogo(e.target.files?.[0] ?? null)} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowCreatorModal(false)}
                className="dls-btn dls-btn-secondary flex-1">Annuler</button>
              <button onClick={registerAsCreator} disabled={registering}
                className="dls-btn dls-btn-primary flex-1">
                {registering ? <span className="dls-spinner dls-spinner-sm" /> : null}
                {registering ? 'Inscription...' : 'S\'inscrire'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal ajout manuel (v2) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="dls-card p-6 w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck size={16} style={{ color: '#4D8EFF' }} /> Ajouter un participant
              </h2>
              <button onClick={() => setShowAddModal(false)} style={{ color: '#64748B' }}><X size={16} /></button>
            </div>

            <div>
              <label className="dls-label">Identifiant DLS (idx) *</label>
              <div className="relative">
                <input className={`dls-input font-mono pr-8 ${addIdxStatus === 'error' ? 'dls-input-error' : ''}`}
                  placeholder="Ex: abc123xy"
                  value={addIdx}
                  onChange={e => {
                    const v = e.target.value
                    setAddIdx(v); setAddIdxInfo(null); setAddIdxStatus('idle')
                    clearTimeout((window as any)._addIdxTimer)
                    ;(window as any)._addIdxTimer = setTimeout(() => verifyAddIdx(v), 800)
                  }} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {addIdxStatus === 'checking' && <span className="dls-spinner dls-spinner-sm" />}
                  {addIdxStatus === 'ok' && <Check size={13} style={{ color: '#4ADE80' }} />}
                  {addIdxStatus === 'error' && <X size={13} style={{ color: '#F87171' }} />}
                </div>
              </div>
              {addIdxStatus === 'error' && <p className="text-xs mt-1" style={{ color: '#F87171' }}>Idx introuvable sur le tracker</p>}
              {addIdxInfo && addIdxStatus === 'ok' && (
                <div className="mt-2 rounded-lg p-2 text-xs flex items-center gap-2"
                  style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
                  <Check size={12} style={{ color: '#4ADE80' }} />
                  <span className="text-white">{addIdxInfo.team_name}</span>
                  <span style={{ color: '#64748B' }}>·</span>
                  <span style={{ color: '#94A3B8' }}>{divisionLabel(addIdxInfo.division)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="dls-label">Pseudo *</label>
              <div className="relative">
                <input className="dls-input pr-8"
                  placeholder="Pseudo dans le tournoi"
                  value={addPseudo}
                  onChange={e => {
                    const v = e.target.value
                    setAddPseudo(v); setSelectedUserId(null)
                    clearTimeout((window as any)._searchTimer)
                    ;(window as any)._searchTimer = setTimeout(() => searchUsers(v), 400)
                  }} />
                <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
              </div>
              {userSuggestions.length > 0 && (
                <div className="mt-1 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(91,29,176,0.25)' }}>
                  {userSuggestions.map(u => (
                    <button key={u.id} type="button"
                      onClick={() => { setAddPseudo(u.pseudo); setSelectedUserId(u.id); setUserSuggestions([]) }}
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                      style={{ background: 'rgba(255,255,255,0.03)', color: '#fff', borderBottom: '1px solid rgba(91,29,176,0.1)' }}>
                      <UserCheck size={12} style={{ color: '#4D8EFF' }} />
                      {u.pseudo}
                      <span className="ml-auto text-xs" style={{ color: '#64748B' }}>Lier ce compte</span>
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => { setSelectedUserId(null); setUserSuggestions([]) }}
                    className="w-full px-3 py-2 text-left text-xs"
                    style={{ color: '#64748B', background: 'rgba(255,255,255,0.02)' }}>
                    Continuer sans lier de compte (invité)
                  </button>
                </div>
              )}
              {selectedUserId && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#4ADE80' }}>
                  <Check size={11} /> Compte lié
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="dls-btn dls-btn-secondary flex-1">Annuler</button>
              <button onClick={submitAddPlayer} disabled={adding || addIdxStatus !== 'ok' || !addPseudo.trim()}
                className="dls-btn dls-btn-primary flex-1">
                {adding ? <span className="dls-spinner dls-spinner-sm" /> : null}
                {adding ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
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
