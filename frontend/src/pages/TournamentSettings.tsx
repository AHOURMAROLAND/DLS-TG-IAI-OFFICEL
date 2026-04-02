import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Lock, Share2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useTournament } from '../hooks/useTournament'
import { copyToClipboard, getCreatorSession, tournamentTypeLabel } from '../lib/utils'
import api from '../lib/api'

export default function TournamentSettings() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()
  const { data: t } = useTournament(slug)

  const [name, setName] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Initialiser le nom quand le tournoi est chargé
  useEffect(() => {
    if (t && !name) setName(t.name)
  }, [t])

  const session = getCreatorSession()
  const shareUrl = `${window.location.origin}/tournament/${slug}/bracket`

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { toast.error('Max 5 MB'); return }
    setLogo(f)
    const r = new FileReader()
    r.onloadend = () => setLogoPreview(r.result as string)
    r.readAsDataURL(f)
  }

  const save = async () => {
    if (!session || !slug) return
    if (!name.trim()) { toast.error('Le nom ne peut pas être vide'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('creator_session', session)
      fd.append('name', name.trim())
      if (logo) fd.append('logo', logo)
      await api.updateTournament(slug, fd)
      qc.invalidateQueries({ queryKey: ['tournament', slug] })
      qc.invalidateQueries({ queryKey: ['tournaments'] })
      toast.success('Tournoi mis à jour !')
      setLogo(null)
      setLogoPreview(null)
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const deleteTournament = async () => {
    if (!session || !slug) return
    if (!window.confirm(`Supprimer définitivement "${t?.name}" ? Cette action est irréversible.`)) return
    setDeleting(true)
    try {
      await api.deleteTournament(slug, session)
      qc.invalidateQueries({ queryKey: ['tournaments'] })
      toast.success('Tournoi supprimé')
      navigate('/')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="dls-page max-w-lg mx-auto">
      <button onClick={() => navigate(`/dashboard/${slug}`)}
        className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5 mb-6"
        style={{ color: '#94A3B8' }}>
        <ArrowLeft size={14} /> Dashboard
      </button>

      <h1 className="text-xl font-bold text-white mb-6">Paramètres</h1>

      {/* Informations modifiables */}
      <div className="dls-card p-5 mb-4">
        <p className="text-sm font-semibold text-white mb-4">Informations</p>
        <div className="flex flex-col gap-4">
          {/* Nom */}
          <div>
            <label className="dls-label">Nom du tournoi</label>
            <input
              className="dls-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t?.name}
            />
          </div>

          {/* Logo */}
          <div>
            <label className="dls-label">Logo (optionnel)</label>
            <label htmlFor="settings-logo" className="cursor-pointer block">
              <div className="border-2 border-dashed rounded-xl p-4 flex items-center gap-4 transition-all"
                style={{ borderColor: 'rgba(91,29,176,0.35)', background: 'rgba(91,29,176,0.05)' }}>
                {logoPreview
                  ? <img src={logoPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  : t?.logo_url
                    ? <img src={t.logo_url} alt={t.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 opacity-50" />
                    : <Upload size={20} style={{ color: '#64748B' }} className="flex-shrink-0" />
                }
                <p className="text-xs" style={{ color: '#64748B' }}>
                  {logo ? logo.name : 'Cliquer pour changer le logo'}
                </p>
              </div>
            </label>
            <input id="settings-logo" type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          </div>

          <button onClick={save} disabled={saving}
            className="dls-btn dls-btn-primary dls-btn-sm flex items-center gap-1.5 self-end">
            {saving ? <span className="dls-spinner dls-spinner-sm" /> : <Save size={14} />}
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Champs verrouillés */}
      <div className="dls-card p-5 mb-4">
        <p className="text-sm font-semibold text-white mb-3">Champs verrouillés</p>
        {[
          { label: 'Nombre d\'équipes', value: t?.max_teams },
          { label: 'Format du tournoi', value: t ? tournamentTypeLabel(t.tournament_type) : '—' },
        ].map(f => (
          <div key={f.label} className="flex items-center justify-between py-2.5"
            style={{ borderBottom: '1px solid rgba(91,29,176,0.12)' }}>
            <span className="text-sm" style={{ color: '#94A3B8' }}>{f.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">{f.value}</span>
              <Lock size={12} style={{ color: '#64748B' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Partage */}
      <div className="dls-card p-5 mb-4">
        <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Share2 size={14} style={{ color: '#4D8EFF' }} /> Partage
        </p>
        <p className="text-xs mb-3" style={{ color: '#64748B' }}>URL publique du bracket (lecture seule)</p>
        <div className="flex gap-2">
          <code className="flex-1 text-xs rounded-lg px-3 py-2 truncate"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#4D8EFF', border: '1px solid rgba(17,85,204,0.2)' }}>
            {shareUrl}
          </code>
          <button onClick={() => { copyToClipboard(shareUrl); toast.success('Copié !') }}
            className="dls-btn dls-btn-secondary dls-btn-sm">Copier</button>
        </div>
      </div>

      {/* Zone dangereuse */}
      <div className="dls-card p-5" style={{ borderColor: 'rgba(168,11,28,0.3)' }}>
        <p className="text-sm font-semibold mb-1" style={{ color: '#F87171' }}>Zone dangereuse</p>
        <p className="text-xs mb-4" style={{ color: '#64748B' }}>
          Cette action supprime définitivement le tournoi, tous les joueurs et tous les matchs.
        </p>
        <button onClick={deleteTournament} disabled={deleting}
          className="dls-btn dls-btn-danger dls-btn-sm flex items-center gap-1.5">
          {deleting ? <span className="dls-spinner dls-spinner-sm" /> : <Trash2 size={14} />}
          {deleting ? 'Suppression...' : 'Supprimer le tournoi'}
        </button>
      </div>
    </div>
  )
}
