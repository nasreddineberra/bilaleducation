import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Délais de session (en secondes) ──────────────────────────────────────────
const INACTIVITY_TIMEOUT = 30 * 60       // 30 minutes d'inactivité
const MAX_SESSION_DURATION = 24 * 3600   // 24 heures max depuis la connexion
const SESSION_COOKIE = 'app-session'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const host    = request.headers.get('host') ?? ''
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')

  // ─── Helper : créer un client Supabase + récupérer l'user ─────────────────

  async function getAuthUser(reqHeaders?: Headers) {
    let response = NextResponse.next({
      request: { headers: reqHeaders ?? request.headers },
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            response = NextResponse.next({ request: { headers: reqHeaders ?? request.headers } })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    return { user, response }
  }

  // ─── 1. Contexte Super-Admin ──────────────────────────────────────────────
  // Local : DEFAULT_TENANT_SLUG vide → mode super-admin
  // Production : domaine racine (bilaleducation.fr, pas de sous-domaine école)

  const isSuperAdminDomain = isLocal
    ? !process.env.DEFAULT_TENANT_SLUG
    : (host === 'bilaleducation.fr' || host === 'www.bilaleducation.fr')

  const isSuperAdminPath = pathname.startsWith('/superadmin')

  if (isSuperAdminDomain || isSuperAdminPath) {
    const { user, response } = await getAuthUser()

    // /superadmin/login : accessible sans authentification
    if (pathname === '/superadmin/login') {
      if (user) {
        return NextResponse.redirect(new URL('/superadmin', request.url))
      }
      return response
    }

    // Racine → /superadmin
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/superadmin', request.url))
    }

    // Toutes les autres routes /superadmin/* → authentification requise
    if (!user) {
      return NextResponse.redirect(new URL('/superadmin/login', request.url))
    }

    return response
  }

  // ─── 2. Résolution du tenant (domaines école) ─────────────────────────────
  // En production : sous-domaine (ecole1.bilaleducation.fr → slug = "ecole1")
  // En développement local : variable d'env DEFAULT_TENANT_SLUG

  const slug = isLocal
    ? (process.env.DEFAULT_TENANT_SLUG ?? 'demo')
    : host.split('.')[0]

  // Headers enrichis transmis aux Server Components
  const requestHeaders = new Headers(request.headers)

  // La page /abonnement-expire ne nécessite pas de vérification tenant
  const skipTenantCheck =
    pathname.startsWith('/abonnement-expire') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')

  if (!skipTenantCheck) {
    try {
      // Appel direct à l'API REST Supabase avec la clé service_role
      // (fonctionne à l'Edge Runtime, bypasse RLS)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/etablissements` +
        `?slug=eq.${encodeURIComponent(slug)}&select=id,is_active,subscription_expires_at&limit=1`,
        {
          headers: {
            'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
          cache: 'no-store',
        }
      )

      if (res.ok) {
        const tenants = await res.json()
        const tenant  = tenants[0]

        if (!tenant) {
          // Slug inconnu → page suspension
          return NextResponse.redirect(new URL('/abonnement-expire', request.url))
        }

        // Injecter l'identifiant tenant dans les headers de la requête
        requestHeaders.set('x-etablissement-id',   tenant.id)
        requestHeaders.set('x-etablissement-slug', slug)

        // Vérifier l'abonnement uniquement pour le dashboard
        if (pathname.startsWith('/dashboard')) {
          const isExpired =
            tenant.subscription_expires_at &&
            new Date(tenant.subscription_expires_at) < new Date()

          if (!tenant.is_active || isExpired) {
            return NextResponse.redirect(new URL('/abonnement-expire', request.url))
          }
        }
      }
      // En cas d'erreur Supabase, on laisse passer (fail-open)
    } catch {
      // Erreur réseau → fail-open pour ne pas bloquer les utilisateurs légitimes
    }
  }

  // ─── 3. Gestion de la session Auth (contexte école) ──────────────────────

  const { user, response } = await getAuthUser(requestHeaders)

  // Protéger /dashboard → redirection login si non authentifié
  if (!user && pathname.startsWith('/dashboard')) {
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    redirect.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' })
    return redirect
  }

  // ── Gestion inactivité (30 min) + durée max (24h) ──────────────────────────
  if (user && pathname.startsWith('/dashboard')) {
    const now = Math.floor(Date.now() / 1000)
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value
    let loginTime = now
    let lastActivity = now

    if (sessionCookie) {
      try {
        const parsed = JSON.parse(sessionCookie)
        loginTime = parsed.loginTime ?? now
        lastActivity = parsed.lastActivity ?? now
      } catch {
        // Cookie corrompu → on réinitialise
      }
    }

    const inactive = now - lastActivity > INACTIVITY_TIMEOUT
    const expired = now - loginTime > MAX_SESSION_DURATION

    if (inactive || expired) {
      // Déconnecter côté Supabase
      const supabaseForSignOut = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll() },
            setAll() { /* no-op pour sign out */ },
          },
        }
      )
      await supabaseForSignOut.auth.signOut()

      const redirect = NextResponse.redirect(new URL('/login', request.url))
      redirect.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' })
      return redirect
    }

    // Session valide → mettre à jour la dernière activité
    const cookieValue = JSON.stringify({ loginTime, lastActivity: now })
    response.cookies.set(SESSION_COOKIE, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_SESSION_DURATION,
    })
  }

  // ── 2FA désactivée temporairement (à réactiver en fin de projet) ──────────
  // TODO: pour activer la 2FA obligatoire :
  //   1. Faire retourner `supabase` par getAuthUser() (en plus de user et response)
  //   2. Décommenter le bloc suivant :
  //
  // if (user && pathname.startsWith('/dashboard')) {
  //   const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  //   if (aalData) {
  //     const { currentLevel, nextLevel } = aalData
  //     if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
  //       return NextResponse.redirect(new URL('/auth/mfa-challenge', request.url))
  //     }
  //     if (nextLevel === 'aal1' && currentLevel === 'aal1') {
  //       const { data: factors } = await supabase.auth.mfa.listFactors()
  //       const hasVerifiedPhone = factors?.all?.some(
  //         f => f.factor_type === 'phone' && f.status === 'verified'
  //       )
  //       if (!hasVerifiedPhone) {
  //         return NextResponse.redirect(new URL('/auth/enroll-phone', request.url))
  //       }
  //     }
  //   }
  // }

  // Rediriger vers /dashboard (ou /superadmin pour super_admin) si déjà connecté
  if (user && (pathname === '/login' || pathname === '/')) {
    const isSuperAdmin = user.app_metadata?.role === 'super_admin'
    return NextResponse.redirect(new URL(isSuperAdmin ? '/superadmin' : '/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
