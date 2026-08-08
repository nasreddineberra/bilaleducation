import { redirect } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'
import { confirmerLien } from './actions'
import ConfirmButton from './ConfirmButton'

/**
 * Page d'atterrissage des liens d'authentification.
 *
 * Elle ne vérifie RIEN à l'ouverture : elle propose un bouton. La raison est
 * détaillée dans `actions.ts` — les inspecteurs de liens des messageries
 * d'entreprise ouvrent les URL entrantes et consomment les jetons à usage
 * unique avant que le destinataire n'ait cliqué.
 *
 * Le coût est un clic de plus. Le bénéfice est que le lien fonctionne chez les
 * utilisateurs sur Microsoft 365 — c'est-à-dire une bonne part du personnel des
 * écoles.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>
}) {
  const { token_hash, type, next } = await searchParams

  // Lien tronqué ou mal formé : inutile d'afficher un bouton qui échouera.
  if (!token_hash || !type) {
    redirect('/auth/reset-password?motif=sans-jeton')
  }

  return (
    <AuthShell>
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold text-secondary-800 dark:text-[#e7eef0]">
          Confirmez votre demande
        </h2>
        {/* Pas d'explication sur le POURQUOI de cette étape : la mécanique des
            inspecteurs de liens n'apprend rien à l'utilisateur et l'inquiète
            plutôt. Voir `actions.ts` pour la raison technique. */}
        <p className="text-sm text-warm-700 dark:text-[#93a2a8] leading-relaxed">
          Cliquez ci-dessous pour définir votre mot de passe.
        </p>

        <form action={confirmerLien} className="pt-2">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next ?? '/auth/reset-password'} />
          <ConfirmButton>Définir mon mot de passe</ConfirmButton>
        </form>
      </div>
    </AuthShell>
  )
}
