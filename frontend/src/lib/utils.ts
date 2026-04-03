import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TournamentStatus, PlayerStatus, MatchStatus, MatchPhase } from './api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Dates ────────────────────────────────────────────────────────────────────

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function formatRelative(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'à l\'instant'
  if (mins < 60) return `il y a ${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `il y a ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `il y a ${days}j`
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Fichiers ─────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

// ─── Tournoi ──────────────────────────────────────────────────────────────────

export function tournamentStatusLabel(status: TournamentStatus): string {
  const map: Record<TournamentStatus, string> = {
    draft:       'Brouillon',
    registration:'Inscriptions ouvertes',
    draw:        'Tirage en cours',
    in_progress: 'En cours',
    finished:    'Terminé',
  }
  return map[status] ?? status
}

export function tournamentStatusClass(status: TournamentStatus): string {
  const map: Record<TournamentStatus, string> = {
    draft:       'dls-badge dls-badge-gray',
    registration:'dls-badge dls-badge-registration',
    draw:        'dls-badge dls-badge-draw',
    in_progress: 'dls-badge dls-badge-in-progress',
    finished:    'dls-badge dls-badge-finished',
  }
  return map[status] ?? 'dls-badge dls-badge-gray'
}

export function tournamentTypeLabel(type: string): string {
  const map: Record<string, string> = {
    elimination:  'Élimination directe',
    groups:       'Poules + Élimination',
    championship: 'Championnat',
  }
  return map[type] ?? type
}

// ─── Joueur ───────────────────────────────────────────────────────────────────

export function playerStatusLabel(status: PlayerStatus): string {
  const map: Record<PlayerStatus, string> = {
    pending:  'En attente',
    accepted: 'Accepté',
    rejected: 'Refusé',
  }
  return map[status] ?? status
}

export function playerStatusClass(status: PlayerStatus): string {
  const map: Record<PlayerStatus, string> = {
    pending:  'dls-badge dls-badge-blue',
    accepted: 'dls-badge dls-badge-green',
    rejected: 'dls-badge dls-badge-red',
  }
  return map[status] ?? 'dls-badge dls-badge-gray'
}

export function divisionLabel(div: number): string {
  // Mapping basé sur la structure réelle de l'API FTGames
  // Div=1 → Elite Division I, Div=2 → Elite Division II, etc.
  const map: Record<number, string> = {
    1: 'Élite Division I',
    2: 'Élite Division II',
    3: 'Élite Division III',
    4: 'Division I',
    5: 'Division II',
    6: 'Division III',
  }
  return map[div] ?? `Division ${div}`
}

export function divisionClass(div: number): string {
  const map: Record<number, string> = {
    1: 'dls-badge dls-div-elite1',
    2: 'dls-badge dls-div-elite2',
    3: 'dls-badge dls-div-elite3',
    4: 'dls-badge dls-div-1',
    5: 'dls-badge dls-div-2',
    6: 'dls-badge dls-div-3',
  }
  return map[div] ?? 'dls-badge dls-badge-gray'
}

// ─── Match ────────────────────────────────────────────────────────────────────

export function matchPhaseLabel(phase: MatchPhase): string {
  const map: Record<MatchPhase, string> = {
    group:         'Phase de poules',
    r16:           'Huitièmes de finale',
    quarterfinal:  'Quarts de finale',
    semifinal:     'Demi-finales',
    final:         'Finale',
    championship:  'Championnat',
    double_first:  'Élim. double — Match 1',
    double_second: 'Élim. double — Match 2',
  }
  return map[phase] ?? phase
}

export function matchStatusLabel(status: MatchStatus): string {
  const map: Record<MatchStatus, string> = {
    scheduled:          'À jouer',
    pending_validation: 'En attente',
    validated:          'Validé',
    manual:             'Manuel',
  }
  return map[status] ?? status
}

/** Retourne true si ce match accepte les prolongations (règle 90 min) */
export function matchAllowsExtraTime(phase: MatchPhase, roundNumber: number): boolean {
  return phase === 'double_second' || (phase === 'double_first' && roundNumber === 2)
}

// ─── Session ──────────────────────────────────────────────────────────────────

const SESSION_KEY = 'dls_creator_session'
const SESSION_SLUG_KEY = 'dls_creator_slug'

export function saveCreatorSession(token: string, slug: string) {
  localStorage.setItem(SESSION_KEY, token)
  localStorage.setItem(SESSION_SLUG_KEY, slug)
}

export function getCreatorSession(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function getCreatorSlug(): string | null {
  return localStorage.getItem(SESSION_SLUG_KEY)
}

export function clearCreatorSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_SLUG_KEY)
}

export function isCreatorOf(creatorSession: string): boolean {
  return getCreatorSession() === creatorSession
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}
