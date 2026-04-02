import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LinkIcon, Clock, RefreshCw } from 'lucide-react'

interface Props {
  type?: '404' | 'session' | 'loading'
}

export default function SystemStates({ type }: Props) {
  const navigate = useNavigate()
  // Détecter le type depuis l'URL si non passé en prop
  const path = window.location.pathname
  const resolved = type ?? (path.includes('session') ? 'session' : path.includes('loading') ? 'loading' : '404')

  if (resolved === 'loading') {
    return (
      <div className="dls-page flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="dls-spinner-ws mb-6" />
        <h2 className="text-xl font-bold text-white mb-2">Synchronisation</h2>
        <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>Connexion WebSocket en cours…</p>
        <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full animate-pulse" style={{ background: '#1155CC', width: '60%' }} />
        </div>
        <p className="text-xs mt-4" style={{ color: '#64748B' }}>Mise à jour live automatique</p>
      </div>
    )
  }

  if (resolved === 'session') {
    return (
      <div className="dls-page max-w-md mx-auto text-center">
        <div className="dls-card p-8 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(245,166,35,0.12)' }}>
            <Clock size={32} style={{ color: '#F5A623' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Session expirée</h2>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Cookie expiré après 1 mois. Réinscris-toi en quelques secondes.
            </p>
          </div>
          <div className="w-full rounded-xl p-4 text-left"
            style={{ background: 'rgba(17,85,204,0.08)', border: '1px solid rgba(17,85,204,0.2)' }}>
            <p className="text-xs font-semibold text-white mb-1">Déjà inscrit ?</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Entre ton idx DLS pour retrouver ton profil instantanément.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={() => navigate('/')}
              className="dls-btn dls-btn-secondary flex-1">Accueil</button>
            <button onClick={() => navigate(-1)}
              className="dls-btn dls-btn-primary flex-1 flex items-center justify-center gap-1.5">
              <RefreshCw size={14} /> Me réinscrire
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 404
  return (
    <div className="dls-page max-w-md mx-auto text-center">
      <div className="dls-card p-8 flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(168,11,28,0.12)' }}>
          <LinkIcon size={32} style={{ color: '#F87171' }} />
        </div>
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: '#F87171' }}>ERREUR 404</p>
          <h2 className="text-xl font-bold text-white mb-2">Lien invalide</h2>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            Ce tournoi n'existe pas ou le lien a expiré.
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={() => navigate('/')}
            className="dls-btn dls-btn-secondary flex-1">← Accueil</button>
          <button onClick={() => navigate('/join')}
            className="dls-btn dls-btn-primary flex-1">Entrer un code</button>
        </div>
      </div>
    </div>
  )
}
