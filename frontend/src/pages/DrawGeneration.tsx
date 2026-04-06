import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Shuffle, RotateCcw, CheckCircle, ArrowLeft, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useTournament, usePlayers } from '../hooks/useTournament'
import { divisionLabel, divisionClass } from '../lib/utils'
import api from '../lib/api'
import LottiePlayer from '../components/ui/LottiePlayer'

export default function DrawGeneration() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()
  const { data: t } = useTournament(slug)
  const { data: players = [] } = usePlayers(slug)
  const [draw, setDraw] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // Synchroniser confirmed avec le statut réel du tournoi (t peut être undefined au premier render)
  const confirmed = t?.status === 'in_progress' || t?.status === 'finished'

  const accepted = players.filter(p => p.status === 'accepted')

  const generate = async () => {
    if (!slug) return
    setGenerating(true)
    try {
      const res = await api.generateDraw(slug)
      setDraw(res.draw)
      toast.success('Tirage généré !')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erreur lors du tirage')
    } finally {
      setGenerating(false)
    }
  }
  const confirm = async () => {
    if (!draw || !slug) return
    if (!window.confirm('Valider ce tirage ? Le tournoi sera lancé.')) return
    setConfirming(true)
    try {
      await api.confirmDraw(slug, draw)
      qc.invalidateQueries({ queryKey: ['tournament', slug] })
      toast.success('Tournoi lancé !')
      setTimeout(() => navigate(`/tournament/${slug}/bracket`), 1500)
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.response?.data?.error?.message
      toast.error(detail || 'Erreur lors de la confirmation')
    } finally {
      setConfirming(false)
    }
  }

  const renderGroups = (groups: Record<string, any[]>) =>
    Object.entries(groups).map(([gid, ps]) => (
      <div key={gid} className="dls-card p-4">
        <p className="text-xs font-bold mb-3" style={{ color: '#A78BFA' }}>Groupe {gid.replace('G', '')}</p>
        <div className="flex flex-col gap-2">
          {ps.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2">
              {p.dll_division === 1 && <Star size={12} style={{ color: '#F5A623' }} />}
              <span className="text-sm text-white flex-1">{p.pseudo}</span>
              <span className={divisionClass(p.dll_division)}>{divisionLabel(p.dll_division)}</span>
            </div>
          ))}
        </div>
      </div>
    ))

  const renderPairs = (pairs: any[]) =>
    pairs.map((pair: any, i: number) => (
      <div key={i} className="dls-card p-4 flex items-center gap-3">
        <div className="flex-1 text-right">
          <p className="text-sm font-semibold text-white">{pair.home?.pseudo}</p>
          <span className={divisionClass(pair.home?.dll_division)}>{divisionLabel(pair.home?.dll_division)}</span>
        </div>
        <span className="text-xs font-bold px-2" style={{ color: '#64748B' }}>VS</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{pair.away?.pseudo}</p>
          <span className={divisionClass(pair.away?.dll_division)}>{divisionLabel(pair.away?.dll_division)}</span>
        </div>
      </div>
    ))

  return (
    <div className="dls-page max-w-2xl mx-auto">
      <button onClick={() => navigate(`/dashboard/${slug}`)}
        className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5 mb-6"
        style={{ color: '#94A3B8' }}>
        <ArrowLeft size={14} /> Dashboard
      </button>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Tirage au sort</h1>
        <span className="text-sm" style={{ color: '#64748B' }}>{accepted.length} joueurs qualifiés</span>
      </div>

      {/* Badge algo */}
      <div className="dls-card p-3 flex items-center gap-3 mb-5"
        style={{ background: 'rgba(17,85,204,0.08)', borderColor: 'rgba(17,85,204,0.3)' }}>
        {generating ? (
          <LottiePlayer
            src="/lottie/shuffle-draw.json"
            style={{ width: 32, height: 32 }}
            fallback={<Shuffle size={16} style={{ color: '#4D8EFF' }} />}
          />
        ) : (
          <Shuffle size={16} style={{ color: '#4D8EFF' }} />
        )}
        <div>
          <p className="text-sm font-semibold text-white">Algorithme balanced_draw</p>
          <p className="text-xs" style={{ color: '#64748B' }}>Trié par division DLS — répartition équitable</p>
        </div>
      </div>

      {/* Résultat tirage */}
      {draw && (
        <div className="mb-5">
          <p className="text-sm font-semibold text-white mb-3">Tirage généré</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {draw.groups && renderGroups(draw.groups)}
            {draw.pairs && renderPairs(draw.pairs)}
            {draw.matchups && renderPairs(draw.matchups)}
          </div>
        </div>
      )}

      {/* Actions */}
      {!confirmed ? (
        <div className="flex gap-3">
          <button onClick={generate} disabled={generating || accepted.length < 2}
            className="dls-btn dls-btn-secondary flex-1 flex items-center justify-center gap-2">
            {generating ? <span className="dls-spinner dls-spinner-sm" /> : <RotateCcw size={16} />}
            {generating ? 'Génération...' : draw ? 'Régénérer' : 'Générer le tirage'}
          </button>
          {draw && (
            <button onClick={confirm} disabled={confirming}
              className="dls-btn dls-btn-primary flex-1 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
              {confirming ? <span className="dls-spinner dls-spinner-sm" /> : <CheckCircle size={16} />}
              {confirming ? 'Validation...' : 'Valider le tirage'}
            </button>
          )}
        </div>
      ) : (
        <div className="dls-card p-6 text-center dls-podium-1">
          <CheckCircle size={36} style={{ color: '#4ADE80', margin: '0 auto 12px' }} />
          <p className="font-bold text-white mb-1">Tirage validé — Tournoi lancé !</p>
          <button onClick={() => navigate(`/tournament/${slug}/bracket`)}
            className="dls-btn dls-btn-primary mt-3">
            Voir le bracket
          </button>
        </div>
      )}
    </div>
  )
}
