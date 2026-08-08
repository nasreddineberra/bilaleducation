import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Atterrissage des liens d'authentification (réinitialisation de mot de passe).
 *
 * POURQUOI CETTE ROUTE DIT DÉSORMAIS CE QUI S'EST PASSÉ. Elle renvoyait
 * `?error=invalid` dans TOUS les cas d'échec — lien déjà consommé, jeton absent,
 * échange refusé — et l'écran affichait « lien invalide ou expiré ». Trois causes
 * très différentes, un seul message, aucune action possible pour l'utilisateur ;
 * et pour nous, aucun moyen de diagnostiquer autrement qu'en devinant.
 *
 * Le cas qui a motivé la correction : un lien cliqué QUELQUES SECONDES après
 * réception, annoncé « expiré ». Quelques secondes ne sont pas dix minutes — le
 * jeton avait été consommé avant le clic. Un lien Supabase ne sert qu'une fois,
 * et les analyseurs anti-spam ouvrent les liens pour les inspecter.
 */

/** Motifs distingués, repris par l'écran pour dire quoi faire. */
type Motif = 'consomme' | 'echange' | 'sans-jeton'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  // `next` vient de l'URL : on n'accepte qu'un chemin absolu simple. Sans cette
  // garde, `//ailleurs.example` serait un tremplin vers un autre site.
  const nextBrut = searchParams.get('next') ?? '/dashboard'
  const next = /^\/(?!\/)/.test(nextBrut) ? nextBrut : '/dashboard'

  const echec = (motif: Motif) =>
    NextResponse.redirect(`${origin}/auth/reset-password?motif=${motif}`)

  // ── 1. Erreur renvoyée par Supabase lui-même ─────────────────────────────
  // Elle arrive en clair dans l'URL : `error`, `error_code`, `error_description`.
  // C'est le cas d'un jeton déjà utilisé ou réellement périmé.
  const erreurSupabase = searchParams.get('error')
  if (erreurSupabase) {
    console.error('[auth/callback] refus de Supabase:', {
      error: erreurSupabase,
      code: searchParams.get('error_code'),
      description: searchParams.get('error_description'),
    })
    return echec('consomme')
  }

  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type')

  // ── 2. Aucun jeton ───────────────────────────────────────────────────────
  // Le lien a été tronqué, ou le jeton voyage dans le FRAGMENT (`#...`), que le
  // serveur ne reçoit jamais — le navigateur ne le transmet pas.
  if (!code && !tokenHash) {
    console.error('[auth/callback] ni code ni token_hash dans l\'URL:', request.url)
    return echec('sans-jeton')
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // ── 3. `token_hash` — le chemin PRINCIPAL ────────────────────────────────
  //
  // POURQUOI C'EST LUI QUI COMPTE. Le flux `code` (PKCE) exige un vérificateur
  // posé en cookie AU MOMENT DE LA DEMANDE. Il n'existe que si le lien a été
  // demandé depuis un navigateur — donc jamais pour les liens fabriqués côté
  // serveur : la console qui crée une école, ou la fiche utilisateur. Dans ces
  // cas Supabase retombe sur le flux implicite et renvoie la session dans le
  // FRAGMENT de l'URL, que le serveur ne voit pas. Résultat observé : « ni code
  // ni erreur », et un lien qui semble incomplet.
  //
  // `token_hash` ne dépend d'aucun cookie préalable : il vaut pour les trois
  // chemins de fabrication, y compris celui qui accueille le directeur d'une
  // nouvelle école — le seul dont l'échec se paierait sur un client payant.
  if (tokenHash) {
    // Liste blanche : `type` vient de l'URL et part vers l'API.
    const TYPES = ['recovery', 'email', 'invite', 'magiclink', 'email_change'] as const
    type TypeOtp = (typeof TYPES)[number]

    if (!TYPES.includes(type as TypeOtp)) {
      console.error('[auth/callback] type inattendu:', type)
      return echec('sans-jeton')
    }

    const { error } = await supabase.auth.verifyOtp({ type: type as TypeOtp, token_hash: tokenHash })
    if (error) {
      console.error('[auth/callback] vérification du jeton refusée:', error.message)
      return echec('consomme')
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  // ── 4. `code` — conservé pour le flux navigateur ─────────────────────────
  const { error } = await supabase.auth.exchangeCodeForSession(code!)

  if (error) {
    // Cause la plus fréquente : le lien est ouvert dans un AUTRE navigateur que
    // celui qui a demandé la réinitialisation. Le vérificateur PKCE est un
    // cookie posé au moment de la demande ; sans lui, l'échange est refusé.
    console.error('[auth/callback] échange du code refusé:', error.message)
    return echec('echange')
  }

  return NextResponse.redirect(`${origin}${next}`)
}
