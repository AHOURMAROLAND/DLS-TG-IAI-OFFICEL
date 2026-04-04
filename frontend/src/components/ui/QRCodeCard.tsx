import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, Download, Share } from 'lucide-react'
import { useState, useRef } from 'react'
import { copyToClipboard } from '../../lib/utils'
import toast from 'react-hot-toast'

interface QRCodeCardProps {
  url: string
  slug: string
  label?: string
}

export default function QRCodeCard({ url, slug, label = 'Lien d\'invitation' }: QRCodeCardProps) {
  const [copied, setCopied] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const copy = async () => {
    await copyToClipboard(url)
    setCopied(true)
    setFlashing(true)
    toast.success('Lien copié !')
    setTimeout(() => { setCopied(false); setFlashing(false) }, 2000)
  }

  const share = async () => {
    // Web Share API (natif mobile) avec fallback copie
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rejoins le tournoi ${slug.toUpperCase()}`,
          text: `Utilise ce lien pour rejoindre le tournoi DLS Hub`,
          url,
        })
        return
      } catch {
        // Annulé par l'utilisateur
        return
      }
    }
    // Fallback : copier le lien
    await copyToClipboard(url)
    toast.success('Lien copié !')
  }

  const download = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const size = 300
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fond blanc
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size)
      URL.revokeObjectURL(svgUrl)
      const link = document.createElement('a')
      link.download = `qr-${slug}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('QR Code téléchargé !')
    }
    img.src = svgUrl
  }

  return (
    <div className="dls-card p-5 flex flex-col items-center gap-4">
      <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{label}</p>

      {/* QR Code */}
      <div ref={qrRef} className="rounded-xl p-3" style={{ background: '#fff' }}>
        <QRCodeSVG
          value={url}
          size={140}
          bgColor="#ffffff"
          fgColor="#07080F"
          level="M"
        />
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

      {/* Boutons actions */}
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
