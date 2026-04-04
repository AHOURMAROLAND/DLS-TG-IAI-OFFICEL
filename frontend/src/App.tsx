import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import Header from './components/layout/Header'
import LottiePlayer from './components/ui/LottiePlayer'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

// ── Lazy loading — chaque page se charge à la demande ──────────────────────
const Home                  = lazy(() => import('./pages/Home'))
const TournamentsList       = lazy(() => import('./pages/TournamentsList'))
const Login                 = lazy(() => import('./pages/Login'))
const Register              = lazy(() => import('./pages/Register'))
const CreateTournament      = lazy(() => import('./pages/CreateTournament'))
const JoinTournament        = lazy(() => import('./pages/JoinTournament'))
const PlayerRegistration    = lazy(() => import('./pages/PlayerRegistration'))
const UploadLogo            = lazy(() => import('./pages/UploadLogo'))
const PendingValidation     = lazy(() => import('./pages/PendingValidation'))
const CreatorDashboard      = lazy(() => import('./pages/CreatorDashboard'))
const ManageRegistrations   = lazy(() => import('./pages/ManageRegistrations'))
const DrawGeneration        = lazy(() => import('./pages/DrawGeneration'))
const MatchValidation       = lazy(() => import('./pages/MatchValidation'))
const TournamentSettings    = lazy(() => import('./pages/TournamentSettings'))
const BracketView           = lazy(() => import('./pages/BracketView'))
const GroupPhase            = lazy(() => import('./pages/GroupPhase'))
const ChampionshipStandings = lazy(() => import('./pages/ChampionshipStandings'))
const StatisticsView        = lazy(() => import('./pages/StatisticsView'))
const MatchCalendar         = lazy(() => import('./pages/MatchCalendar'))
const PlayerProfile         = lazy(() => import('./pages/PlayerProfile'))
const TournamentFinished    = lazy(() => import('./pages/TournamentFinished'))
const SystemStates          = lazy(() => import('./pages/SystemStates'))
const TournamentDetail      = lazy(() => import('./pages/TournamentDetail'))

// ── Fallback de chargement ──────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <LottiePlayer
        src="/lottie/soccer-loading.json"
        style={{ width: 80, height: 80 }}
        fallback={<span className="dls-spinner dls-spinner-lg" />}
      />
      <p className="text-xs" style={{ color: '#64748B' }}>Chargement…</p>
    </div>
  )
}

