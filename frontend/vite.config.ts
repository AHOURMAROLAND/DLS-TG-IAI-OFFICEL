import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import javascriptObfuscator from 'vite-plugin-javascript-obfuscator'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inclure les assets statiques dans le precache
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'lottie/*.json'],
      // Manifest de l'application
      manifest: {
        name: 'DLS Hub',
        short_name: 'DLS Hub',
        description: 'Plateforme de gestion de tournois Dream League Soccer 26',
        theme_color: '#07080F',
        background_color: '#07080F',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        categories: ['sports', 'games'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple touch icon',
          },
        ],
        shortcuts: [
          {
            name: 'Créer un tournoi',
            short_name: 'Créer',
            description: 'Créer un nouveau tournoi DLS',
            url: '/create',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Rejoindre',
            short_name: 'Rejoindre',
            description: 'Rejoindre un tournoi existant',
            url: '/join',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      // Workbox — stratégies de cache
      workbox: {
        // Precache tous les assets du build
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json}'],
        // Exclure les fichiers trop volumineux du precache
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB max
        runtimeCaching: [
          // API backend — NetworkFirst (données fraîches prioritaires)
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Logos joueurs/tournois — CacheFirst (images statiques)
          {
            urlPattern: /^\/api\/players\/logo\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'logos-cache',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 jours
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Animations Lottie — CacheFirst
          {
            urlPattern: /\/lottie\/.*\.json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lottie-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 jours
              },
            },
          },
          // Google Fonts — StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        // Navigation fallback pour le SPA
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/ws/],
      },
      // Dev options — activer le SW en développement pour tester
      devOptions: {
        enabled: false, // Désactivé en dev pour éviter les conflits de cache
        type: 'module',
      },
    }),

    // ── Obfuscation JS — production uniquement ─────────────────────────────
    // Rend le code source illisible : renommage variables, encodage strings,
    // dead code injection, control flow flattening.
    // N'est PAS appliqué en dev (trop lent, inutile).
    ...(process.env.NODE_ENV === 'production'
      ? [
          javascriptObfuscator({
            // Appliquer uniquement aux chunks JS du build final
            include: ['**/dist/assets/*.js'],
            exclude: [
              // Exclure le service worker (doit rester lisible pour le navigateur)
              '**/sw.js',
              '**/workbox-*.js',
            ],
            options: {
              // ── Niveau de protection ──────────────────────────────────────
              // "high" : protection maximale mais build plus lent (~2x)
              // "medium" : bon compromis performance/protection
              optionsPreset: 'medium-obfuscation',

              // Renommer les identifiants (variables, fonctions, classes)
              identifierNamesGenerator: 'hexadecimal',

              // Encoder les strings littérales en tableaux chiffrés
              stringArray: true,
              stringArrayEncoding: ['base64'],
              stringArrayThreshold: 0.75,
              stringArrayRotate: true,
              stringArrayShuffle: true,
              stringArrayIndexShift: true,
              stringArrayWrappersCount: 2,
              stringArrayWrappersType: 'function',

              // Aplatir le flux de contrôle (if/else → switch obfusqué)
              controlFlowFlattening: true,
              controlFlowFlatteningThreshold: 0.4,

              // Injecter du code mort pour noyer le vrai code
              deadCodeInjection: true,
              deadCodeInjectionThreshold: 0.2,

              // Transformer les noms de propriétés
              transformObjectKeys: true,

              // Supprimer les commentaires
              disableConsoleOutput: false, // garder console.error pour le debug prod

              // Empêcher le débogage via DevTools
              debugProtection: true,
              debugProtectionInterval: 4000, // relance toutes les 4s

              // Bloquer l'évaluation dans des iframes non autorisées
              domainLock: [],

              // Seed fixe pour des builds reproductibles (CI/CD)
              seed: 0,

              // Compatibilité navigateurs modernes
              target: 'browser',
            },
          }),
        ]
      : []),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
      '/ws':  { target: 'ws://localhost:8000',  ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Jamais de sourcemaps en prod — expose le code source
    // Terser : minification avancée (plus agressive qu'esbuild)
    minify: 'terser',
    terserOptions: {
      compress: {
        // Supprimer tous les console.log/debug en production
        drop_console: true,
        drop_debugger: true,
        // Optimisations agressives
        passes: 3,
        pure_funcs: ['console.log', 'console.debug', 'console.info', 'console.warn'],
        // Supprimer le code mort
        dead_code: true,
        // Réduire les conditions constantes
        evaluate: true,
        // Inline les fonctions simples
        inline: 3,
      },
      mangle: {
        // Renommer les propriétés (attention : peut casser certaines libs)
        properties: false,
        // Renommer les variables top-level
        toplevel: true,
      },
      format: {
        // Supprimer tous les commentaires
        comments: false,
        // Pas de beautify
        beautify: false,
      },
    },
    rollupOptions: {
      output: {
        // Noms de fichiers avec hash pour cache-busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          vendor:  ['react', 'react-dom'],
          router:  ['react-router-dom'],
          ui:      ['lucide-react', 'clsx', 'tailwind-merge'],
          forms:   ['react-hook-form', '@hookform/resolvers', 'zod'],
          query:   ['@tanstack/react-query', 'axios', 'zustand'],
          lottie:  ['lottie-react'],
          qr:      ['qrcode.react'],
        },
      },
    },
  },
})
