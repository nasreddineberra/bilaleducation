'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { messageDoublon } from '@/lib/doublons'
import { logAudit } from '@/lib/audit'

/**
 * ENREGISTREMENT DES FOYERS COCHES.
 *
 * ┌─ UN FOYER A LA FOIS, ET C'EST VOULU ─────────────────────────────────────┐
 * │ `import_foyer()` est atomique POUR UN FOYER. On l'appelle en boucle       │
 * │ plutot que d'envelopper les 200 dans une seule transaction, parce qu'un   │
 * │ echec sur la famille n°137 ne doit pas annuler les 136 precedentes :      │
 * │ l'utilisateur corrigerait une ligne et devrait tout recommencer.          │
 * │                                                                           │
 * │ Chaque foyer est donc independant, et le compte rendu dit lesquels sont   │
 * │ passes. C'est le motif des communications, qui rendent `envoyes` /        │
 * │ `echoues` / `sans email` au lieu d'un faux succes global.                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

export interface FoyerAEnregistrer {
  /** Cle de regroupement, pour rendre le compte rendu au client. */
  cle: string
  /** Libelle affichable, pour le message d'erreur. */
  libelle: string
  /** `null` = foyer a creer. */
  foyerId: string | null
  /** Colonnes du foyer (creation) ou colonnes MODIFIEES seulement (mise a jour). */
  foyer: Record<string, string | null>
  /** Enfants a creer. Vide si le foyer n'est que mis a jour. */
  enfants: Record<string, string | null>[]
}

export interface ResultatFoyer {
  cle: string
  libelle: string
  ok: boolean
  message?: string
  foyerCree?: boolean
  enfantsCrees?: number
  numeros?: string[]
}

export async function enregistrerFoyers(
  lots: FoyerAEnregistrer[],
): Promise<{ error?: string; resultats?: ResultatFoyer[] }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  if (!Array.isArray(lots) || lots.length === 0) {
    return { error: 'Aucun foyer à enregistrer.' }
  }
  // Garde-fou de volume : un appel forge pourrait en envoyer des milliers.
  if (lots.length > 500) {
    return { error: 'Trop de foyers en une fois (500 au maximum).' }
  }

  // Client SESSION : la fonction est SECURITY INVOKER, donc c'est cette
  // identite qui traverse jusqu'au declencheur d'audit. Avec le client admin,
  // 200 apprenants seraient crees sans qu'aucun journal ne dise par qui.
  const supabase = await createClient()

  const resultats: ResultatFoyer[] = []

  for (const lot of lots) {
    const { data, error } = await supabase.rpc('import_foyer', {
      p_foyer: lot.foyer,
      p_enfants: lot.enfants,
      p_foyer_id: lot.foyerId,
    })

    if (error) {
      // Le refus de doublon porte deja son message, en francais et nommant le
      // foyer en conflit. Le remplacer par un texte generique priverait
      // l'utilisateur de la seule information qui lui permet d'agir.
      resultats.push({
        cle: lot.cle,
        libelle: lot.libelle,
        ok: false,
        message: messageDoublon(error) ?? error.message,
      })
      continue
    }

    const r = (data ?? {}) as { foyer_cree?: boolean; enfants_crees?: number; numeros?: string[] }
    resultats.push({
      cle: lot.cle,
      libelle: lot.libelle,
      ok: true,
      foyerCree: r.foyer_cree,
      enfantsCrees: r.enfants_crees ?? 0,
      numeros: r.numeros ?? [],
    })
  }

  // Une seule trace pour l'operation, pas une par foyer : le journal doit dire
  // « un import a eu lieu, voici son ampleur », les declencheurs de table
  // portant deja le detail ligne par ligne.
  const reussis = resultats.filter(r => r.ok)
  const enfants = reussis.reduce((n, r) => n + (r.enfantsCrees ?? 0), 0)
  const echoues = resultats.length - reussis.length

  // `INSERT` et non un verbe maison : l'action est bornee a trois valeurs, et
  // le journal les traduit deja pour l'affichage.
  await logAudit(supabase, {
    action: 'INSERT',
    entityType: 'parents',
    description:
      `Importation : ${reussis.length} foyer(s) et ${enfants} apprenant(s) enregistrés`
      + (echoues > 0 ? `, ${echoues} en échec` : ''),
  })

  return { resultats }
}
