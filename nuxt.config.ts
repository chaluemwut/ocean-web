// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Admin panel: client-only SPA (token lives in the browser).
  ssr: false,

  css: ['~/assets/css/main.css'],

  // Allow access through Tailscale (https://<machine>.<tailnet>.ts.net via `tailscale serve`).
  vite: {
    server: {
      allowedHosts: ['.ts.net'],
    },
  },

  app: {
    head: {
      title: 'Ocean Admin',
      htmlAttrs: { lang: 'th' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Sarabun:wght@400;500;600&display=swap' },
      ],
      script: [{ src: 'https://accounts.google.com/gsi/client', async: true, defer: true }],
    },
  },

  // Override with NUXT_PUBLIC_API_BASE / NUXT_PUBLIC_GOOGLE_CLIENT_ID.
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8080',
      googleClientId: '814735826338-u3nac7n6vjmeb3kiu1rvu7bdeilhcojr.apps.googleusercontent.com',
    },
  },
})
