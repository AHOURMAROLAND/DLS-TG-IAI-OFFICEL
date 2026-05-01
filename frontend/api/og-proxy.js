/**
 * Vercel Serverless Function — Proxy OG pour les bots de prévisualisation
 *
 * Appelée par Vercel pour /join/:slug et /tournament/:slug.
 * Détecte si c'est un bot (WhatsApp, Telegram, Discord…) :
 *   - Bot → proxifie vers le backend FastAPI /og/* (HTML avec meta OG)
 *   - Humain → renvoie le SPA React (index.html via rewrite Vercel)
 */

const BACKEND_OG_URL = 'https://dls-hub-backend.onrender.com/og'
const FRONTEND_URL = 'https://dls-tg-iai-officel.vercel.app'

// Patterns User-Agent des bots de prévisualisation
const BOT_PATTERNS = [
  'whatsapp',
  'telegrambot',
  'discordbot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'slackbot',
  'applebot',
  'googlebot',
  'bingbot',
  'preview',
  'embed',
  'crawler',
  'spider',
  'iframely',
  'unfurl',
]

function isBot(userAgent = '') {
  const ua = userAgent.toLowerCase()
  return BOT_PATTERNS.some(p => ua.includes(p))
}

module.exports = async (req, res) => {
  const ua = req.headers['user-agent'] || ''

  // Récupérer le type et le slug depuis les query params (injectés par vercel.json)
  const { type, slug } = req.query
  const cleanSlug = (slug || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!cleanSlug) {
    res.status(400).send('Slug manquant')
    return
  }

  const ogPath = type === 'join' ? `/join/${cleanSlug}` : `/tournament/${cleanSlug}`
  const spaPath = type === 'join' ? `/join/${cleanSlug}` : `/tournament/${cleanSlug}`

  if (!isBot(ua)) {
    // Pas un bot — servir le SPA React
    // On lit index.html depuis le dossier dist (build Vite)
    // Vercel le sert automatiquement via le rewrite catch-all
    // On redirige simplement vers la même URL pour que le rewrite /(.*) prenne le relais
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')

    // Lire index.html depuis le build Vite
    try {
      const fs = require('fs')
      const path = require('path')
      // En production Vercel, le build est dans /var/task ou le dossier dist
      const indexPath = path.join(process.cwd(), 'dist', 'index.html')
      const html = fs.readFileSync(indexPath, 'utf-8')
      res.status(200).send(html)
    } catch {
      // Fallback : redirection vers la même URL (Vercel servira index.html)
      res.setHeader('Location', spaPath)
      res.status(302).end()
    }
    return
  }

  // C'est un bot — proxifier vers le backend OG FastAPI
  try {
    const ogUrl = `${BACKEND_OG_URL}${ogPath}`
    const response = await fetch(ogUrl, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout (cold start Render)
    })

    const html = await response.text()
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    res.status(200).send(html)
  } catch (err) {
    // Backend indisponible — page OG de fallback avec les infos minimales
    const fallbackHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>DLS Hub — Tournois Dream League Soccer 26</title>
  <meta property="og:title" content="DLS Hub — Tournois Dream League Soccer 26" />
  <meta property="og:description" content="Créez et gérez vos tournois DLS 26 avec validation automatique des scores." />
  <meta property="og:image" content="${FRONTEND_URL}/pwa-512x512.png" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="DLS Hub" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="DLS Hub" />
  <meta name="twitter:image" content="${FRONTEND_URL}/pwa-512x512.png" />
  <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}${spaPath}" />
  <script>window.location.replace("${FRONTEND_URL}${spaPath}");</script>
</head>
<body></body>
</html>`
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.status(200).send(fallbackHtml)
  }
}
