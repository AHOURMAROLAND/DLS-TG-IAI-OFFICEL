/**
 * TournamentPreview — Squelette visuel live du format de tournoi.
 * Affiché en temps réel pendant la configuration dans CreateTournament.
 */
import type { GroupSuggestion } from '../../lib/api'

// Génère des noms d'équipes fictifs
const TEAM_NAMES = ['FC MARS','KELLIAN FC','DREAM FC','BLACKMAGIC','BHIM CLUB','MAN UNITED',
  'NEVER PLAY','EAGLES FC','TITANS FC','LIONS FC','WOLVES FC','STORM FC',
  'BLAZE FC','NOVA FC','APEX FC','VIPER FC','GHOST FC','BLADE FC',
  'FURY FC','SPARK FC','IRON FC','BOLT FC','RUSH FC','PEAK FC',
  'RISE FC','CORE FC','EDGE FC','FLUX FC','GRIT FC','HAZE FC',
  'JADE FC','KING FC','LAVA FC','MIST FC','NEON FC','ONYX FC',
  'PINE FC','QUAD FC','REEF FC','SAGE FC','TEAL FC','UNIT FC',
  'VALE FC','WAVE FC','XERO FC','YARD FC','ZEAL FC','ZERO FC']

function getTeams(n: number) {
  return TEAM_NAMES.slice(0, n)
}

// ─── Bracket élimination ──────────────────────────────────────────────────────

function BracketSlot({ label, isDouble }: { label: string; isDouble?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="dls-bracket-slot">{label}</div>
      {isDouble && <div className="dls-bracket-slot" style={{ color: '#A78BFA' }}>Match 2</div>}
    </div>
  )
}

function BracketRound({ title, slots, isDouble }: { title: string; slots: string[]; isDouble?: boolean }) {
  return (
    <div className="flex flex-col gap-2 flex-shrink-0">
      <p className="text-xs font-bold text-center mb-1" style={{ color: '#A78BFA' }}>{title}</p>
      {slots.map((s, i) => (
        <BracketSlot key={i} label={s} isDouble={isDouble} />
      ))}
    </div>
  )
}

function Connector() {
  return (
    <div className="flex items-center self-stretch flex-shrink-0" style={{ width: 16 }}>
      <div style={{ width: '100%', borderTop: '1px solid rgba(91,29,176,0.3)' }} />
    </div>
  )
}

