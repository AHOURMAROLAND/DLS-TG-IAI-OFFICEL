import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
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

  const copy = async () => {
    await copyToClipboard(url)
    setCopied(true)
    setFlashing(true)
    toast.success('Lien copié !')
    setTimeout(() => { setCopied(false); setFlashing(false) }, 2000)
  }

  return (
    <div className="dls-card p-5 flex flex-col items-center gap-4">
      <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{label}</p>

      {/* QR Code */}
      <div className="rounded-xl p-3" style={{ background: '#fff' }}>
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
    </div>
  )
}