// ── Bannière d'installation PWA ─────────────────────────────────────────────
function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<any>(null)
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const [dismissed, setDismissed] = useState(false)

  // Capturer l'événement beforeinstallprompt
  useEffect(() => {
    // Ne pas afficher si déjà installé
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: any) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Afficher toutes les 5 minutes pendant 10 secondes
  useEffect(() => {
    if (!prompt || dismissed) return

    const show = () => {
      setCountdown(10)
      setVisible(true)
    }

    show()
    const interval = setInterval(show, 5 * 60_000)
    return () => clearInterval(interval)
  }, [prompt, dismissed])

  // Compte à rebours
  useEffect(() => {
    if (!visible) return
    if (countdown <= 0) { setVisible(false); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [visible, countdown])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setPrompt(null)
      setDismissed(true)
    }
    setVisible(false)
  }

  const dismiss = () => {
    setVisible(false)
    setDismissed(true) // Ne plus afficher cette session
  }

  if (!visible || !prompt) return null

  return (
    <div
      className="animate-up"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#161830',
        border: '1px solid rgba(91,29,176,0.5)',
        borderRadius: '1rem',
        padding: '0.875rem 1.25rem',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(91,29,176,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        maxWidth: '380px',
        width: 'calc(100vw - 2rem)',
      }}>
      {/* Logo */}
      <img src="/pwa-192x192.png" alt="DLS Hub"
        style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />

      {/* Texte */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">Installer DLS Hub</p>
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          Accès rapide depuis votre écran d'accueil
        </p>
        {/* Barre de progression compte à rebours */}
        <div className="dls-progress-bar mt-1.5" style={{ height: 3 }}>
          <div className="dls-progress-fill" style={{
            width: `${(countdown / 10) * 100}%`,
            background: 'rgba(148,163,184,0.4)',
            transition: 'width 1s linear',
          }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button onClick={install}
          className="dls-btn dls-btn-primary dls-btn-sm">
          Installer
        </button>
        <button onClick={dismiss}
          className="dls-btn dls-btn-ghost dls-btn-sm text-center"
          style={{ color: '#64748B', fontSize: '0.7rem' }}>
          {countdown}s · Ignorer
        </button>
      </div>
    </div>
  )
}

// ── QueryClient ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <Router>
        <div className="min-h-screen" style={{ backgroundColor: '#07080F' }}>
          <Header />
          <main>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* GROUPE A */}
                <Route path="/"            element={<Home />} />
                <Route path="/tournaments" element={<TournamentsList />} />
                <Route path="/login"       element={<Login />} />
                <Route path="/register"    element={<Register />} />
                <Route path="/create"      element={<CreateTournament />} />
                <Route path="/join"       element={<JoinTournament />} />
                <Route path="/join/:slug" element={<JoinTournament />} />

                {/* GROUPE B */}
                <Route path="/register/:slug"         element={<PlayerRegistration />} />
                <Route path="/register/:slug/logo"    element={<UploadLogo />} />
                <Route path="/register/:slug/pending" element={<PendingValidation />} />

                {/* GROUPE C */}
                <Route path="/dashboard/:slug"                    element={<CreatorDashboard />} />
                <Route path="/dashboard/:slug/registrations"      element={<ManageRegistrations />} />
                <Route path="/dashboard/:slug/draw"               element={<DrawGeneration />} />
                <Route path="/dashboard/:slug/validate"           element={<MatchValidation />} />
                <Route path="/dashboard/:slug/validate/:matchId"  element={<MatchValidation />} />
                <Route path="/dashboard/:slug/settings"           element={<TournamentSettings />} />

                {/* GROUPE D */}
                <Route path="/tournament/:slug/bracket"           element={<BracketView />} />
                <Route path="/tournament/:slug/groups"            element={<GroupPhase />} />
                <Route path="/tournament/:slug/standings"         element={<ChampionshipStandings />} />
                <Route path="/tournament/:slug/stats"             element={<StatisticsView />} />
                <Route path="/tournament/:slug/calendar"          element={<MatchCalendar />} />
                <Route path="/tournament/:slug/player/:playerId"  element={<PlayerProfile />} />
                <Route path="/tournament/:slug"                   element={<TournamentDetail />} />

                {/* GROUPE E */}
                <Route path="/tournament/:slug/finished" element={<TournamentFinished />} />
                <Route path="/error/404"     element={<SystemStates type="404" />} />
                <Route path="/error/session" element={<SystemStates type="session" />} />
                <Route path="/loading"       element={<SystemStates type="loading" />} />

                <Route path="*" element={<Navigate to="/error/404" replace />} />
              </Routes>
            </Suspense>
          </main>

          <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 'auto' }}>
            <div className="dls-container py-5 flex flex-col md:flex-row justify-between items-center gap-3">
              <span style={{ color: '#64748B', fontSize: '0.8125rem' }}>
                © 2026 DLS Hub — Dream League Soccer 26
              </span>
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <a href="https://wa.me/22899809215" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{ color: '#4ADE80', fontSize: '0.75rem', textDecoration: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  +228 99 80 92 15
                </a>
                <a href="https://facebook.com/petittazo" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{ color: '#4D8EFF', fontSize: '0.75rem', textDecoration: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  petittazo
                </a>
                <a href="https://helpful-unicorn-dd021f.netlify.app/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{ color: '#A78BFA', fontSize: '0.75rem', textDecoration: 'none' }}>
                  🌐 Portfolio
                </a>
                <span style={{ color: '#334155', fontSize: '0.75rem' }}>
                  AHOUR MAROLAND — IAI-Togo
                </span>
              </div>
            </div>
          </footer>
        </div>

        {/* Bannière installation PWA */}
        <PWAInstallBanner />

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: 'dls-toast',
            style: {
              background: '#161830',
              color: '#ffffff',
              border: '1px solid rgba(91,29,176,0.25)',
              borderRadius: '0.75rem',
            },
            success: { duration: 3000, iconTheme: { primary: '#16A34A', secondary: '#fff' } },
            error:   { duration: 5000, iconTheme: { primary: '#A80B1C', secondary: '#fff' } },
          }}
        />
      </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}
