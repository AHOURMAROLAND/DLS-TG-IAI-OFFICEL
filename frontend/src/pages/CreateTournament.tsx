import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trophy, Upload, ChevronRight, ChevronLeft, Check, Globe, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import type { GroupSuggestion } from '../lib/api'
import TournamentPreview from '../components/ui/TournamentPreview'
import { useAuth } from '../contexts/AuthContext'

const schema = z.object({
  name: z.string().min(3, 'Minimum 3 caractères').max(100),
  tournament_type: z.enum(['elimination', 'groups', 'championship']),
  elimination_type: z.enum(['single', 'double']).optional(),
  championship_legs: z.enum(['single', 'double']).optional(),
  max_teams: z.coerce.number().min(4).max(48),
  group_count: z.coerce.number().min(2).max(16).optional(),
  teams_per_group: z.coerce.number().min(3).max(8).optional(),
  qualified_per_group: z.coerce.number().min(1).max(4).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
})
type Form = z.infer<typeof schema>

const STEPS = ['Infos', 'Format', 'Confirmation']
const ELIM_SIZES = [4, 8, 16, 32]
const CHAMP_SIZES = Array.from({ length: 9 }, (_, i) => (i + 2) * 2)
const GROUP_SIZES = [6, ...Array.from({ length: 21 }, (_, i) => (i + 4) * 2)]
const TYPE_LABELS: Record<string, string> = {
  elimination: 'Élimination directe',
  groups: 'Poules + Élimination',
  championship: 'Championnat',
}

