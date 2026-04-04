import { useEffect, useRef, useState } from 'react'
import { X, Camera } from 'lucide-react'

interface QRScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const divId = 'qr-scanner-container'
  const scannerRef = useRef<any>(null)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let scanner: any = null

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        scanner = new Html5Qrcode(divId)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            // Extraire le slug depuis l'URL scannée
            let slug = decodedText.trim()
            try {
              const url = new URL(decodedText)
              const parts = url.pathname.split('/').filter(Boolean)
              // Chercher le slug après /join/ ou /register/
              const joinIdx = parts.findIndex(p => p === 'join' || p === 'register')
              if (joinIdx !== -1 && parts[joinIdx + 1]) {
                slug = parts[joinIdx + 1]
              } else if (parts.length > 0) {
                // Prendre le dernier segment
                slug = parts[parts.length - 1]
              }
            } catch {
              // Pas une URL — utiliser tel quel (code brut)
            }
            // Nettoyer et mettre en majuscules
            slug = slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
            if (slug.length >= 4) {
              onScan(slug)
            }
          },
          () => {} // erreur de scan silencieuse
        )
        setStarted(true)
      } catch (e: any) {
        setError('Impossible d\'accéder à la caméra. Vérifie les permissions.')
      }
    }

    start()

    return () => {
      if (scannerRef.current && started) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dls-card p-5 w-full max-w-sm flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera size={16} style={{ color: '#4D8EFF' }} />
            <p className="font-semibold text-white text-sm">Scanner un QR Code</p>
          </div>
          <button onClick={onClose} className="dls-btn dls-btn-ghost dls-btn-sm">
            <X size={16} />
          </button>
        </div>

        {/* Zone caméra */}
        {error ? (
          <div className="rounded-xl p-6 text-center"
            style={{ background: 'rgba(168,11,28,0.1)', border: '1px solid rgba(168,11,28,0.3)' }}>
            <p className="text-sm" style={{ color: '#F87171' }}>{error}</p>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden"
            style={{ background: '#000', minHeight: 280 }}>
            <div id={divId} style={{ width: '100%' }} />
            {/* Overlay viseur */}
            {!started && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="dls-spinner dls-spinner-lg" />
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-center" style={{ color: '#64748B' }}>
          Pointe la caméra vers le QR Code du tournoi
        </p>

        <button onClick={onClose} className="dls-btn dls-btn-secondary dls-btn-sm">
          Annuler
        </button>
      </div>
    </div>
  )
}
