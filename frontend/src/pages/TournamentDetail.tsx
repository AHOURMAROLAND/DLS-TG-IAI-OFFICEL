// Redirige vers le dashboard créateur ou la vue bracket selon le contexte
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../hooks/useTournament'

export default function TournamentDetail() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { data: t } = useTournament(slug)
  const { user } = useAuth()

  useEffect(() => {
    if (!t) return
    if (user && t.creator_id === user.id) {
      navigate(`/dashboard/${slug}`, { replace: true })
    } else {
      navigate(`/tournament/${slug}/bracket`, { replace: true })
    }
  }, [t, slug, navigate, user])

  return null
}
