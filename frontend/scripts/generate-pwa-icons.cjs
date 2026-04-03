/**
 * Génère les icônes PWA depuis le banner DLS.
 * Usage : node scripts/generate-pwa-icons.js
 * Nécessite : npm install sharp (dans frontend/)
 */
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const INPUT = path.join(__dirname, '../../dls-26-banner-768x432.jpg')
const PUBLIC = path.join(__dirname, '../public')

async function generate() {
  if (!fs.existsSync(INPUT)) {
    console.error('Banner introuvable :', INPUT)
    process.exit(1)
  }

  // Créer un carré centré depuis le banner (crop centre)
  const img = sharp(INPUT)
  const meta = await img.metadata()
  const size = Math.min(meta.width, meta.height)
  const left = Math.floor((meta.width - size) / 2)
  const top = Math.floor((meta.height - size) / 2)

  const base = sharp(INPUT).extract({ left, top, width: size, height: size })

  // 192x192
  await base.clone().resize(192, 192).png().toFile(path.join(PUBLIC, 'pwa-192x192.png'))
  console.log('✅ pwa-192x192.png')

  // 512x512
  await base.clone().resize(512, 512).png().toFile(path.join(PUBLIC, 'pwa-512x512.png'))
  console.log('✅ pwa-512x512.png')

  // apple-touch-icon 180x180
  await base.clone().resize(180, 180).png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'))
  console.log('✅ apple-touch-icon.png')

  console.log('\nIcones PWA générées dans frontend/public/')
}

generate().catch(console.error)
