import { createAdminClient } from '@/lib/supabase/admin'
import { requestOrigin } from '@/lib/tenant/request-origin'

/**
 * Envoie le lien « Définissez votre mot de passe » (gabarit Supabase Reset
 * Password) a une adresse.
 *
 * Source UNIQUE de cet envoi : la reinitialisation demandee depuis la fiche
 * utilisateur ET la creation d'un compte (enseignant, utilisateur), qui l'envoie
 * automatiquement pour que la personne choisisse elle-meme son mot de passe.
 *
 * Le lien ramene sur le SOUS-DOMAINE de l'ecole, jamais sur NEXT_PUBLIC_SITE_URL :
 * cette variable vaut le domaine racine (la vitrine), ou aucun etablissement
 * n'est resolu — le lien partait et menait nulle part.
 *
 * Rend `null` si l'envoi est parti, le message d'erreur sinon. Ne controle PAS
 * que l'adresse appartient a l'etablissement : c'est a l'appelant de le faire
 * (il vient de creer le compte, ou il a verifie le profil).
 */
export async function envoyerLienMotDePasse(email: string): Promise<string | null> {
  const admin = createAdminClient()
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${await requestOrigin()}/auth/confirm?next=/auth/reset-password`,
  })
  if (error) {
    console.error('[envoyerLienMotDePasse]', error)
    return error.message
  }
  return null
}
