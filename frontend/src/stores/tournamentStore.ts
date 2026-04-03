import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Tournament, Player, Match } from '../lib/api'

interface TournamentState {
  currentTournament: Tournament | null
  players: Player[]
  matches: Match[]
  isLoading: boolean
  error: string | null
  setCurrentTournament: (tournament: Tournament) => void
  setPlayers: (players: Player[]) => void
  setMatches: (matches: Match[]) => void
  addPlayer: (player: Player) => void
  updatePlayer: (playerId: string, data: Partial<Player>) => void
  removePlayer: (playerId: string) => void
  updateMatch: (matchId: string, data: Partial<Match>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearTournament: () => void
}

export const useTournamentStore = create<TournamentState>()(
  devtools(
    persist(
      (set) => ({
        currentTournament: null,
        players: [],
        matches: [],
        isLoading: false,
        error: null,
        setCurrentTournament: (tournament) => set({ currentTournament: tournament }, false, 'setCurrentTournament'),
        setPlayers: (players) => set({ players }, false, 'setPlayers'),
        setMatches: (matches) => set({ matches }, false, 'setMatches'),
        addPlayer: (player) => set((s) => ({ players: [...s.players, player] }), false, 'addPlayer'),
        updatePlayer: (playerId, data) => set((s) => ({ players: s.players.map((p) => p.id === playerId ? { ...p, ...data } : p) }), false, 'updatePlayer'),
        removePlayer: (playerId) => set((s) => ({ players: s.players.filter((p) => p.id !== playerId) }), false, 'removePlayer'),
        updateMatch: (matchId, data) => set((s) => ({ matches: s.matches.map((m) => m.id === matchId ? { ...m, ...data } : m) }), false, 'updateMatch'),
        setLoading: (loading) => set({ isLoading: loading }, false, 'setLoading'),
        setError: (error) => set({ error }, false, 'setError'),
        clearTournament: () => set({ currentTournament: null, players: [], matches: [] }, false, 'clearTournament'),
      }),
      {
        name: 'tournament-storage',
        partialize: (state) => ({ currentTournament: state.currentTournament }),
      }
    )
  )
)
