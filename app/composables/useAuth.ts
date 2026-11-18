export interface AppUser {
  id: number
  email: string
  name: string | null
  pictureUrl: string | null
  role: 'USER' | 'ADMIN'
}

interface LoginResponse {
  token: string
  expiresAt: string
  user: AppUser
}

const STORAGE_KEY = 'ocean.admin.session'

function readSession(): LoginResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as LoginResponse
    return new Date(s.expiresAt).getTime() > Date.now() ? s : null
  } catch {
    return null
  }
}

/** Session shared across the app (client-only; ssr is off). */
export function useAuth() {
  const session = useState<LoginResponse | null>('session', () => readSession())
  const user = computed(() => session.value?.user ?? null)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  /** Exchange a Google ID token (from Google Identity Services) for an API token. */
  async function loginWithGoogle(idToken: string) {
    const { apiBase } = useRuntimeConfig().public
    const res = await $fetch<LoginResponse>('/api/auth/google', {
      baseURL: apiBase,
      method: 'POST',
      body: { idToken },
    })
    session.value = res
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(res))
    } catch {}
    return res.user
  }

  function logout() {
    session.value = null
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    ;(window as any).google?.accounts?.id?.disableAutoSelect?.()
  }

  return { session, user, isAdmin, loginWithGoogle, logout }
}

/** $fetch against the API with the bearer token; logs out on 401. */
export function useApi() {
  const { apiBase } = useRuntimeConfig().public
  const auth = useAuth()

  return <T>(path: string, opts: Parameters<typeof $fetch>[1] = {}) =>
    $fetch<T>(path, {
      ...opts,
      baseURL: apiBase,
      headers: {
        ...(opts.headers as Record<string, string> | undefined),
        ...(auth.session.value ? { Authorization: `Bearer ${auth.session.value.token}` } : {}),
      },
      onResponseError({ response }) {
        if (response.status === 401) {
          auth.logout()
          navigateTo('/')
        }
      },
    }) as Promise<T>
}

/** Turn an API-relative path (e.g. /api/files/x.jpg) into a full URL. */
export function apiUrl(path: string) {
  return path.startsWith('http') ? path : useRuntimeConfig().public.apiBase + path
}

/** Best-effort readable message from a $fetch error. */
export function errorMessage(e: unknown): string {
  const err = e as { data?: { message?: string; error?: string }; statusCode?: number; message?: string }
  return err?.data?.message || err?.data?.error || (err?.statusCode ? `Error ${err.statusCode}` : err?.message) || 'Something went wrong'
}
