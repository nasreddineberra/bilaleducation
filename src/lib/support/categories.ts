/**
 * Natures de demande de support, et impact d'un incident.
 *
 * SOURCE UNIQUE, partagée par trois consommateurs : le select de la modale, la
 * validation de la server action, et la contrainte CHECK de
 * `create-support-requests.sql`. Ajouter une nature demande donc une migration —
 * c'est voulu : une valeur que la base refuse échouerait à l'envoi, après que
 * l'utilisateur a tout rédigé.
 *
 * Module ORDINAIRE et non `'use server'` : un fichier de server actions ne peut
 * exporter que des fonctions asynchrones, une constante ou un type y provoquent
 * un 500. Piège déjà payé sur l'écran Utilisateurs.
 *
 * Les six natures sont choisies pour être DISTINCTES. Deux catégories qui se
 * recouvrent ne se partagent pas les demandes : elles finissent toutes les deux
 * dans « Autre », et la classification ne sert plus à rien.
 */

export const SUPPORT_CATEGORIES = [
  {
    value: 'assistance',
    label: "Assistance à l'utilisation",
    aide: "L'outil fonctionne, vous cherchez comment faire quelque chose.",
  },
  {
    value: 'incident',
    label: 'Incident ou anomalie',
    aide: "Quelque chose ne fonctionne pas comme prévu.",
  },
  {
    value: 'information',
    label: "Demande d'information",
    aide: 'Une question sur le fonctionnement ou les possibilités.',
  },
  {
    value: 'suggestion',
    label: "Suggestion d'amélioration",
    aide: 'Une idée, ou une gêne qui revient souvent.',
  },
  {
    value: 'facturation',
    label: 'Abonnement et facturation',
    aide: "Échéance, limite d'élèves, changement de formule.",
  },
  {
    value: 'autre',
    label: 'Autre',
    aide: 'Rien de ce qui précède ne convient.',
  },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]['value']

/**
 * Impact, demandé UNIQUEMENT sur un incident.
 *
 * C'est ce qui permet de trier une pile de demandes sans les ouvrir. Les trois
 * libellés décrivent une CONSÉQUENCE et non une urgence ressentie : « bloquant »
 * se vérifie, « urgent » ne se vérifie pas — et tout devient urgent.
 */
export const SUPPORT_IMPACTS = [
  { value: 'bloquant', label: 'Bloquant', aide: "L'école ne peut pas travailler." },
  { value: 'genant',   label: 'Gênant',   aide: 'Un contournement existe.' },
  { value: 'mineur',   label: 'Mineur',   aide: "Sans conséquence sur le travail." },
] as const

export type SupportImpact = (typeof SUPPORT_IMPACTS)[number]['value']

export const SUPPORT_SUBJECT_MAX = 150
export const SUPPORT_MESSAGE_MAX = 5000

/**
 * Pièce jointe : 1 Mo, images et PDF.
 *
 * Même plafond que les pièces jointes de communication — un seul chiffre à
 * retenir dans toute l'application, et il suffit largement à une capture
 * d'écran.
 *
 * TROIS GARDES pour une seule règle : le formulaire (confort), la server action
 * (une action est appelable directement), et `file_size_limit` sur le bucket,
 * qui est la seule à ne pouvoir être contournée. **Si ce chiffre change, la
 * migration `create-support-requests.sql` doit changer avec lui** — le SQL ne
 * peut pas importer cette constante.
 */
export const SUPPORT_ATTACHMENT_MAX_BYTES = 1024 * 1024

/** Libellé DÉRIVÉ de la limite : les deux ne peuvent pas se contredire.
 *  Il était écrit en toutes lettres à cinq endroits. */
export const SUPPORT_ATTACHMENT_MAX_LABEL =
  `${SUPPORT_ATTACHMENT_MAX_BYTES / (1024 * 1024)} Mo`

export const SUPPORT_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const

export const categoryLabel = (v: string) =>
  SUPPORT_CATEGORIES.find(c => c.value === v)?.label ?? v

export const impactLabel = (v: string | null) =>
  v ? (SUPPORT_IMPACTS.find(i => i.value === v)?.label ?? v) : null
