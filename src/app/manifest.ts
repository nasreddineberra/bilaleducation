import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getCachedEtablissement } from '@/lib/cache/dashboard'

/**
 * Manifeste d'application.
 *
 * Sans lui, l'application ne peut pas être INSTALLÉE — or c'est le mode où elle
 * cesse de ressembler à un site : fenêtre propre, **aucune barre d'adresse**,
 * donc aucun chemin visible. C'est la seule façon d'obtenir ce résultat, un
 * navigateur devant toujours montrer l'adresse d'une page ouverte en onglet.
 *
 * ┌─ DEUX TITRES, A NE PAS CONFONDRE ───────────────────────────────────────┐
 * │ · `name` / `short_name` — le nom de L'APPLICATION : invite              │
 * │   d'installation, menu Démarrer, liste des applications, libellé sous    │
 * │   l'icône. C'est ce fichier qui les fixe.                               │
 * │ · Le titre de la FENÊTRE une fois lancée est le `<title>` de la page,   │
 * │   défini dans `layout.tsx`. Les deux doivent se ressembler, mais ils ne  │
 * │   viennent pas du même endroit.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * DYNAMIQUE PAR ÉCOLE. Le nom vient du SOUS-DOMAINE, via l'en-tête posé par le
 * middleware : chaque établissement installe une application à son nom. Sur la
 * console et le domaine racine, aucun établissement n'est résolu — le manifeste
 * retombe sur « Bilal Education » seul.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let nom: string | null = null
  try {
    const etabId = (await headers()).get('x-etablissement-id')
    if (etabId) {
      const etab = await getCachedEtablissement(etabId).catch(() => null)
      nom = etab?.nom ?? null
    }
  } catch {
    // Manifeste de repli : mieux vaut une application installable sans le nom de
    // l'école qu'une installation impossible.
  }

  return {
    name: nom ? `${nom} - Bilal Education` : 'Bilal Education',
    // Libellé sous l'icône, où la place manque : le nom de l'école seul. Les
    // systèmes tronquent au-delà d'une douzaine de caractères.
    short_name: nom ?? 'Bilal',
    description:
      'Plateforme de gestion administrative et pédagogique pour école arabe et islamique.',
    start_url: '/dashboard',
    display: 'standalone',
    // PAS d'`orientation` : la valeur `portrait` qui figurait ici n'a aucun sens
    // pour un outil de gestion, utilisé surtout sur un poste de bureau et sur
    // tablette en paysage. Sans contrainte, le système suit l'appareil.
    lang: 'fr',
    background_color: '#faf8f6',   // --surface-page (thème clair)
    theme_color: '#0c5b51',        // --brand-surface (thème clair)
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
