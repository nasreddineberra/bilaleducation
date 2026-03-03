import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase avec la clé service role.
 * À utiliser UNIQUEMENT côté serveur (Server Actions, Route Handlers).
 * Ne jamais exposer côté client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
