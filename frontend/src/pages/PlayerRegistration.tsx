import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, CheckCircle, ArrowLeft, Trophy, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { divisionLabel, divisionClass } from '../lib/utils'
import { useTournament } from '../hooks/useTournament'
import type { PlayerInfo } from '../lib/api'

export default function PlayerRegistration() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: tournament } = useTournament(slug)

  const [idx, setIdx] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const verifyIdx = async () => {
    if (!idx.trim()) return
    setVerifying(true)
    try {
      const info = await api.verifyPlayer(idx.trim())
      setPlayerInfo(info)
      toast.success('Joueur vérifié !')
    } catch {
      toast.error('Identifiant DLS introuvable')
      setPlayerInfo(null)
    } finally {
      setVerifying(false)
    }
  }

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { toast.error('Max 5 MB'); return }
    setLogo(f)
    const r = new FileReader()
    r.onloadend = () => setLogoPreview(r.result as string)
    r.readAsDataURL(f)
  }

  const submit = async () => {
    if (!playerInfo) { toast.error('Vérifiez votre idx DLS d\'abord'); return }
    if (!pseudo.trim()) { toast.error('Entrez un pseudo'); return }
    if (!slug) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('pseudo', pseudo.trim())
      fd.append('dll_idx', idx.trim())
      if (logo) fd.append('logo', logo)
      const res = await api.registerPlayer(slug, fd)
      // Stocker le session_token joueur
      localStorage.setItem(`player_session_${slug}`, res.session_token)
      localStorage.setItem(`player_id_${slug}`, res.player_id)
      navigate(`/register/${slug}/pending`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de l\'inscription')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dls-page max-w-lg mx-auto">
      <button onClick={() => navigate(`/join/${slug}`)}
        className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5 mb-6"
        style={{ color: '#94A3B8' }}>
        <ArrowLeft size={14} /> Retour
      </button>

      {/* Tournoi cible */}
      {tournament && (
        <div className="dls-card p-4 flex items-center gap-3 mb-6">
          {tournament.logo_url
            ? <img src={tournament.logo_url} alt={tournament.name} className="w-10 h-10 rounded-lg object-cover" />
            : <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(17,85,204,0.15)' }}>
                <Trophy size={16} style={{ color: '#4D8EFF' }} />
              </div>
          }
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{tournament.name}</p>
            <p className="text-xs" style={{ color: '#64748B' }}>
              {tournament.max_teams} équipes max
            </p>
          </div>
          <span className="dls-badge dls-badge-registration">Inscriptions ouvertes</span>
        </div>
      )}

      <div className="dls-card p-6 flex flex-col gap-5">
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <Users size={16} style={{ color: '#4D8EFF' }} /> Inscription au tournoi
        </h1>

        {/* idx DLS */}
        <div>
          <label className="dls-label">Identifiant DLS (idx) *</label>
          <div className="flex gap-2">
            <input className="dls-input flex-1 font-mono" placeholder="Ex: k5dfr5xx"
              value={idx} onChange={e => { setIdx(e.target.value); setPlayerInfo(null) }}
              onKeyDown={e => e.key === 'Enter' && verifyIdx()} />
            <button onClick={verifyIdx} disabled={verifying || !idx.trim()}
              className="dls-btn dls-btn-primary">
              {verifying ? <span className="dls-spinner dls-spinner-sm" /> : <Search size={16} />}
            </button>
          </div>
        </div>

        {/* Résultat vérification */}
        {playerInfo && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} style={{ color: '#4ADE80' }} />
              <span className="text-sm font-semibold" style={{ color: '#4ADE80' }}>Joueur vérifié</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p style={{ color: '#64748B' }} className="text-xs">Équipe DLS</p>
                <p className="font-semibold text-white">{playerInfo.team_name}</p>
              </div>
              <div>
                <p style={{ color: '#64748B' }} className="text-xs">Division</p>
                <span className={divisionClass(playerInfo.division)}>{divisionLabel(playerInfo.division)}</span>
              </div>
              <div>
                <p style={{ color: '#64748B' }} className="text-xs">Stats globales</p>
                <p className="text-sm">
                  <span style={{ color: '#4ADE80' }}>{playerInfo.won}V</span>
                  {' · '}
                  <span style={{ color: '#F87171' }}>{playerInfo.lost}D</span>
                  {' · '}
                  <span style={{ color: '#94A3B8' }}>{playerInfo.played}J</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pseudo */}
        <div>
          <label className="dls-label">Pseudo dans le tournoi *</label>
          <input className="dls-input" placeholder="Votre nom d'affichage"
            value={pseudo} onChange={e => setPseudo(e.target.value)} />
        </div>

        {/* Logo équipe */}
        <div>
          <label className="dls-label">Logo de l'équipe (optionnel)</label>
          <label htmlFor="player-logo" className="cursor-pointer block">
            <div className="border-2 border-dashed rounded-xl p-4 text-center transition-all"
              style={{ borderColor: 'rgba(91,29,176,0.35)', background: 'rgba(91,29,176,0.05)' }}>
              {logoPreview
                ? <img src={logoPreview} alt="logo" className="w-12 h-12 rounded-lg object-cover mx-auto mb-1" />
                : <p className="text-xs" style={{ color: '#64748B' }}>Cliquer pour uploader</p>
              }
            </div>
          </label>
          <input id="player-logo" type="file" accept="image/*" className="hidden" onChange={handleLogo} />
        </div>

        <button onClick={submit} disabled={submitting || !playerInfo || !pseudo.trim()}
          className="dls-btn dls-btn-primary dls-btn-full">
          {submitting ? <span className="dls-spinner dls-spinner-sm" /> : null}
          {submitting ? 'Envoi...' : 'Envoyer ma demande'}
        </button>
      </div>
    </div>
  )
}
