import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './index.css'
import App from './App.tsx'

// Vercel Analytics — collecte les page views et visiteurs
// Actif uniquement en production (no-op en développement)
// Build: 2026-05-03
inject()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
