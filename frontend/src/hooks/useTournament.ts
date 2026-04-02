import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export function useTournament(slug: string | undefined) {
  return useQuery({
    queryKey: ['tournament', slug],
    queryFn: () => api.getTournament(slug!),
    enabled: !!slug,
    staleTime: 30_000,
  })
}

export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: () => api.getTournaments(),
    staleTime: 30_000,
  })
}

export function usePlayers(slug: string | undefined) {
  return useQuery({
    queryKey: ['players', slug],
    queryFn: () => api.getTournamentPlayers(slug!),
    enabled: !!slug,
    staleTime: 15_000,
  })
}

export function useMatches(slug: string | undefined) {
  return useQuery({
    queryKey: ['matches', slug],
    queryFn: () => api.getMatches(slug!),
    enabled: !!slug,
    staleTime: 10_000,
  })
}

export function useStandings(slug: string | undefined) {
  return useQuery({
    queryKey: ['standings', slug],
    queryFn: () => api.getStandings(slug!),
    enabled: !!slug,
    staleTime: 15_000,
  })
}

export function useScorers(slug: string | undefined) {
  return useQuery({
    queryKey: ['scorers', slug],
    queryFn: () => api.getScorers(slug!),
    enabled: !!slug,
    staleTime: 15_000,
  })
}

export function useBracket(slug: string | undefined) {
  return useQuery({
    queryKey: ['bracket', slug],
    queryFn: () => api.getBracket(slug!),
    enabled: !!slug,
    staleTime: 10_000,
  })
}

export function useGroups(slug: string | undefined) {
  return useQuery({
    queryKey: ['groups', slug],
    queryFn: () => api.getGroups(slug!),
    enabled: !!slug,
    staleTime: 10_000,
  })
}
