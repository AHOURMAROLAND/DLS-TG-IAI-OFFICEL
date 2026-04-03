import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
    sourcemap: false,
    rollupOptions: {
      output: {
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
