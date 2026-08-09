import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectiveRole, isSupportSession } from '@/lib/auth/effective-role'
import { PURGE_OPTIONS, type PurgeJours } from '@/lib/audit/purge-options'

/**
 * Gardes communes au COMPTAGE (GET) et à la SUPPRESSION (DELETE).
 *
 * Écrites une fois : un comptage plus permissif que la suppression donnerait à
 * qui n'a pas le droit de purger une vue du volume qu'il ne devrait pas avoir,
 * et l'inverse ferait échouer l'écran au dernier moment.
 */
async function garde(request: Request): Promise<
  | { erreur: NextResponse }
  | { etablissementId: string; jours: PurgeJours }
> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: NextResponse.json({ error: 'Non authentifie' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'direction'].includes(effectiveRole(profile) ?? '')) {
    return { erreur: NextResponse.json({ error: 'Acces refuse' }, { status: 403 }) }
  }

  // REFUS PENDANT UNE INTERVENTION DE SUPPORT.
  //
  // L'editeur y travaille avec le role effectif `admin`, donc avec ce droit.
  // Mais le journal est la preuve, pour l'ecole, de ce qu'il a fait chez elle :
  // pouvoir l'effacer viderait de sens les avertissements affiches a chaque
  // ouverture d'intervention — « vos actions seront inscrites au journal de
  // l'etablissement ». Une promesse de tracabilite ne vaut que si celui qu'elle
  // engage ne peut pas defaire la trace.
  //
  // Le controle porte sur le rattachement, pas sur le role effectif : c'est
  // l'interrupteur de l'intervention. Voir `isSupportSession`.
  if (isSupportSession(profile)) {
    return {
      erreur: NextResponse.json({
        error: "La purge appartient a l'etablissement. Elle n'est pas possible pendant une intervention de support.",
      }, { status: 403 }),
    }
  }

  // Delai de conservation, choisi par la direction. VALIDE CONTRE LA LISTE :
  // une valeur libre venue du navigateur pourrait faire disparaitre toute la
  // periode qu'on croit garder, et une suppression de journal ne se rattrape
  // pas. Repli sur le mois, l'ancien comportement.
  const { searchParams } = new URL(request.url)
  const brut = Number(searchParams.get('jours'))
  const jours: PurgeJours = PURGE_OPTIONS.some(o => o.jours === brut)
    ? (brut as PurgeJours)
    : 30

  return { etablissementId: profile.etablissement_id, jours }
}

/** Borne de date commune : `0` = tout purger, donc aucune borne. */
function bornerQuery(query: any, jours: PurgeJours) {
  if (jours > 0) {
    const limite = new Date()
    limite.setDate(limite.getDate() - jours)
    return query.lt('created_at', limite.toISOString())
  }
  return query
}

/**
 * COMBIEN d'entrées la purge supprimerait-elle ? Ne supprime rien.
 *
 * Une confirmation qui dit seulement « êtes-vous sûr ? » se clique sans être
 * lue. Annoncer le nombre exact transforme l'écran en information : effacer
 * 12 entrées et en effacer 12 000 n'appellent pas la même seconde de réflexion.
 */
export async function GET(request: Request) {
  try {
    const g = await garde(request)
    if ('erreur' in g) return g.erreur

    const admin = createAdminClient()
    const { count, error } = await bornerQuery(
      admin.from('audit_logs').select('id', { count: 'exact', head: true }).eq('etablissement_id', g.etablissementId),
      g.jours,
    )
    if (error) throw error

    return NextResponse.json({ count: count ?? 0 })
  } catch (err) {
    console.error('Comptage purge audit logs error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const g = await garde(request)
    if ('erreur' in g) return g.erreur

    const admin = createAdminClient()
    const { count, error } = await bornerQuery(
      admin.from('audit_logs').delete({ count: 'exact' }).eq('etablissement_id', g.etablissementId),
      g.jours,
    )
    if (error) throw error

    return NextResponse.json({ deleted: count ?? 0 })
  } catch (err) {
    console.error('Purge audit logs error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
