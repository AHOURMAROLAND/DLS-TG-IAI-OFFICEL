import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Upload, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

// Écran ⑤ — Upload logo (standalone si besoin, sinon intégré dans PlayerRegistration)
export default function UploadLogo() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const [logo, setLogo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const EMOJIS = ['🦅', '🦁', '🐉', '⚡', '🔥', '💎']

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { toast.error('Max 5 MB'); return }
    setLogo(f)
    const r = new FileReader()
    r.onloadend = () => setPreview(r.result as string)
    r.readAsDataURL(f)
  }

  const handleEmoji = (emoji: string) => {
    setPreview(null)
    setLogo(null)
    toast.success(`Emoji ${emoji} sélectionné`)
  }

  const handleContinue = () => {
    navigate(`/register/${slug}/pending`)
  }

  return (
    <div className="dls-page max-w-md mx-auto">
      <button onClick={() => navigate(-1)}
        className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5 mb-6"
        style={{ color: '#94A3B8' }}>
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="dls-card p-6 flex flex-col gap-5">
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <Upload size={16} style={{ color: '#4D8EFF' }} /> Logo de l'équipe
        </h1>

        {/* Zone upload */}
        <label htmlFor="logo-up" className="cursor-pointer block">
          <div className="border-2 border-dashed rounded-xl p-8 text-center transition-all"
            style={{ borderColor: 'rgba(91,29,176,0.35)', background: 'rgba(91,29,176,0.05)' }}>
            {preview
              ? <img src={preview} alt="preview" className="w-20 h-20 rounded-xl object-cover mx-auto mb-2" />
              : <Upload size={32} style={{ color: '#64748B', margin: '0 auto 8px' }} />
            }
            <p className="text-sm font-medium text-white mb-1">
              {logo ? logo.name : 'Cliquer pour uploader'}
            </p>
            <p className="text-xs" style={{ color: '#64748B' }}>JPG, PNG, WEBP — max 5 MB</p>
          </div>
        </label>
        <input id="logo-up" type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {/* Emojis alternatifs */}
        <div>
          <p className="dls-label mb-2">Ou choisir un emoji</p>
          <div className="grid grid-cols-6 gap-2">
            {EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => handleEmoji(e)}
                className="text-2xl rounded-lg p-2 transition-all hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(91,29,176,0.2)' }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleContinue} className="dls-btn dls-btn-primary dls-btn-full">
          Envoyer ma demande
        </button>
      </div>
    </div>
  )
}
