import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../lib/api'

export function useTournaments() {
  const [tournaments, setTournaments] = useState<any[]>([])

  const { data, isLoading, error } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => apiClient.getTournaments(),
  })

  useEffect(() => {
    if (data) {
      setTournaments(data)
    }
  }, [data])

  return { tournaments, isLoading, error }
}
