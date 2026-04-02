/**
 * DLS Hub — Client API centralisé
 * Tous les appels backend passent par ici.
 * Le frontend ne doit JAMAIS appeler l'API FTGames directement.
 */
import axios from 'axios'
import type { AxiosInstance } from 'axios'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TournamentType = 'elimination' | 'groups' | 'championship'
export type EliminationType = 'single' | 'double'
export type ChampionshipLegs = 'single' | 'double'
export type TournamentStatus = 'draft' | 'registration' | 'draw' | 'in_progress' | 'finished'
export type PlayerStatus = 'pending' | 'accepted' | 'rejected'
export type MatchStatus = 'scheduled' | 'pending_validation' | 'validated' | 'manual'
export type MatchPhase =
  | 'group' | 'r16' | 'quarterfinal' | 'semifinal' | 'final'
  | 'championship' | 'double_first' | 'double_second'

export interface Tournament {
  id: string
  slug: string
  name: string
  logo_url?: string | null
  tournament_type: TournamentType
  elimination_type: EliminationType
  championship_legs: ChampionshipLegs
  max_teams: number
  group_count: number
  teams_per_group: number
  qualified_per_group: number
  elimination_round: string
  status: TournamentStatus
  creator_session: string
}

export interface Player {
  id: string
  pseudo: string
  dll_idx: string
  team_name: string
  team_logo_url?: string | null
  dll_division: number
  dll_played: number
  dll_won: number
  dll_lost: number
  status: PlayerStatus
  group_id?: string | null
  is_creator: boolean
  registered_at?: string | null
}

export interface PlayerInfo {
  team_name: string
  division: number
  played: number
  won: number
  lost: number
}

export interface MatchPlayer {
  id: string
  pseudo: string
  team_name: string
  team_logo_url?: string | null
  dll_division: number
  dll_idx: string
}

export interface Match {
  id: string
  phase: MatchPhase
  round_number: number
  group_id?: string | null
  status: MatchStatus
  home_score?: number | null
  away_score?: number | null
  home_score_agg?: number | null
  away_score_agg?: number | null
  is_manual: boolean
  motm?: string | null
  home_scorers: any[]
  away_scorers: any[]
  dll_match_timestamp?: string | null
  played_at?: string | null
  validated_at?: string | null
  home_player?: MatchPlayer | null
  away_player?: MatchPlayer | null
}

export interface TrackerSuggestion {
  timestamp: number
  heure: string
  home_score: number
  away_score: number
  home_scorers: any[]
  away_scorers: any[]
  motm: string
  minutes: number
  gcr: number
  opponent_team: string
  extra_time: boolean
  penalties: boolean
}

export interface StandingEntry {
  player_id: string
  pseudo: string
  team_name: string
  team_logo_url?: string | null
  dll_division: number
  played: number
  won: number
  draw: number
  lost: number
  gf: number
  ga: number
  diff: number
  pts: number
  form: ('W' | 'D' | 'L')[]
}

export interface ScorerEntry {
  name: string
  goals: number
  assists: number
}

export interface GroupData {
  group_id: string
  players: (StandingEntry & { qualified: boolean })[]
  matches: Match[]
}

// ─── Client ───────────────────────────────────────────────────────────────────

class ApiClient {
  private http: AxiosInstance

  constructor() {
    this.http = axios.create({
      baseURL: '/api',
      timeout: 15_000,
      withCredentials: true, // envoie les cookies (creator_session)
    })

    this.http.interceptors.response.use(
      (r) => r,
      (err) => {
        // Rediriger vers session expirée si 403 sur une route créateur
        if (err.response?.status === 403) {
          const path = window.location.pathname
          if (path.startsWith('/dashboard/')) {
            window.location.href = '/error/session'
          }
        }
        return Promise.reject(err)
      }
    )
  }

  // ── Session ──────────────────────────────────────────────────────────────
  async verifySession() {
    const r = await this.http.get('/session/verify')
    return r.data as {
      valid: boolean
      expires_at: string | null
      tournament_slug?: string
      tournament_name?: string
      reason?: string
    }
  }

