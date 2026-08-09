import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Délais de session (en secondes) ──────────────────────────────────────────
import { INACTIVITY_SECONDS as INACTIVITY_TIMEOUT, MAX_SESSION_SECONDS as MAX_SESSION_DURATION, SESSION_COOKIE_MAX_AGE, sessionCookieDomain } from '@/lib/session-config'
const SESSION_COOKIE = 'app-session'
// Marqueur de session NAVIGATEUR : cookie sans maxAge/expires, supprimé par le
// navigateur à sa fermeture. Permet de distinguer « navigateur resté ouvert »
// (vraie inactivité → message) de « navigateur fermé puis rouvert » (démarrage à
// froid → login neutre, sans message). app-session, lui, est persistant (30 j).
const BROWSER_MARKER = 'app-open'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const host    = request.headers.get('host') ?? ''
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')

  // ─── 0. Hôte canonique : jamais de `www.` de tête ─────────────────────────
  //
  // Le certificat générique `*.bilaleducation.fr` couvre EXACTEMENT UN niveau,
  // donc `www.ecole.bilaleducation.fr` n'est couvert par rien : le navigateur
  // affiche « votre connexion n'est pas privée » et l'échec est INRATTRAPABLE
  // ici — il survient pendant la poignée de main TLS, avant qu'une requête
  // n'existe. Ce code ne s'exécute donc QUE pour qui a forcé le passage.
  //
  // Il vaut quand même la peine : la cible de la redirection, elle, dispose
  // d'un certificat valide. Celui qui a cliqué au travers de l'avertissement
  // atterrit dans une session propre, plutôt que de naviguer sur un hôte dont
  // aucun lien fabriqué ensuite ne serait fiable.
  //
  // La véritable défense est en amont, dans les constructeurs de liens : voir
  // `canonical-host`. Celle-ci est le filet.
  if (!isLocal && host.toLowerCase().startsWith('www.')) {
    const url = new URL(request.url)
    url.protocol = 'https:'
    url.host = host.slice(4)
    return NextResponse.redirect(url, 308)
  }

  // Tous les cookies de session portent le DOMAINE, pas l'hote : sans cela,
  // passer de la console a une ecole deconnecte. Voir `sessionCookieDomain`.
  //
  // Applique UNIFORMEMENT, pose comme suppression : un cookie efface sans le
  // domaine qui a servi a le poser n'est pas reconnu par le navigateur, qui le
  // garde. C'est ainsi qu'on se retrouve avec deux cookies de meme nom et une
  // session fantome impossible a purger.
  const cookieDomain = sessionCookieDomain()
  const withDomain = <T extends object>(o: T) => (cookieDomain ? { ...o, domain: cookieDomain } : o)

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
              response.cookies.set(name, value, withDomain(options))
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    return { user, response, supabase }
  }

  // ─── 1. Contexte Super-Admin ──────────────────────────────────────────────
  //
  // L'espace opérateur vit sur son PROPRE sous-domaine, `superadmin.`, et non
  // sur le domaine racine — que la vitrine commerciale occupera.
  //
  // Le sous-domaine plutôt qu'un chemin : le jour où la vitrine sera un site
  // distinct, hébergé ailleurs, la racine pointera autre part et
  // `bilaleducation.fr/superadmin` cesserait d'exister. Le sous-domaine survit
  // à ce changement, et le générique `*.bilaleducation.fr` le couvre déjà —
  // aucun DNS à créer.
  //
  // Le domaine racine est déduit de `NEXT_PUBLIC_SITE_URL`, déjà définie : on
  // évite d'ajouter une variable, et surtout de réécrire le domaine en dur ici
  // comme c'était le cas.
  const rootDomain = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '').hostname }
    catch { return 'bilaleducation.fr' }
  })()

  const isRootDomain = host === rootDomain || host === `www.${rootDomain}`

  // En LOCAL il n'y a pas de sous-domaine : on garde les deux échappatoires
  // historiques — `DEFAULT_TENANT_SLUG` vide, ou le chemin `/superadmin`.
  // En PRODUCTION, seul l'hôte compte : sans cela,
  // `ecole.bilaleducation.fr/superadmin` ouvrirait la console sur le domaine
  // d'un client, sans aucune raison.
  const isSuperAdminDomain = isLocal
    ? (!process.env.DEFAULT_TENANT_SLUG || pathname.startsWith('/superadmin'))
    : host.split('.')[0] === 'superadmin'

  if (isSuperAdminDomain) {
    const { user, response, supabase } = await getAuthUser()
    const isEditeur = user?.app_metadata?.role === 'super_admin'

    // /superadmin/login : accessible sans authentification
    if (pathname === '/superadmin/login') {
      // Renvoi RÉSERVÉ À L'ÉDITEUR. Renvoyer tout compte connecté fabriquait une
      // BOUCLE INFINIE : le layout protégé renvoie vers cette page qui n'est pas
      // super-admin, et cette règle le renvoyait aussitôt vers la console. Chacune
      // est juste, ensemble elles tournaient — et depuis que le cookie porte le
      // domaine entier, n'importe quel utilisateur d'école connecté qui tapait
      // l'adresse de la console voyait une erreur de navigateur.
      if (isEditeur) {
        return NextResponse.redirect(new URL('/superadmin', request.url))
      }
      return response
    }

    // Les écrans d'authentification forte doivent rester atteignables, sinon la
    // vérification ci-dessous n'aurait nulle part où envoyer.
    if (pathname.startsWith('/auth/')) {
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

    // Compte authentifié mais étranger à l'éditeur : on l'écarte SANS le
    // déconnecter — sa session vaut pour son école, et la lui retirer parce
    // qu'il a tapé une mauvaise adresse serait une punition sans rapport.
    if (!isEditeur) {
      return NextResponse.redirect(new URL('/superadmin/login?reason=reserve', request.url))
    }

    // ── 2FA : la console l'exigeait NULLE PART ────────────────────────────────
    //
    // Le contrôle existait mais restait hors d'atteinte, pour DEUX raisons
    // cumulées : cette branche rendait la main avant lui, et il est de toute
    // façon conditionné à `/dashboard`. La surface la plus privilégiée du
    // système — liste des clients, création de comptes, entrée dans n'importe
    // quelle école — n'était donc gardée que par un mot de passe.
    //
    // `next` ramène ici après validation : les deux écrans TOTP renvoient sinon
    // en dur vers `/dashboard`, qui n'a aucun sens sur ce domaine.
    const apres2FA = `?next=${encodeURIComponent(pathname)}`
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal) {
        if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
          return NextResponse.redirect(new URL(`/auth/totp-challenge${apres2FA}`, request.url))
        }
        if (aal.nextLevel === 'aal1' && aal.currentLevel === 'aal1') {
          const { data: factors } = await supabase.auth.mfa.listFactors()
          const aUnTotp = factors?.all?.some(f => f.factor_type === 'totp' && f.status === 'verified')
          if (!aUnTotp) {
            return NextResponse.redirect(new URL(`/auth/enroll-totp${apres2FA}`, request.url))
          }
        }
      }
    } catch (err) {
      console.error('[proxy] Erreur verification 2FA (console):', err)
      // En production, l'incertitude se tranche par le refus : c'est la console.
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.redirect(new URL(`/auth/totp-challenge${apres2FA}`, request.url))
      }
    }

    return response
  }

  // ─── 1 bis. Domaine racine : la vitrine ───────────────────────────────────
  //
  // La racine n'appartient à aucune école. Sans ce court-circuit, elle entrerait
  // dans la résolution ci-dessous, y chercherait une école nommée
  // « bilaleducation » et afficherait « accès suspendu ».
  //
  // RÉÉCRITURE et non redirection : l'adresse affichée reste `bilaleducation.fr`.
  if (!isLocal && isRootDomain) {
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/vitrine', request.url))
    }
    // Une seule entrée pour la console : qui tente `/superadmin` sur la racine
    // est renvoyé vers le sous-domaine. Deux portes pour la même pièce finissent
    // toujours par diverger. Le layout `(protected)` garde de toute façon
    // l'accès — il vérifie l'authentification ET le rôle — mais autant que
    // l'adresse soit sans ambiguïté.
    if (pathname.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL(`https://superadmin.${rootDomain}${pathname}`))
    }
    // Les autres chemins de la racine ne sont pas résolus en tenant : ils
    // servent ce que Next.js trouve (icône, manifeste…), sans contexte d'école.
    return NextResponse.next()
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
          next: { revalidate: 3600 }, // Cache 1 heure (données quasi-statiques)
        }
      )

      if (res.ok) {
        const tenants = await res.json()
        const tenant  = tenants[0]

        if (!tenant) {
          // SLUG INCONNU ≠ ABONNEMENT EXPIRÉ. La page annonçait « votre
          // abonnement est expiré » à qui s'était simplement trompé d'adresse :
          // un message faux, et inquiétant pour un client dont l'abonnement est
          // parfaitement à jour. Le motif distingue les deux cas.
          return NextResponse.redirect(new URL('/abonnement-expire?raison=inconnu', request.url))
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
      } else {
        // Erreur HTTP de Supabase (5xx, 4xx) → fail-secure en production
        console.error(`[proxy] Erreur HTTP résolution tenant: ${res.status} ${res.statusText}`)
        if (process.env.NODE_ENV === 'production') {
          return new NextResponse('Service temporairement indisponible', { status: 503 })
        }
      }
    } catch (err) {
      console.error('[proxy] Erreur lors de la résolution du tenant:', err)
      if (process.env.NODE_ENV === 'production') {
        return new NextResponse('Service temporairement indisponible', { status: 503 })
      }
    }
  }

  // ─── 2 bis. `/superadmin` n'existe pas sur le domaine d'une ecole ─────────
  //
  // La route est servie par l'application quel que soit le sous-domaine : sans
  // ce renvoi, un parent de l'ecole tombant sur `ecole.bilaleducation.fr/superadmin`
  // verrait l'ecran de connexion de l'EDITEUR. Ce n'est pas une faille — le
  // layout `(protected)` verifie l'authentification ET le role — mais le
  // domaine d'un client n'a pas a exposer la console de son fournisseur.
  //
  // Renvoi vers la connexion de l'ecole plutot que vers le sous-domaine
  // operateur : sur ce domaine, cette page n'existe tout simplement pas.
  if (pathname.startsWith('/superadmin')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ─── 3. Gestion de la session Auth (contexte école) ──────────────────────

  const { user, response, supabase } = await getAuthUser(requestHeaders)

  // Protéger /dashboard → redirection login si non authentifié
  if (!user && pathname.startsWith('/dashboard')) {
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    redirect.cookies.set(SESSION_COOKIE, '', withDomain({ maxAge: 0, path: '/' }))
    redirect.cookies.set(BROWSER_MARKER, '', withDomain({ maxAge: 0, path: '/' }))
    return redirect
  }

  // ── L'utilisateur appartient-il au tenant de l'URL ? ──────────────────────
  //
  // Le tenant vient du SOUS-DOMAINE, l'identité de la SESSION : rien ne
  // garantissait qu'ils désignent le même établissement. Un utilisateur de
  // l'école A ouvrant `ecoleB.…` recevait `x-etablissement-id` = B, et toute
  // écriture s'appuyant sur cet en-tête partait chez B.
  //
  // La comparaison est GRATUITE : `app_metadata.etablissement_id` voyage dans le
  // jeton, aucune requête n'est nécessaire. Les comptes créés avant cette
  // mesure ont été rattrapés ; un compte sans la donnée est laissé passer plutôt
  // que verrouillé — refuser l'accès sur une information absente ferait plus de
  // dégâts que le risque couvert. Il est signalé en journal.
  const tenantId = requestHeaders.get('x-etablissement-id')
  if (user && tenantId && pathname.startsWith('/dashboard')) {
    const userEtab = user.app_metadata?.etablissement_id as string | undefined
    const isSuperAdmin = user.app_metadata?.role === 'super_admin'

    if (isSuperAdmin) {
      // ACCES SUPPORT. Le super-admin est le seul compte qui traverse les ecoles :
      // il n'appartient a aucune, et son rattachement — l'interrupteur de
      // l'intervention — vit dans `profiles`, pas dans le jeton. La comparaison
      // ci-dessous n'a donc rien a comparer et le laisserait tomber dans la
      // branche « compte sans etablissement », qui journaliserait une alerte a
      // chaque page.
      //
      // C'est le layout du tableau de bord qui tranche : il lit le rattachement
      // REEL, ouvre l'intervention sur l'ecole du sous-domaine, ou renvoie a la
      // console si une autre est deja en cours. Le middleware ne peut pas le
      // faire — le jeton ne porte pas cette information et il ne lit pas la base.
    } else if (!userEtab) {
      console.warn(`[proxy] Compte sans etablissement_id dans le jeton : ${user.id}`)
    } else if (userEtab !== tenantId) {
      // Déconnexion franche : rester connecté sur le domaine d'une autre école
      // n'a aucun sens, et l'écran afficherait les données de A sous l'identité
      // visuelle de B.
      const redirect = NextResponse.redirect(new URL('/login?reason=etablissement', request.url))
      const supabaseForSignOut = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll() },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                redirect.cookies.set(name, value, withDomain(options))
              )
            },
          },
        }
      )
      await supabaseForSignOut.auth.signOut()
      redirect.cookies.set(SESSION_COOKIE, '', withDomain({ maxAge: 0, path: '/' }))
      redirect.cookies.set(BROWSER_MARKER, '', withDomain({ maxAge: 0, path: '/' }))
      return redirect
    }
  }

  // ── Gestion inactivité (1h) + durée max (24h) ──────────────────────────────
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
      } catch (err) {
        console.error('[proxy] Cookie de session corrompu, réinitialisation:', err)
      }
    }

    const inactive = now - lastActivity > INACTIVITY_TIMEOUT
    const expired = now - loginTime > MAX_SESSION_DURATION

    // FERMETURE DU NAVIGATEUR = FIN DE SESSION.
    //
    // `app-open` est pose SANS duree de vie : le navigateur l'efface en se
    // fermant. Sa disparition ALORS QUE `app-session` subsiste (donc qu'il y a
    // bien eu une session) ne peut vouloir dire qu'une chose : le navigateur a
    // ete ferme depuis la derniere activite.
    //
    // C'est le bon comportement pour un poste PARTAGE — l'ordinateur du
    // secretariat, qu'on ferme et devant lequel quelqu'un d'autre s'assoit.
    //
    // LIMITE : un navigateur regle sur « reprendre la ou vous vous etiez
    // arrete » restaure ses cookies de session ; la fermeture n'est alors pas
    // detectee. Reglage minoritaire, et l'inactivite reste le filet.
    const browserOpen = !!request.cookies.get(BROWSER_MARKER)?.value
    const navigateurFerme = !!sessionCookie && !browserOpen

    if (inactive || expired || navigateurFerme) {
      // Le message ne s'affiche que si le NAVIGATEUR est reste ouvert. Sur un
      // demarrage a froid, il a disparu → login neutre, sans message : se
      // reconnecter apres avoir ferme son navigateur n'a rien d'anormal, et
      // annoncer une « session expiree » inquieterait pour rien.
      const reason = browserOpen ? (inactive ? 'inactivity' : 'session') : null
      const loginUrl = reason ? `/login?reason=${reason}` : '/login'
      const redirect = NextResponse.redirect(new URL(loginUrl, request.url))

      // Déconnecter côté Supabase et propager la suppression des cookies auth
      const supabaseForSignOut = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll() },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                redirect.cookies.set(name, value, withDomain(options))
              )
            },
          },
        }
      )
      await supabaseForSignOut.auth.signOut()

      redirect.cookies.set(SESSION_COOKIE, '', withDomain({ maxAge: 0, path: '/' }))
      redirect.cookies.set(BROWSER_MARKER, '', withDomain({ maxAge: 0, path: '/' }))
      return redirect
    }

    // Session valide → mettre à jour la dernière activité.
    // maxAge long (≠ 24h) : le cookie doit survivre a une periode d'inactivite pour
    // pouvoir CONSTATER l'expiration au retour (sinon son absence = session neuve).
    const cookieValue = JSON.stringify({ loginTime, lastActivity: now })
    response.cookies.set(SESSION_COOKIE, cookieValue, withDomain({
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE,
    }))

    // Marqueur de session navigateur : SANS maxAge/expires → le navigateur le
    // supprime à sa fermeture. Sa présence atteste que le navigateur est resté ouvert.
    response.cookies.set(BROWSER_MARKER, '1', withDomain({
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    }))
  }

  // ── 2FA TOTP pour les rôles non-parent ────────────────────────────────────

  const rolesRequiring2FA = [
    'super_admin', 'admin', 'direction', 'comptable',
    'responsable_pedagogique', 'enseignant', 'secretaire',
  ]

  // Ne pas vérifier la 2FA si on va vers /login (permettre la déconnexion)
  if (user && pathname.startsWith('/dashboard')) {
    const role = user.app_metadata?.role ?? 'parent'

    if (rolesRequiring2FA.includes(role)) {
      try {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

        if (aalData) {
          const { currentLevel, nextLevel } = aalData

          // AAL2 requis mais pas encore atteint → challenge TOTP
          if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
            return NextResponse.redirect(new URL('/auth/totp-challenge', request.url))
          }

          // Aucun facteur TOTP configuré → enrollment
          if (nextLevel === 'aal1' && currentLevel === 'aal1') {
            const { data: factors } = await supabase.auth.mfa.listFactors()
            const hasTotp = factors?.all?.some(
              f => f.factor_type === 'totp' && f.status === 'verified'
            )
            if (!hasTotp) {
              return NextResponse.redirect(new URL('/auth/enroll-totp', request.url))
            }
          }
        }
      } catch (err) {
        console.error('[proxy] Erreur vérification 2FA:', err)
        // En cas d'erreur 2FA, on laisse passer en dev, on bloque en prod
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.redirect(new URL('/auth/totp-challenge', request.url))
        }
      }
    }
  }

  // Rediriger vers /dashboard (ou /superadmin pour super_admin) si déjà connecté
  // SAUF si on va vers /login ou /auth/* (permettre l'accès aux pages d'auth)
  const isAuthPath = pathname.startsWith('/auth/')
  if (user && !isAuthPath && pathname === '/login') {
    // Laisser l'utilisateur accéder à /login (pour changer de compte ou réessayer)
  } else if (user && !isAuthPath && pathname === '/') {
    // On est ici sur le domaine d'une ECOLE : la console a sa propre racine, et
    // `/superadmin` n'existe pas ici (section 2 bis le renvoie vers `/login`).
    // Y diriger le super-admin fabriquerait une boucle — c'est exactement le
    // couple de regles qui avait produit l'impasse de connexion.
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Purger le cookie de session applicatif sur /login : le logout par inactivité
  // (hard-nav côté client) ne peut pas effacer ce cookie httpOnly, qui garde alors
  // un `lastActivity` périmé. Sans ce nettoyage, la première reconnexion réussie est
  // aussitôt re-déconnectée par le contrôle d'inactivité (« double login »).
  if (pathname === '/login') {
    response.cookies.set(SESSION_COOKIE, '', withDomain({ maxAge: 0, path: '/' }))
    response.cookies.set(BROWSER_MARKER, '', withDomain({ maxAge: 0, path: '/' }))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
