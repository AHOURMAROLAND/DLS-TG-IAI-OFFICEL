import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, RefreshCw } from 'lucide-react'
import api from '../lib/api'
import LottiePlayer from '../components/ui/LottiePlayer'

const POLL_INTERVAL = 10_000 // 10 secondes

export default function PendingValidation() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending')
  const [dots, setDots] = useState('.')

  // Animation des points
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600)
    return () => clearInterval(t)
  }, [])

  // Polling toutes les 10s
  useEffect(() => {
    if (!slug) return

    const playerId = localStorage.getItem(`player_id_${slug}`)
    if (!playerId) return

    const check = async () => {
      try {
        const player = await api.getPlayer(playerId)
        if (player.status === 'accepted') {
          setStatus('accepted')
          // Redirection automatique vers les vues du tournoi
          setTimeout(() => navigate(`/tournament/${slug}/bracket`), 2000)
        } else if (player.status === 'rejected') {
          setStatus('rejected')
        }
      } catch {
        // Silencieux — on réessaie au prochain tick
      }
    }

    check()
    const interval = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [slug, navigate])

  if (status === 'accepted') {
    return (
      <div className="dls-page max-w-md mx-auto text-center">
        <div className="dls-card p-8 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(22,163,74,0.15)' }}>
            <CheckCircle size={36} style={{ color: '#4ADE80' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white mb-2">Demande acceptée !</h1>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Tu es maintenant inscrit au tournoi. Redirection en cours{dots}
            </p>
          </div>
          <div className="dls-spinner" />
        </div>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="dls-page max-w-md mx-auto text-center">
        <div className="dls-card p-8 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(168,11,28,0.12)' }}>
            <span style={{ fontSize: 32 }}>❌</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white mb-2">Demande refusée</h1>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Le créateur du tournoi a refusé ta demande d'inscription.
            </p>
          </div>
          <button onClick={() => navigate('/')} className="dls-btn dls-btn-secondary">
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dls-page max-w-md mx-auto text-center">
      <div className="dls-card p-8 flex flex-col items-center gap-5">
        {/* Spinner animé Lottie */}
        <div className="relative w-20 h-20">
          <LottiePlayer
            src="/lottie/clock-pending.json"
            style={{ width: 80, height: 80 }}
            fallback={
              <div className="w-20 h-20 flex items-center justify-center">
                <div className="dls-spinner-ws" style={{ width: 64, height: 64 }} />
              </div>
            }
          />
        </div>

        <div>
          <h1 className="text-xl font-bold text-white mb-2">Demande envoyée !</h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            En attente de validation{dots}
          </p>
        </div>

        {/* Checklist */}
        <div className="w-full flex flex-col gap-3">
          {[
            { label: 'Identité DLL vérifiée', done: true },
            { label: 'Logo uploadé', done: true },
            { label: 'Validation créateur', done: false },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 rounded-lg p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(91,29,176,0.2)' }}>
              {s.done
                ? <CheckCircle size={16} style={{ color: '#4ADE80' }} />
                : <RefreshCw size={16} style={{ color: '#4D8EFF' }} className="animate-spin" />
              }
              <span className="text-sm" style={{ color: s.done ? '#fff' : '#94A3B8' }}>{s.label}</span>
            </div>
          ))}
        </div>

        <p className="text-xs" style={{ color: '#64748B' }}>
          Vérification automatique toutes les 10 secondes
        </p>

        <button onClick={() => navigate(`/join/${slug}`)}
          className="dls-btn dls-btn-secondary dls-btn-sm">
          Retour au tournoi
        </button>
      </div>
    </div>
  )
}
