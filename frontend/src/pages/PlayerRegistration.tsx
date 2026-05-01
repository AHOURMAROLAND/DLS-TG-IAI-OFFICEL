import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, CheckCircle, ArrowLeft, Trophy, Users, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { divisionLabel, divisionClass } from '../lib/utils'
import { useTournament } from '../hooks/useTournament'
import { useAuth } from '../contexts/AuthContext'
import type { PlayerInfo, RecentMatch } from '../lib/api'

export default function PlayerRegistration() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: tournament } = useTournament(slug)
  const { isAuthenticated, loading: authLoading, user } = useAuth()

  // Rediriger vers login si non connecté, en préservant le slug
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate(`/login?redirect=/register/${slug}`)
    }
  }, [authLoading, isAuthenticated, navigate, slug])

  const [idx, setIdx] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [honeypot, setHoneypot] = useState('')

  // Pré-remplissage depuis le profil si l'user a un idx lié (v2)
  const hasProfileIdx = !!(user?.dll_idx)
  useEffect(() => {
    if (user?.dll_idx && user.pseudo) {
      setIdx(user.dll_idx)
      setPseudo(user.pseudo)
      // Construire la fiche joueur depuis les données du profil sans appel tracker
      if (user.dll_team_name != null && user.dll_division != null) {
        setPlayerInfo({
          team_name: user.dll_team_name,
          division: user.dll_division,
          played: 0,
          won: 0,
          lost: 0,
          win_rate: 0,
          recent_matches: [],
        })
      }
    }
  }, [user])

  // Debounce 800ms sur le champ idx — uniquement si pas de profil idx
  useEffect(() => {
    if (hasProfileIdx) return  // Pré-rempli depuis le profil, pas besoin de vérifier
    if (!idx.trim() || idx.length < 8) { setPlayerInfo(null); return }
    const timer = setTimeout(() => verifyIdx(), 800)
    return () => clearTimeout(timer)
  }, [idx, hasProfileIdx])

  const verifyIdx = async () => {
    if (!idx.trim()) return
    setVerifying(true)
    try {
      const info = await api.verifyPlayer(idx.trim())
      setPlayerInfo(info)
      toast.success('Joueur vérifié !')
    } catch (e: any) {
      setPlayerInfo(null)
      const status = e?.response?.status
      const detail = e?.response?.data?.detail
      if (status === 400) {
        toast.error(detail || 'Identifiant DLS introuvable — vérifie ton idx')
      } else if (status === 503) {
        toast.error('Tracker FTGames indisponible — réessaie dans quelques secondes')
      } else {
        toast.error('Erreur lors de la vérification')
      }
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
    // Honeypot — si rempli, c'est un bot
    if (honeypot) {
      // Simuler un succès pour ne pas alerter le bot
      await new Promise(r => setTimeout(r, 1500))
      return
    }
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
      navigate(`/register/${slug}/pending?player_id=${res.player_id}`)
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
        <div className="dls-card p-4 flex items-center gap-3 mb-5">
          {tournament.logo_url
            ? <img src={tournament.logo_url} alt={tournament.name} className="w-10 h-10 rounded-lg object-cover" />
            : <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(17,85,204,0.15)' }}>
                <Trophy size={16} style={{ color: '#4D8EFF' }} />
              </div>
          }
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{tournament.name}</p>
            <p className="text-xs" style={{ color: '#64748B' }}>{tournament.max_teams} équipes max</p>
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
          {hasProfileIdx ? (
            <div className="dls-input font-mono flex items-center gap-2"
              style={{ background: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.3)', cursor: 'default' }}>
              <span className="flex-1 text-white">{idx}</span>
              <span className="text-xs" style={{ color: '#4ADE80' }}>✓ Lié à ton compte</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <input className="dls-input flex-1 font-mono" placeholder="Ex: xxxxxxxx"
                value={idx} onChange={e => { setIdx(e.target.value); setPlayerInfo(null) }}
                onKeyDown={e => e.key === 'Enter' && verifyIdx()} />
              <button onClick={verifyIdx} disabled={verifying || idx.trim().length < 8}
                className="dls-btn dls-btn-primary" title="Vérifier">
                {verifying ? <span className="dls-spinner dls-spinner-sm" /> : <Search size={16} />}
              </button>
            </div>
          )}
          {!hasProfileIdx && idx.length > 0 && idx.length < 8 && (
            <p className="text-xs mt-1" style={{ color: '#F87171' }}>L'idx doit contenir au moins 8 caractères</p>
          )}
          {!hasProfileIdx && idx.length >= 8 && !playerInfo && !verifying && (
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>Vérification automatique en cours…</p>
          )}
        </div>

        {/* Résultat vérification */}
        {playerInfo && (
          <div className="flex flex-col gap-3">
            {/* Fiche joueur */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)' }}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} style={{ color: '#4ADE80' }} />
                <span className="text-sm font-semibold" style={{ color: '#4ADE80' }}>Joueur vérifié</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Équipe DLS</p>
                  <p className="font-semibold text-white text-sm">{playerInfo.team_name}</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Division</p>
                  <span className={divisionClass(playerInfo.division)}>{divisionLabel(playerInfo.division)}</span>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Stats globales</p>
                  <p className="text-sm font-medium">
                    <span style={{ color: '#4ADE80' }}>{playerInfo.won}V</span>
                    <span style={{ color: '#64748B' }}> · </span>
                    <span style={{ color: '#F87171' }}>{playerInfo.lost}D</span>
                    <span style={{ color: '#64748B' }}> · </span>
                    <span style={{ color: '#94A3B8' }}>{playerInfo.played}J</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Win rate</p>
                  <p className="font-bold text-sm" style={{ color: '#F5A623' }}>{playerInfo.win_rate}%</p>
                </div>
              </div>
            </div>

            {/* 3 derniers matchs */}
            {playerInfo.recent_matches?.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#94A3B8' }}>
                  <Clock size={12} /> 3 derniers matchs
                </p>
                <div className="flex flex-col gap-2">
                  {playerInfo.recent_matches.map((m, i) => (
                    <RecentMatchRow key={i} match={m} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pseudo */}
        <div>
          <label className="dls-label">Pseudo dans le tournoi *</label>
          <input className="dls-input" placeholder="Votre nom d'affichage"
            value={pseudo} onChange={e => setPseudo(e.target.value)} />
        </div>

        {/* Logo */}
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

        {/* Honeypot — champ invisible pour les bots. Ne jamais remplir ce champ. */}
        <input
          type="text"
          name="website"
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
    </div>
  )
}

function RecentMatchRow({ match: m }: { match: RecentMatch }) {
  const win = m.player_score > m.opp_score
  const draw = m.player_score === m.opp_score
  const result = win ? 'V' : draw ? 'N' : 'D'
  const resultColor = win ? '#4ADE80' : draw ? '#94A3B8' : '#F87171'
  const resultBg = win ? 'rgba(22,163,74,0.15)' : draw ? 'rgba(148,163,184,0.1)' : 'rgba(168,11,28,0.15)'

  return (
    <div className="rounded-lg p-3 flex items-center gap-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(91,29,176,0.15)' }}>
      {/* Résultat */}
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: resultBg, color: resultColor }}>
        {result}
      </span>

      {/* Score + adversaire */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-white">
            {m.player_score} – {m.opp_score}
          </span>
          {m.extra_time && (
            <span className="text-xs" style={{ color: '#F5A623' }}>AET</span>
          )}
          {m.penalties && (
            <span className="text-xs" style={{ color: '#A78BFA' }}>PK</span>
          )}
        </div>
        <p className="text-xs truncate" style={{ color: '#64748B' }}>
          vs {m.opponent_team} · {m.minutes}'
        </p>
      </div>

      {/* Date */}
      <span className="text-xs flex-shrink-0" style={{ color: '#64748B' }}>{m.heure}</span>
    </div>
  )
}
