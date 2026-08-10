/**
 * RECONNAITRE LE DOMAINE DE LA CONSOLE DE L'EDITEUR.
 *
 * La console vit sur son PROPRE sous-domaine, `superadmin.` — et non sur un
 * chemin du domaine racine, qui disparaitrait le jour ou la racine devient une
 * vitrine hebergee ailleurs.
 *
 * Le nom du sous-domaine etait ecrit en toutes lettres dans `proxy.ts`, et il
 * fallait le reecrire ailleurs des qu'un autre fichier avait besoin de la meme
 * distinction. Il vit donc ici, une fois.
 *
 * Fonction PURE, sans acces a l'environnement : utilisable dans le middleware
 * (edge), dans une route serveur et dans un composant client.
 */
export const SOUS_DOMAINE_CONSOLE = 'superadmin'

/** L'hote designe-t-il la console ? (`superadmin.bilaleducation.fr`) */
export function estSousDomaineConsole(host: string): boolean {
  return host.split('.')[0] === SOUS_DOMAINE_CONSOLE
}

/**
 * Sommes-nous dans un parcours de la CONSOLE ?
 *
 * En production, l'hote suffit. En LOCAL il n'y a pas de sous-domaine : la
 * console est a `localhost:3000/superadmin`, or les ecrans d'authentification
 * forte sont sous `/auth/...` — le chemin ne dit donc rien. On se rabat sur
 * `next`, que le middleware pose systematiquement en envoyant vers la 2FA
 * depuis la console (`?next=/superadmin`), et qui porte precisement l'intention
 * cherchee : « ou retournera-t-on apres validation ».
 */
export function estContexteConsole(host: string, next?: string | null): boolean {
  if (estSousDomaineConsole(host)) return true
  return !!next && next.startsWith(`/${SOUS_DOMAINE_CONSOLE}`)
}
