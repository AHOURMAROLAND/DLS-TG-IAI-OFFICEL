// Redirige vers le dashboard créateur ou la vue bracket selon le contexte
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isCreatorOf } from '../lib/utils'
import { useTournament } from '../hooks/useTournament'

export default function TournamentDetail() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: t } = useTournament(slug)

  useEffect(() => {
    if (!t) return
    // isCreatorOf vérifie dans tous les tokens sauvegardés (pas seulement le dernier)
    if (isCreatorOf(t.creator_session)) {
      navigate(`/dashboard/${slug}`, { replace: true })
    } else {
      navigate(`/tournament/${slug}/bracket`, { replace: true })
    }
  }, [t, slug, navigate])

  return null
}