function EliminationBracket({ teams, isDouble }: { teams: string[]; isDouble?: boolean }) {
  const n = teams.length
  const rounds: { title: string; slots: string[] }[] = []

  if (n >= 16) rounds.push({ title: 'R16', slots: Array.from({ length: 8 }, (_, i) => `${teams[i*2]} vs ${teams[i*2+1]}`) })
  if (n >= 8)  rounds.push({ title: 'QDF', slots: Array.from({ length: 4 }, (_, i) => n >= 16 ? `Vainqueur R16-${i+1}` : `${teams[i*2]} vs ${teams[i*2+1]}`) })
  if (n >= 4)  rounds.push({ title: 'Demi', slots: ['Vainqueur QDF-1', 'Vainqueur QDF-2'] })
  rounds.push({ title: 'Finale', slots: ['Finaliste 1 vs Finaliste 2'] })

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0 items-start min-w-max py-2">
        {rounds.map((r, i) => (
          <div key={r.title} className="flex items-center">
            <BracketRound title={r.title} slots={r.slots} isDouble={isDouble} />
            {i < rounds.length - 1 && <Connector />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tableau championnat ──────────────────────────────────────────────────────

function ChampionshipTable({ teams }: { teams: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
            {['Pos','Équipe','J','V','N','D','DB','Pts'].map(h => (
              <th key={h} style={{ padding: '6px 8px', color: '#64748B', textAlign: h === 'Équipe' ? 'left' : 'center', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => (
            <tr key={t} style={{ borderBottom: '1px solid rgba(91,29,176,0.1)' }}>
              <td style={{ padding: '5px 8px', color: '#64748B', textAlign: 'center' }}>{i+1}</td>
              <td style={{ padding: '5px 8px', color: '#fff', fontWeight: 500 }}>{t}</td>
              {['0','0','0','0','0','0'].map((v, j) => (
                <td key={j} style={{ padding: '5px 8px', color: '#334155', textAlign: 'center' }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Poules ───────────────────────────────────────────────────────────────────

function GroupCard({ name, teams, qualifiedCount }: { name: string; teams: string[]; qualifiedCount: number }) {
  return (
    <div className="dls-card overflow-hidden flex-shrink-0" style={{ minWidth: 160 }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(91,29,176,0.2)', background: 'rgba(91,29,176,0.08)' }}>
        <p className="text-xs font-bold" style={{ color: '#A78BFA' }}>Groupe {name}</p>
      </div>
      {teams.map((t, i) => (
        <div key={t}
          className={i < qualifiedCount ? 'dls-preview-team-qualified' : 'dls-preview-team-normal'}
          style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: '0.7rem', color: i < qualifiedCount ? '#4ADE80' : '#94A3B8', fontWeight: i < qualifiedCount ? 600 : 400 }}>
            {i < qualifiedCount ? '✅' : '  '} {t}
          </span>
          <span style={{ fontSize: '0.65rem', color: '#334155' }}>0 pts</span>
        </div>
      ))}
    </div>
  )
}

function GroupsPreview({ maxTeams, suggestion }: { maxTeams: number; suggestion: GroupSuggestion | null }) {
  if (!suggestion) return null
  const teams = getTeams(maxTeams)
  const { group_count, teams_per_group, qualified_per_group, next_power_of_2, best_thirds } = suggestion

  // Répartir les équipes dans les groupes
  const groups: string[][] = Array.from({ length: group_count }, (_, gi) =>
    teams.slice(gi * teams_per_group, (gi + 1) * teams_per_group)
  )

  // Équipes qualifiées pour la phase élim
  const qualifiedTeams: string[] = []
  groups.forEach((g, gi) => {
    const letter = String.fromCharCode(65 + gi)
    g.slice(0, qualified_per_group).forEach((_, pi) => {
      qualifiedTeams.push(`${letter}${pi + 1}`)
    })
  })
  if (best_thirds > 0) {
    for (let i = 0; i < best_thirds; i++) qualifiedTeams.push(`3ème-${i+1}`)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Poules */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: '#94A3B8' }}>Phase de poules</p>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {groups.map((g, gi) => (
            <GroupCard
              key={gi}
              name={String.fromCharCode(65 + gi)}
              teams={g}
              qualifiedCount={qualified_per_group}
            />
          ))}
        </div>
        {best_thirds > 0 && (
          <p className="text-xs mt-2" style={{ color: '#4D8EFF' }}>
            + {best_thirds} meilleur(s) 3ème(s) repêché(s) → {next_power_of_2} équipes en phase élim
          </p>
        )}
      </div>

      {/* Phase élim */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: '#94A3B8' }}>
          Phase éliminatoire ({next_power_of_2} équipes)
        </p>
        <EliminationBracket teams={qualifiedTeams} />
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface TournamentPreviewProps {
  tournamentType: 'elimination' | 'groups' | 'championship'
  maxTeams: number
  eliminationType?: 'single' | 'double'
  championshipLegs?: 'single' | 'double'
  groupSuggestion?: GroupSuggestion | null
}

export default function TournamentPreview({
  tournamentType,
  maxTeams,
  eliminationType = 'single',
  championshipLegs: _legs = 'single',
  groupSuggestion,
}: TournamentPreviewProps) {
  if (!maxTeams || maxTeams < 4) return null

  const teams = getTeams(Math.min(maxTeams, 48))

  return (
    <div className="dls-card p-4">
      <p className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: '#64748B' }}>
        <span>👁</span> Aperçu du format
      </p>

      {tournamentType === 'championship' && (
        <ChampionshipTable teams={teams} />
      )}

      {tournamentType === 'elimination' && (
        <EliminationBracket teams={teams} isDouble={eliminationType === 'double'} />
      )}

      {tournamentType === 'groups' && (
        <GroupsPreview maxTeams={maxTeams} suggestion={groupSuggestion ?? null} />
      )}
    </div>
  )
}
