import { useEffect, useState } from 'react'

interface LottiePlayerProps {
  src: string          // chemin vers le fichier JSON
  loop?: boolean
  autoplay?: boolean
  style?: React.CSSProperties
  className?: string
  fallback?: React.ReactNode  // affiché si lottie-react non dispo ou fichier absent
}

/**
 * Wrapper Lottie avec fallback gracieux.
 * Si le fichier JSON n'existe pas encore, affiche le fallback sans erreur.
 */
export default function LottiePlayer({
  src,
  loop = true,
  autoplay = true,
  style,
  className,
  fallback = null,
}: LottiePlayerProps) {
  const [Lottie, setLottie] = useState<any>(null)
  const [animData, setAnimData] = useState<any>(null)
  const [error, setError] = useState(false)

  // Charger lottie-react dynamiquement
  useEffect(() => {
    import('lottie-react')
      .then(m => setLottie(() => m.default))
      .catch(() => setError(true))
  }, [])

  // Charger le fichier JSON
  useEffect(() => {
    if (!src) return
    fetch(src)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(setAnimData)
      .catch(() => setError(true))
  }, [src])

  if (error || !Lottie || !animData) {
    return <>{fallback}</>
  }

  return (
    <Lottie
      animationData={animData}
      loop={loop}
      autoplay={autoplay}
      style={style}
      className={className}
    />
  )
}
