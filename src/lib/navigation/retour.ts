/**
 * D'OÙ VIENT-ON — et donc où retourner après enregistrement, avec quel état.
 *
 * ── LE DÉFAUT QUE CECI CORRIGE ─────────────────────────────────────────────
 *
 * La règle du projet est « retour à la liste après enregistrement ». Elle est
 * juste tant qu'on n'atteint une fiche que depuis sa liste. Ce n'est plus vrai :
 * l'audit « Affectations & effectifs » y mène aussi, et le geste attendu depuis
 * l'audit est précisément d'ouvrir la fiche pour rendre l'apprenant inactif.
 * On revenait alors sur la liste des apprenants — en perdant l'audit, c'est-à-dire
 * la seule chose qu'on était en train de traiter, et la liste des suivants.
 *
 * ── PUIS LE MÊME DÉFAUT, UN CRAN PLUS FIN (06/10) ──────────────────────────
 *
 * On revenait bien à la bonne liste, mais ENTIÈREMENT DÉFILTRÉE. Or le filtre,
 * la recherche et la page vivent déjà dans l'URL des trois listes concernées
 * (Apprenants, Parents, Enseignants) : il n'y avait rien à construire, seulement
 * à faire voyager trois clés jusqu'à la fiche et à les rendre au retour.
 *
 * Les listes qui filtrent CÔTÉ CLIENT (Utilisateurs, Classes, Notifications)
 * n'ont pas d'état dans l'URL et ne passent pas par ici : elles mémorisent le
 * leur avec `useFiltresMemorises`. Un `sessionStorage` serait pire ici — la page
 * se rendrait d'abord non filtrée, puis se redirigerait (un clignotement et deux
 * rendus serveur).
 *
 * ── UNE LISTE BLANCHE, PAS UNE URL DANS LE LIEN ────────────────────────────
 *
 * Un `?retour=/n-importe-quoi` serait une surface de redirection ouverte — le
 * projet garde déjà le `next=` de l'authentification pour cette raison (9 août).
 * Ici la question ne se pose même pas : le paramètre ne porte qu'un NOM
 * d'origine, et seules les destinations écrites ci-dessous existent. Un nom
 * inconnu retombe silencieusement sur la liste, ce qui est le comportement
 * d'avant — fail-open, comme la session.
 *
 * Même raison pour l'état de liste : on ne reconstruit que des CLÉS CONNUES,
 * jamais une chaîne de requête reçue telle quelle.
 *
 * ── AJOUTER UNE ORIGINE ────────────────────────────────────────────────────
 *
 * Une ligne dans `ORIGINES`, et `?from=<nom>` sur le lien qui mène à la fiche.
 * Rien d'autre : les fiches lisent déjà ce paramètre.
 */
const ORIGINES: Record<string, string> = {
  /** Liste des foyers, ou fiche d'un foyer → l'une de ses fiches apprenant. */
  parents: '/dashboard/parents',
  /** Audits de passage d'année → la fiche à corriger (lien « Corriger »). */
  audit:   '/dashboard/passage-annee',
}

/**
 * L'ÉTAT DE LISTE, SOUS UN PRÉFIXE RÉSERVÉ.
 *
 * On ne réemploie pas `q` / `filter` / `page` tels quels sur l'URL de la fiche :
 * elle porte déjà `tab` et `from`, et un `q` sur une fiche se lirait comme une
 * recherche DANS la fiche. Le préfixe `l` dit « ceci appartient à la liste ».
 */
const CLES: { readonly fiche: string; readonly liste: string }[] = [
  { fiche: 'lq', liste: 'q' },
  { fiche: 'lf', liste: 'filter' },
  { fiche: 'lp', liste: 'page' },
]

/** Ce qu'une URL de fiche peut porter, tel que Next le remonte. */
type ParamsRecus = Record<string, string | string[] | undefined>

function valeur(params: ParamsRecus | undefined, cle: string): string {
  const v = params?.[cle]
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

/**
 * CÔTÉ LISTE — le suffixe à poser sur le lien qui mène à une fiche.
 *
 * @param sp   les paramètres de l'URL de la LISTE (`useSearchParams()`)
 * @param from l'origine à déclarer, quand la destination de retour n'est pas la
 *             liste de rattachement de la fiche (ex. un enfant ouvert depuis la
 *             liste des foyers : `'parents'`)
 * @returns `''` si rien à transporter, sinon `'?lf=active&lq=ber'`
 */
export function suffixeFiche(sp: URLSearchParams | undefined, from?: string): string {
  const out = new URLSearchParams()
  if (from) out.set('from', from)
  for (const { fiche, liste } of CLES) {
    const v = sp?.get(liste)
    if (v) out.set(fiche, v)
  }
  const qs = out.toString()
  return qs ? `?${qs}` : ''
}

/**
 * CÔTÉ FICHE — où retourner, et dans quel état.
 *
 * L'état capturé est celui de l'écran qu'on a QUITTÉ, et `from` désigne ce même
 * écran : les deux sont donc toujours cohérents, et l'état s'appose à la
 * destination quelle qu'elle soit. L'audit, lui, ne transporte aucun état (ses
 * liens sont bâtis côté serveur sans ces clés) — rien ne s'y ajoute.
 *
 * @param from   la valeur brute de `?from=`, telle qu'elle arrive de l'URL
 * @param defaut la liste de rattachement de la fiche, employée par défaut
 * @param params les paramètres reçus par la fiche, d'où l'état est relu
 */
export function hrefRetour(
  from: string | undefined | null,
  defaut: string,
  params?: ParamsRecus,
): string {
  const base = from ? (ORIGINES[from] ?? defaut) : defaut

  const out = new URLSearchParams()
  for (const { fiche, liste } of CLES) {
    const v = valeur(params, fiche)
    if (v) out.set(liste, v)
  }
  const qs = out.toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * CÔTÉ FICHE — les clés d'état à REPASSER à un lien interne qui mène à une
 * autre fiche du même type (les frères et sœurs, sur la fiche apprenant).
 *
 * Sans cela, l'état serait perdu au premier saut latéral : on reviendrait sur la
 * liste défiltrée, soit le défaut d'origine un cran plus loin.
 */
export function suffixeLateral(sp: URLSearchParams | undefined): string {
  const out = new URLSearchParams()
  for (const cle of ['from', ...CLES.map(c => c.fiche)]) {
    const v = sp?.get(cle)
    if (v) out.set(cle, v)
  }
  const qs = out.toString()
  return qs ? `?${qs}` : ''
}
