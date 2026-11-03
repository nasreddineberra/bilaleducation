import AuthShell from '@/components/auth/AuthShell'
import ConfirmButton from '../confirm/ConfirmButton'
import { activerAcces } from './actions'
import { jetonBienForme } from '@/lib/espace-famille/jeton'

/**
 * « Activer mon acces » : atterrissage du lien d'invitation a l'espace famille.
 *
 * Comme `/auth/confirm`, la page ne verifie RIEN a l'ouverture : elle propose
 * un bouton (voir `actions.ts`).
 */
const MOTIFS: Record<string, { titre: string; texte: string }> = {
  invalide: {
    titre: 'Ce lien n’est plus valable',
    texte: 'Il a déjà servi ou il a expiré. Demandez à l’établissement de vous renvoyer une invitation.',
  },
  indisponible: {
    titre: 'Accès indisponible',
    texte: 'L’espace famille n’est pas disponible pour le moment. Contactez l’établissement.',
  },
  erreur: {
    titre: 'Activation impossible',
    texte: 'Une erreur est survenue. Réessayez dans quelques minutes, ou contactez l’établissement.',
  },
}

export default async function ActiverAccesPage({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string; motif?: string }>
}) {
  const { jeton, motif } = await searchParams
  const probleme = motif ? (MOTIFS[motif] ?? MOTIFS.invalide) : !jetonBienForme(jeton) ? MOTIFS.invalide : null

  return (
    <AuthShell>
      {probleme ? (
        <div role="alert" className="text-center space-y-4">
          <h2 className="text-xl font-bold text-secondary-800 dark:text-[#e7eef0]">{probleme.titre}</h2>
          <p className="text-sm text-warm-700 dark:text-[#93a2a8] leading-relaxed">{probleme.texte}</p>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-secondary-800 dark:text-[#e7eef0]">Votre espace famille</h2>
          <p className="text-sm text-warm-700 dark:text-[#93a2a8] leading-relaxed">
            Cliquez ci-dessous pour activer votre accès, puis choisissez votre mot de passe.
          </p>
          <form action={activerAcces} className="pt-2">
            <input type="hidden" name="jeton" value={jeton} />
            <ConfirmButton>Activer mon accès</ConfirmButton>
          </form>
        </div>
      )}
    </AuthShell>
  )
}
