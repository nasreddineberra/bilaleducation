import ResetPasswordClient from './ResetPasswordClient'

/**
 * `motif` est posé par `/auth/callback` quand le lien n'aboutit pas. Il dit
 * LEQUEL des trois échecs s'est produit — l'écran en tire un message qui indique
 * quoi faire, au lieu d'un « lien invalide ou expiré » qui ne se distingue pas
 * d'une panne et n'ouvre sur aucune action.
 *
 * `error` reste accepté : c'est l'ancien paramètre, qu'un lien encore en vol
 * pourrait porter.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string; error?: string }>
}) {
  const { motif, error } = await searchParams
  return <ResetPasswordClient motif={motif ?? (error ? 'sans-jeton' : null)} />
}
