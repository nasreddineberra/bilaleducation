import { createBrowserClient } from '@supabase/ssr'
import { sessionCookieDomain } from '@/lib/session-config'

export function createClient() {
  const domain = sessionCookieDomain()

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Cookies posés sur le DOMAINE et non sur l'hôte : sans cela, passer de la
    // console à une école déconnecterait. Voir `sessionCookieDomain`.
    domain ? { cookieOptions: { domain } } : undefined,
  )
}