export default function CreateTournament() {
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [step, setStep] = useState(0)
  const [logo, setLogo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [groupSuggestions, setGroupSuggestions] = useState<GroupSuggestion[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState<GroupSuggestion | null>(null)
  const [_loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Attendre que l'auth soit chargée avant de rediriger
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login')
  }, [authLoading, isAuthenticated, navigate])

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { name: '', tournament_type: 'elimination', elimination_type: 'single', championship_legs: 'single', max_teams: 8, visibility: 'public' },
  })

  const type = watch('tournament_type')
  const maxTeams = watch('max_teams')
  const values = watch()

  useEffect(() => {
    if (type !== 'groups' || !maxTeams || maxTeams < 8) { setGroupSuggestions([]); setSelectedSuggestion(null); return }
    setLoadingSuggestions(true)
    api.getGroupSuggestions(maxTeams)
      .then(res => {
        setGroupSuggestions(res.suggestions)
        if (res.suggestions.length > 0) {
          const best = res.suggestions[0]
          setSelectedSuggestion(best)
          setValue('group_count', best.group_count)
          setValue('teams_per_group', best.teams_per_group)
          setValue('qualified_per_group', best.qualified_per_group)
        }
      })
      .catch(() => setGroupSuggestions([]))
      .finally(() => setLoadingSuggestions(false))
  }, [type, maxTeams])

  useEffect(() => { setValue('max_teams', 8) }, [type])

  // Afficher un spinner pendant le chargement de l'auth
  if (authLoading) return (
    <div className="dls-page flex items-center justify-center">
      <span className="dls-spinner dls-spinner-lg" />
    </div>
  )
  if (!isAuthenticated) return null

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { toast.error('Max 5 MB'); return }
    setLogo(f)
    const r = new FileReader()
    r.onloadend = () => setPreview(r.result as string)
    r.readAsDataURL(f)
  }

  const applySuggestion = (s: GroupSuggestion) => {
    setSelectedSuggestion(s)
    setValue('group_count', s.group_count)
    setValue('teams_per_group', s.teams_per_group)
    setValue('qualified_per_group', s.qualified_per_group)
  }

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(data).forEach(([k, v]) => v !== undefined && fd.append(k, String(v)))
      if (logo) fd.append('logo', logo)
      const t = await api.createTournament(fd)
      toast.success('Tournoi créé !')
      navigate(`/dashboard/${t.slug}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de la création')
    } finally { setLoading(false) }
  }

  const validSizes = type === 'elimination' ? ELIM_SIZES : type === 'championship' ? CHAMP_SIZES : GROUP_SIZES

  // ── Validation par étape ────────────────────────────────────────────────
  const validateStep0 = (): string | null => {
    const name = values.name?.trim() ?? ''
    if (!name) return 'Le nom du tournoi est obligatoire'
    if (name.length < 3) return 'Le nom doit contenir au moins 3 caractères'
    if (!values.tournament_type) return 'Choisissez un mode de tournoi'
    return null
  }

  const validateStep1 = (): string | null => {
    if (!values.max_teams || values.max_teams < 4) return 'Choisissez un nombre d\'équipes'
    if (type === 'groups' && !selectedSuggestion) return 'Sélectionnez une configuration de poules'
    return null
  }

  const handleNextStep0 = () => {
    const err = validateStep0()
    if (err) { toast.error(err); return }
    setStep(1)
  }

  const handleNextStep1 = () => {
    const err = validateStep1()
    if (err) { toast.error(err); return }
    setStep(2)
  }

  return (
    <div className="dls-page max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`dls-step ${i === step ? 'dls-step-active' : i < step ? 'dls-step-done' : ''}`}>
              <div className="dls-step-dot">{i < step ? <Check size={12} /> : i + 1}</div>
              <span className="text-xs hidden sm:block" style={{ color: i === step ? '#fff' : '#64748B' }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`dls-step-line flex-1 ${i < step ? 'dls-step-line-done' : ''}`} />}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>

        {step === 0 && (
          <div className="dls-card p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <Trophy size={18} style={{ color: '#4D8EFF' }} />
              <h2 className="text-base font-bold text-white">Informations du tournoi</h2>
            </div>
            <div>
              <label className="dls-label">Logo (optionnel)</label>
              <label htmlFor="logo-upload" className="cursor-pointer block">
                <div className="border-2 border-dashed rounded-xl p-6 text-center" style={{ borderColor: 'rgba(91,29,176,0.35)', background: 'rgba(91,29,176,0.05)' }}>
                  {preview ? <img src={preview} alt="preview" className="w-16 h-16 rounded-lg object-cover mx-auto mb-2" /> : <Upload size={28} style={{ color: '#64748B', margin: '0 auto 8px' }} />}
                  <p className="text-xs" style={{ color: '#64748B' }}>{logo ? logo.name : 'JPG, PNG, WEBP — max 5 MB'}</p>
                </div>
              </label>
              <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </div>
            <div>
              <label className="dls-label">Nom du tournoi *</label>
              <input {...register('name')} className={`dls-input ${errors.name ? 'dls-input-error' : ''}`} placeholder="Ex: Tournoi de printemps 2026" />
              {errors.name
                ? <p className="text-xs mt-1" style={{ color: '#F87171' }}>{errors.name.message}</p>
                : <p className="text-xs mt-1" style={{ color: '#64748B' }}>Minimum 3 caractères — obligatoire</p>
              }
            </div>
            <div>
              <label className="dls-label">Mode de tournoi *</label>
              <div className="grid grid-cols-3 gap-2">
                {(['elimination', 'groups', 'championship'] as const).map(t => (
                  <label key={t} className="cursor-pointer">
                    <input type="radio" value={t} {...register('tournament_type')} className="sr-only" />
                    <div className="rounded-xl p-3 text-center text-xs font-semibold border transition-all" style={{ background: values.tournament_type === t ? 'rgba(17,85,204,0.2)' : 'rgba(255,255,255,0.03)', borderColor: values.tournament_type === t ? '#1155CC' : 'rgba(91,29,176,0.25)', color: values.tournament_type === t ? '#fff' : '#64748B' }}>
                      {TYPE_LABELS[t]}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="dls-label">Visibilité</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'public', label: 'Public', desc: 'Visible sur la page d\'accueil', icon: <Globe size={14} /> },
                  { value: 'private', label: 'Privé', desc: 'Accessible via lien uniquement', icon: <Lock size={14} /> },
                ] as const).map(opt => (
                  <label key={opt.value} className="cursor-pointer">
                    <input type="radio" value={opt.value} {...register('visibility')} className="sr-only" />
                    <div className="rounded-xl p-3 border transition-all" style={{
                      background: values.visibility === opt.value ? 'rgba(17,85,204,0.15)' : 'rgba(255,255,255,0.03)',
                      borderColor: values.visibility === opt.value ? '#1155CC' : 'rgba(91,29,176,0.25)',
                    }}>
                      <div className="flex items-center gap-1.5 mb-1" style={{ color: values.visibility === opt.value ? '#fff' : '#64748B' }}>
                        {opt.icon}
                        <span className="text-sm font-semibold">{opt.label}</span>
                      </div>
                      <p className="text-xs" style={{ color: '#64748B' }}>{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={handleNextStep0} className="dls-btn dls-btn-primary dls-btn-full flex items-center justify-center gap-2">
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="dls-card p-6 flex flex-col gap-5">
            <h2 className="text-base font-bold text-white">Format & équipes</h2>
            <div>
              <label className="dls-label flex items-center gap-1.5">
                Nombre d'équipes *
                {type === 'elimination' && <span className="text-xs" style={{ color: '#64748B' }}>(puissance de 2)</span>}
                {type === 'championship' && <span className="text-xs" style={{ color: '#64748B' }}>(pair, max 20)</span>}
                {type === 'groups' && <span className="text-xs" style={{ color: '#64748B' }}>(pair, 8–48)</span>}
              </label>
              <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
                {validSizes.map(n => (
                  <label key={n} className="cursor-pointer">
                    <input type="radio" value={n} {...register('max_teams')} className="sr-only" />
                    <div className="rounded-lg p-2.5 text-center text-sm font-bold border transition-all" style={{ background: Number(values.max_teams) === n ? 'rgba(17,85,204,0.2)' : 'rgba(255,255,255,0.03)', borderColor: Number(values.max_teams) === n ? '#1155CC' : 'rgba(91,29,176,0.25)', color: Number(values.max_teams) === n ? '#fff' : '#64748B' }}>
                      {n}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            {type === 'elimination' && (
              <div>
                <label className="dls-label">Type d'élimination</label>
                <select {...register('elimination_type')} className="dls-select">
                  <option value="single">Simple élimination</option>
                  <option value="double">Double élimination</option>
                </select>
              </div>
            )}
            {type === 'championship' && (
              <div>
                <label className="dls-label">Format championnat</label>
                <select {...register('championship_legs')} className="dls-select">
                  <option value="single">Aller simple</option>
                  <option value="double">Aller-retour</option>
                </select>
                {maxTeams && <p className="text-xs mt-1.5" style={{ color: '#64748B' }}>{Number(maxTeams) * (Number(maxTeams) - 1) / 2} matchs (aller simple) · {Number(maxTeams) * (Number(maxTeams) - 1)} matchs (aller-retour)</p>}
              </div>
            )}
            {type === 'groups' && (
              <div>
                <label className="dls-label">Configuration des poules</label>
                {_loadingSuggestions ? (
                  <div className="flex justify-center py-4"><span className="dls-spinner dls-spinner-sm" /></div>
                ) : groupSuggestions.length === 0 ? (
                  <p className="text-xs" style={{ color: '#F87171' }}>Aucune configuration valide</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {groupSuggestions.map((s, i) => (
                      <button key={i} type="button" onClick={() => applySuggestion(s)} className="rounded-xl p-3 text-left transition-all" style={{ background: selectedSuggestion === s ? 'rgba(17,85,204,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedSuggestion === s ? '#1155CC' : 'rgba(91,29,176,0.2)'}` }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-white">{s.group_count} poules × {s.teams_per_group} équipes</span>
                          {s.is_clean ? <span className="dls-badge dls-badge-green">Optimal</span> : <span className="dls-badge dls-badge-blue">+{s.best_thirds} repêchés</span>}
                        </div>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{s.qualified_per_group} qualifié(s)/poule → {s.next_power_of_2} en phase élim{s.best_thirds > 0 && ` (dont ${s.best_thirds} meilleur(s) 3ème(s))`}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {Number(maxTeams) >= 4 && (
              <TournamentPreview tournamentType={type} maxTeams={Number(maxTeams)} eliminationType={values.elimination_type} championshipLegs={values.championship_legs} groupSuggestion={selectedSuggestion} />
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(0)} className="dls-btn dls-btn-secondary flex items-center gap-1"><ChevronLeft size={16} /> Retour</button>
              <button type="button" onClick={handleNextStep1} className="dls-btn dls-btn-primary flex-1 flex items-center justify-center gap-2">Suivant <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="dls-card p-6 flex flex-col gap-5">
            <h2 className="text-base font-bold text-white">Récapitulatif</h2>
            <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(91,29,176,0.2)' }}>
              {preview && <img src={preview} alt="logo" className="w-14 h-14 rounded-lg object-cover" />}
              <Row label="Nom" value={values.name || '—'} />
              <Row label="Mode" value={TYPE_LABELS[values.tournament_type] || ''} />
              <Row label="Équipes" value={String(values.max_teams)} />
              <Row label="Visibilité" value={values.visibility === 'private' ? '🔒 Privé' : '🌐 Public'} />
              {type === 'elimination' && <Row label="Élimination" value={values.elimination_type === 'double' ? 'Double' : 'Simple'} />}
              {type === 'championship' && <>
                <Row label="Legs" value={values.championship_legs === 'double' ? 'Aller-retour' : 'Aller simple'} />
                <Row label="Matchs" value={String(values.championship_legs === 'double' ? Number(values.max_teams) * (Number(values.max_teams) - 1) : Number(values.max_teams) * (Number(values.max_teams) - 1) / 2)} />
              </>}
              {type === 'groups' && selectedSuggestion && <>
                <Row label="Poules" value={`${selectedSuggestion.group_count} × ${selectedSuggestion.teams_per_group} équipes`} />
                <Row label="Qualifiés/poule" value={String(selectedSuggestion.qualified_per_group)} />
                <Row label="Phase élim" value={`${selectedSuggestion.next_power_of_2} équipes`} />
                {selectedSuggestion.best_thirds > 0 && <Row label="Repêchage" value={`${selectedSuggestion.best_thirds} meilleur(s) 3ème(s)`} />}
              </>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="dls-btn dls-btn-secondary flex items-center gap-1">
                <ChevronLeft size={16} /> Retour
              </button>
              <button type="submit" disabled={loading} className="dls-btn dls-btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <span className="dls-spinner dls-spinner-sm" /> : <Check size={16} />}
                {loading ? 'Création...' : 'Créer le tournoi'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: '#64748B' }}>{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  )
}
