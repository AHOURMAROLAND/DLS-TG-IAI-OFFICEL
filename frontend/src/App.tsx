import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

// Layout
import Header from './components/layout/Header'

// ── GROUPE A — Onboarding & Navigation ──
import Home from './pages/Home'                         // ① Accueil
import CreateTournament from './pages/CreateTournament' // ② Créer tournoi
import JoinTournament from './pages/JoinTournament'     // ③ Rejoindre

// ── GROUPE B — Inscription & Vérification ──
import PlayerRegistration from './pages/PlayerRegistration' // ④ Inscription
import UploadLogo from './pages/UploadLogo'                 // ⑤ Upload logo
import PendingValidation from './pages/PendingValidation'   // ⑥ Attente

// ── GROUPE C — Dashboard Créateur ──
import CreatorDashboard from './pages/CreatorDashboard'         // ⑦ Dashboard
import ManageRegistrations from './pages/ManageRegistrations'   // ⑧ Inscriptions
import DrawGeneration from './pages/DrawGeneration'             // ⑨ Tirage
import MatchValidation from './pages/MatchValidation'           // ⑩ Validation match
import TournamentSettings from './pages/TournamentSettings'     // ⑪ Paramètres

// ── GROUPE D — Vues Tournoi & Profil ──
import BracketView from './pages/BracketView'                   // ⑫ Bracket
import GroupPhase from './pages/GroupPhase'                     // ⑬ Poules
import ChampionshipStandings from './pages/ChampionshipStandings' // ⑭ Classement
import StatisticsView from './pages/StatisticsView'             // ⑮ Stats & buteurs
import MatchCalendar from './pages/MatchCalendar'               // ⑯ Calendrier
import PlayerProfile from './pages/PlayerProfile'               // ⑰ Profil joueur

// ── GROUPE E — État Final & Système ──
import TournamentFinished from './pages/TournamentFinished'     // ⑱ Tournoi terminé
import SystemStates from './pages/SystemStates'                 // ⑲ 404 / session / loading

import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen" style={{ backgroundColor: '#07080F' }}>
          <Header />

          <main>
            <Routes>
              {/* ── GROUPE A ── */}
              <Route path="/"       element={<Home />} />
              <Route path="/create" element={<CreateTournament />} />
              <Route path="/join"   element={<JoinTournament />} />
              <Route path="/join/:slug" element={<JoinTournament />} />

              {/* ── GROUPE B ── */}
              {/* ④ Inscription : /register/:slug */}
              <Route path="/register/:slug"        element={<PlayerRegistration />} />
              {/* ⑤ Upload logo : /register/:slug/logo (après inscription) */}
              <Route path="/register/:slug/logo"   element={<UploadLogo />} />
              {/* ⑥ Attente validation */}
              <Route path="/register/:slug/pending" element={<PendingValidation />} />

              {/* ── GROUPE C — Dashboard Créateur ── */}
              {/* ⑦ Dashboard principal */}
              <Route path="/dashboard/:slug"   element={<CreatorDashboard />} />
              {/* ⑧ Gestion inscriptions */}
              <Route path="/dashboard/:slug/registrations" element={<ManageRegistrations />} />
              {/* ⑨ Tirage au sort */}
              <Route path="/dashboard/:slug/draw"          element={<DrawGeneration />} />
              {/* ⑩ Validation match */}
              <Route path="/dashboard/:slug/validate"      element={<MatchValidation />} />
              <Route path="/dashboard/:slug/validate/:matchId" element={<MatchValidation />} />
              {/* ⑪ Paramètres */}
              <Route path="/dashboard/:slug/settings"      element={<TournamentSettings />} />

              {/* ── GROUPE D — Vues Tournoi & Profil ── */}
              {/* ⑫ Bracket élimination */}
              <Route path="/tournament/:slug/bracket"    element={<BracketView />} />
              {/* ⑬ Phase de poules */}
              <Route path="/tournament/:slug/groups"     element={<GroupPhase />} />
              {/* ⑭ Classement championnat */}
              <Route path="/tournament/:slug/standings"  element={<ChampionshipStandings />} />
              {/* ⑮ Statistiques & buteurs */}
              <Route path="/tournament/:slug/stats"      element={<StatisticsView />} />
              {/* ⑯ Calendrier des matchs */}
              <Route path="/tournament/:slug/calendar"   element={<MatchCalendar />} />
              {/* ⑰ Profil joueur */}
              <Route path="/tournament/:slug/player/:playerId" element={<PlayerProfile />} />

              {/* ── GROUPE E ── */}
              {/* ⑱ Tournoi terminé */}
              <Route path="/tournament/:slug/finished"   element={<TournamentFinished />} />
              {/* ⑲a Lien invalide */}
              <Route path="/error/404"     element={<SystemStates type="404" />} />
              {/* ⑲b Session expirée */}
              <Route path="/error/session" element={<SystemStates type="session" />} />
              {/* ⑲c Chargement WebSocket */}
              <Route path="/loading"       element={<SystemStates type="loading" />} />

              {/* Fallback → 404 */}
              <Route path="*" element={<Navigate to="/error/404" replace />} />
            </Routes>
          </main>

          <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 'auto' }}>
            <div className="dls-container py-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <span style={{ color: '#64748B', fontSize: '0.8125rem' }}>
                © 2026 DLS Hub — Plateforme de tournois Dream League Soccer 26
              </span>
              <span style={{ color: '#334155', fontSize: '0.75rem' }}>
                AHOUR MAROLAND — IAI-Togo
              </span>
            </div>
          </footer>
        </div>

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
            success: {
              duration: 3000,
              iconTheme: { primary: '#16A34A', secondary: '#fff' },
            },
            error: {
              duration: 5000,
              iconTheme: { primary: '#A80B1C', secondary: '#fff' },
            },
          }}
        />
      </Router>
    </QueryClientProvider>
  )
}
