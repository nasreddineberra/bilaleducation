import { redirect } from 'next/navigation'
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
    <div
      className="relative min-h-screen flex items-center justify-center px-4 pt-12 pb-24"
      style={{ background: 'linear-gradient(135deg, #507583 0%, #18aa99 100%)' }}
    >
      {/* Cercles décoratifs — mêmes que l'écran de définition du mot de passe,
          vers lequel cette page mène : le parcours doit se tenir. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-10 bg-white" />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full opacity-5 bg-amber-400" />
      </div>

      <div className="relative w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg mb-4">
            <span className="text-white font-bold text-3xl leading-none">B</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Bilal <span className="text-amber-400">Education</span>
          </h1>
          <p className="text-white/75 mt-1 text-sm">Gestion Administrative &amp; Pédagogique</p>
        </div>

        <div
          className="bg-white rounded-3xl p-8 animate-fade-in"
          style={{ boxShadow: '0 24px 64px rgba(17,28,33,0.22), 0 8px 24px rgba(17,28,33,0.12)' }}
        >
          <div className="text-center space-y-4">
            <h2 className="text-xl font-bold text-secondary-800">
              Confirmez votre demande
            </h2>
            <p className="text-sm text-warm-700 leading-relaxed">
              Cliquez ci-dessous pour définir votre mot de passe. Cette étape existe
              parce que certaines messageries ouvrent les liens reçus pour les
              inspecter&nbsp;: sans elle, le lien serait déjà utilisé avant que vous
              n&apos;y touchiez.
            </p>

            <form action={confirmerLien} className="pt-2">
              <input type="hidden" name="token_hash" value={token_hash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next ?? '/auth/reset-password'} />
              <ConfirmButton>Définir mon mot de passe</ConfirmButton>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
