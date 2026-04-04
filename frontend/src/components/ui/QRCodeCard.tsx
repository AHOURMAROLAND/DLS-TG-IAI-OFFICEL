import { useEffect, useRef, useState } from 'react'
import { Copy, Check, Download, Share } from 'lucide-react'
import { copyToClipboard } from '../../lib/utils'
import toast from 'react-hot-toast'

interface QRCodeCardProps {
  url: string
  slug: string
  label?: string
}

export default function QRCodeCard({ url, slug, label = "Lien d'invitation" }: QRCodeCardProps) {
  const [copied, setCopied] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Générer le QR code directement sur un canvas via qrcode lib
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvas, url, {
        width: 200,
        margin: 2,
        color: { dark: '#07080F', light: '#ffffff' },
      })
    })
  }, [url])

  const copy = async () => {
    await copyToClipboard(url)
    setCopied(true)
    setFlashing(true)
    toast.success('Lien copié !')
    setTimeout(() => { setCopied(false); setFlashing(false) }, 2000)
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Canvas déjà rendu — télécharger directement
    const link = document.createElement('a')
    link.download = `qr-tournoi-${slug.toUpperCase()}.png`
    link.href = canvas.toDataURL('image/png')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('QR Code téléchargé !')
  }

  const share = async () => {
    // Essayer Web Share API avec fichier image
    if (navigator.share) {
      try {
        const canvas = canvasRef.current
        if (canvas) {
          canvas.toBlob(async (blob) => {
            if (!blob) return
            const file = new File([blob], `qr-${slug}.png`, { type: 'image/png' })
            if (navigator.canShare?.({ files: [file] })) {
              await navigator.share({
                title: `Tournoi ${slug.toUpperCase()} — DLS Hub`,
                text: `Rejoins mon tournoi DLS Hub avec ce lien : ${url}`,
                files: [file],
              })
              return
            }
            // Partager sans fichier
            await navigator.share({
              title: `Tournoi ${slug.toUpperCase()} — DLS Hub`,
              text: `Rejoins mon tournoi DLS Hub`,
              url,
            })
          })
          return
        }
      } catch {
        // Annulé ou non supporté
      }
    }
    // Fallback : copier le lien
    await copyToClipboard(url)
    toast.success('Lien copié dans le presse-papier !')
  }

  return (
    <div className="dls-card p-5 flex flex-col items-center gap-4">
      <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{label}</p>

      {/* QR Code sur canvas */}
      <div className="rounded-xl p-3" style={{ background: '#fff' }}>
        <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 8 }} />
      </div>

      {/* Slug + copier */}
      <div className="w-full">
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-all ${flashing ? 'dls-slug-flash' : ''}`}
          style={{ background: 'rgba(17,85,204,0.08)', border: '1px solid rgba(17,85,204,0.2)' }}
          onClick={copy}
        >
          <code className="flex-1 text-sm font-mono font-bold tracking-widest text-center"
            style={{ color: '#4D8EFF' }}>
            {slug.toUpperCase()}
          </code>
          {copied
            ? <Check size={14} style={{ color: '#4ADE80', flexShrink: 0 }} />
            : <Copy size={14} style={{ color: '#4D8EFF', flexShrink: 0 }} />
          }
        </div>
        <p className="text-xs text-center mt-1.5" style={{ color: '#64748B' }}>
          Scanne ou partage ce code
        </p>
      </div>

      {/* Boutons */}
      <div className="flex gap-2 w-full">
        <button onClick={download}
          className="dls-btn dls-btn-secondary dls-btn-sm flex items-center gap-1.5 flex-1 justify-center">
          <Download size={13} /> Télécharger
        </button>
        <button onClick={share}
          className="dls-btn dls-btn-secondary dls-btn-sm flex items-center gap-1.5 flex-1 justify-center">
          <Share size={13} /> Partager
        </button>
      </div>
    </div>
  )
}
