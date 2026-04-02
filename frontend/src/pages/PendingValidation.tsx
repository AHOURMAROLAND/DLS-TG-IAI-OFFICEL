import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, Clock, RefreshCw } from 'lucide-react'

export default function PendingValidation() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()

  return (
    <div className="dls-page max-w-md mx-auto text-center">
      <div className="dls-card p-8 flex flex-col items-center gap-5">
        {/* Animation */}
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(17,85,204,0.15)' }}>
          <Clock size={32} style={{ color: '#4D8EFF' }} className="animate-pulse" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-white mb-2">Demande envoyée !</h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            Le créateur du tournoi va examiner ta demande.
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
          Pas besoin de rester sur cette page — reviens consulter le lien du tournoi.
        </p>

        <button onClick={() => navigate(`/join/${slug}`)}
          className="dls-btn dls-btn-secondary dls-btn-sm">
          Retour au tournoi
        </button>
      </div>
    </div>
  )
}
