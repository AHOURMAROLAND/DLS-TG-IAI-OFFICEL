import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { Tournament, Player, Match } from '../lib/api'

interface TournamentState {
  // Current tournament
  currentTournament: Tournament | null
  players: Player[]
  matches: Match[]
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Actions
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
      (set, get) => ({
        // Initial state
        currentTournament: null,
        players: [],
        matches: [],
        isLoading: false,
        error: null,

        // Actions
        setCurrentTournament: (tournament) =>
          set({ currentTournament: tournament }, false, 'setCurrentTournament'),

        setPlayers: (players) =>
          set({ players }, false, 'setPlayers'),

        setMatches: (matches) =>
          set({ matches }, false, 'setMatches'),

        addPlayer: (player) =>
          set(
            (state) => ({ players: [...state.players, player] }),
            false,
            'addPlayer'
          ),

        updatePlayer: (playerId, data) =>
          set(
            (state) => ({
              players: state.players.map((player) =>
                player.id === playerId ? { ...player, ...data } : player
              ),
            }),
            false,
            'updatePlayer'
          ),

        removePlayer: (playerId) =>
          set(
            (state) => ({
              players: state.players.filter((player) => player.id !== playerId),
            }),
            false,
            'removePlayer'
          ),

        updateMatch: (matchId, data) =>
          set(
            (state) => ({
              matches: state.matches.map((match) =>
                match.id === matchId ? { ...match, ...data } : match
              ),
            }),
            false,
            'updateMatch'
          ),

        setLoading: (loading) =>
          set({ isLoading: loading }, false, 'setLoading'),

        setError: (error) =>
          set({ error }, false, 'setError'),

        clearTournament: () =>
          set(
            { currentTournament: null, players: [], matches: [] },
            false,
            'clearTournament'
          ),
      }),
      {
        name: 'tournament-storage',
        partialize: (state) => ({
          currentTournament: state.currentTournament,
        }),
      }
    )
  )
)