  // ── Tournois ─────────────────────────────────────────────────────────────
  async getTournaments(): Promise<Tournament[]> {
    const r = await this.http.get('/tournaments/')
    return r.data
  }

  async getTournament(slug: string): Promise<Tournament> {
    const r = await this.http.get(`/tournaments/${slug}`)
    return r.data
  }

  async createTournament(form: FormData): Promise<Tournament> {
    const r = await this.http.post('/tournaments/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
  }

  async updateTournament(slug: string, form: FormData): Promise<Tournament> {
    const r = await this.http.patch(`/tournaments/${slug}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
  }

  async deleteTournament(slug: string, creatorSession: string): Promise<void> {
    await this.http.delete(`/tournaments/${slug}`, {
      params: { creator_session: creatorSession },
    })
  }

  async generateDraw(slug: string, creatorSession: string) {
    const r = await this.http.post(`/tournaments/${slug}/draw`, {
      creator_session: creatorSession,
    })
    return r.data as { draw: any; status: string; tournament_type: TournamentType }
  }

  async confirmDraw(slug: string, creatorSession: string, draw: any) {
    const r = await this.http.post(`/tournaments/${slug}/draw/confirm`, {
      creator_session: creatorSession,
      draw,
    })
    return r.data
  }

  async getBracket(slug: string) {
    const r = await this.http.get(`/tournaments/${slug}/bracket`)
    return r.data as { bracket: Record<string, Match[]>; matches: Match[] }
  }

  async getGroups(slug: string) {
    const r = await this.http.get(`/tournaments/${slug}/groups`)
    return r.data as { groups: GroupData[]; qualified_per_group: number }
  }

  // ── Joueurs ──────────────────────────────────────────────────────────────
  async verifyPlayer(dllIdx: string): Promise<PlayerInfo> {
    const r = await this.http.get(`/players/verify/${dllIdx}`)
    return r.data
  }

  async registerPlayer(slug: string, form: FormData) {
    const r = await this.http.post(`/players/register/${slug}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data as { session_token: string; player_id: string; status: string; team_name: string; division: number }
  }

  async registerCreator(slug: string, form: FormData) {
    const r = await this.http.post(`/players/register/${slug}/creator`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
  }

  async getTournamentPlayers(slug: string): Promise<Player[]> {
    const r = await this.http.get(`/players/tournament/${slug}`)
    return r.data
  }

  async getPlayer(playerId: string): Promise<Player & { tournament: any }> {
    const r = await this.http.get(`/players/${playerId}`)
    return r.data
  }

  async playerDecision(playerId: string, decision: 'accept' | 'reject', creatorSession: string) {
    const r = await this.http.post('/players/decision', {
      player_id: playerId,
      decision,
      creator_session: creatorSession,
    })
    return r.data
  }

  // ── Matchs ───────────────────────────────────────────────────────────────
  async getMatches(slug: string): Promise<Match[]> {
    const r = await this.http.get(`/matches/tournament/${slug}`)
    return r.data
  }

  async getTrackerSuggestions(matchId: string, creatorSession: string) {
    const r = await this.http.get(`/matches/${matchId}/tracker-suggest`, {
      params: { creator_session: creatorSession },
    })
    return r.data as {
      match_id: string
      home_player: MatchPlayer
      away_player: MatchPlayer
      suggestions: TrackerSuggestion[]
      phase: MatchPhase
      round_number: number
    }
  }

  async validateMatch(payload: {
    match_id: string
    creator_session: string
    home_score: number
    away_score: number
    home_scorers?: any[]
    away_scorers?: any[]
    motm?: string
    is_manual: boolean
    minutes_played?: number | null
    dll_match_timestamp?: string | null
  }) {
    const r = await this.http.post('/matches/validate', payload)
    return r.data
  }

  async getStandings(slug: string): Promise<StandingEntry[]> {
    const r = await this.http.get(`/matches/standings/${slug}`)
    return r.data
  }

  async getScorers(slug: string): Promise<ScorerEntry[]> {
    const r = await this.http.get(`/matches/scorers/${slug}`)
    return r.data
  }
}

export const api = new ApiClient()
export default api
