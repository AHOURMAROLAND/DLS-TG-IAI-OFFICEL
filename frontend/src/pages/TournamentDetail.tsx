// Redirige vers le dashboard créateur ou la vue bracket selon le contexte
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCreatorSession } from '../lib/utils'
import { useTournament } from '../hooks/useTournament'

export default function TournamentDetail() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: t } = useTournament(slug)
  const session = getCreatorSession()

  useEffect(() => {
    if (!t) return
    if (session === t.creator_session) {
      navigate(`/dashboard/${slug}`, { replace: true })
    } else {
      navigate(`/tournament/${slug}/bracket`, { replace: true })
    }
  }, [t, session, slug, navigate])

  return null
}
