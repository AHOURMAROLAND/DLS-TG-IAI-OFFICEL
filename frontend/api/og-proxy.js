/**
 * Vercel Serverless Function — Proxy OG
 *
 * Appelée pour TOUTES les requêtes /join/:slug et /tournament/:slug.
 *
 * Stratégie simplifiée (plus fiable) :
 * - Toujours proxifier vers le backend FastAPI /og/*
 * - Le backend retourne une page HTML avec les meta OG + redirection JS
 * - Les bots (WhatsApp, Telegram…) lisent les meta OG et s'arrêtent là
 * - Les vrais navigateurs exécutent le JS et sont redirigés vers le SPA React
 *
 * Pas besoin de détecter le User-Agent ici — le backend gère tout.
 */

const BACKEND_OG_URL = 'https://dls-hub-backend.onrender.com/og'
const FRONTEND_URL = 'https://dls-tg-iai-officel.vercel.app'

module.exports = async (req, res) => {
  // Récupérer type et slug depuis les query params injectés par vercel.json
  const { type, slug } = req.query
  const cleanSlug = (slug || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!cleanSlug) {
    res.status(400).send('Slug manquant')
    return
  }

  const ogPath = type === 'join' ? `/join/${cleanSlug}` : `/tournament/${cleanSlug}`
  const spaUrl = `${FRONTEND_URL}${ogPath}`

  try {
    const ogUrl = `${BACKEND_OG_URL}${ogPath}`

    const response = await fetch(ogUrl, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': req.headers['user-agent'] || 'Vercel-OG-Proxy/1.0',
      },
      // 12s timeout — Render peut avoir un cold start
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }

    const html = await response.text()

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    // Cache 2 minutes — les infos tournoi changent (inscriptions, statut)
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300')
    res.status(200).send(html)

  } catch (err) {
    console.error(`OG proxy error for ${ogPath}:`, err.message)

    // Fallback si le backend est indisponible (cold start Render trop long)
    // On sert quand même une page OG minimale avec les infos de base
    const ua = (req.headers['user-agent'] || '').toLowerCase()
    const isBot = ['whatsapp', 'telegram', 'discord', 'twitter', 'facebook',
                   'linkedin', 'slack', 'bot', 'crawler', 'preview'].some(p => ua.includes(p))

    if (isBot) {
      // Bot sans backend disponible — OG générique
      const fallback = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>DLS Hub — Tournois Dream League Soccer 26</title>
  <meta property="og:title" content="DLS Hub — Rejoins le tournoi !"/>
  <meta property="og:description" content="Plateforme de gestion de tournois Dream League Soccer 26. Inscris-toi maintenant !"/>
  <meta property="og:image" content="${FRONTEND_URL}/pwa-512x512.png"/>
  <meta property="og:image:width" content="512"/>
  <meta property="og:image:height" content="512"/>
  <meta property="og:image:type" content="image/png"/>
  <meta property="og:url" content="${spaUrl}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="DLS Hub"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="DLS Hub — Rejoins le tournoi !"/>
  <meta name="twitter:description" content="Tournois Dream League Soccer 26"/>
  <meta name="twitter:image" content="${FRONTEND_URL}/pwa-512x512.png"/>
</head>
<body></body>
</html>`
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.status(200).send(fallback)
    } else {
      // Navigateur humain — rediriger vers le SPA
      res.setHeader('Location', spaUrl)
      res.status(302).end()
    }
  }
}
