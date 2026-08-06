import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sessionCookieDomain } from '@/lib/session-config'

export async function createClient() {
  const cookieStore = await cookies()
  // Voir `sessionCookieDomain` : la session doit valoir pour tous les
  // sous-domaines, sinon le passage console → école déconnecte.
  const domain = sessionCookieDomain()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options, ...(domain ? { domain } : {}) })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // La suppression DOIT porter le même domaine que la pose, sinon le
            // navigateur ne reconnaît pas le cookie à effacer et le garde.
            cookieStore.set({ name, value: '', ...options, ...(domain ? { domain } : {}) })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
