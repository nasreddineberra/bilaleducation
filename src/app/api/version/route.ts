import { NextResponse } from 'next/server'

/**
 * L'identifiant du build ACTUELLEMENT DEPLOYE.
 *
 * Sert au seul composant `NouvelleVersion` : il compare cette valeur a celle
 * que SON bundle porte, inlinee a sa compilation. Un ecart signifie qu'un
 * deploiement a eu lieu depuis que l'onglet a ete charge — donc que le prochain
 * appel de server action echouera sur un identifiant que la nouvelle version ne
 * connait plus (defaut vecu le 06/10).
 *
 * ── AUCUNE GARDE, ET C'EST VOULU ───────────────────────────────────────────
 *
 * La reponse ne contient qu'un hachage de 12 caracteres, qui ne dit rien de
 * l'ecole ni de personne. Exiger une session serait pire : l'appel est fait
 * justement quand on soupconne que quelque chose ne va plus, et une
 * redirection vers l'ecran de connexion le ferait echouer en silence — le
 * defaut du 10 aout, ou un appel a `/api/public/etablissement` partait vers
 * l'ecran 2FA et retombait sur un `.catch()` muet.
 *
 * `force-dynamic` + `no-store` : une reponse mise en cache repondrait
 * eternellement l'ancienne valeur, et la banniere ne s'afficherait jamais.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? '' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
