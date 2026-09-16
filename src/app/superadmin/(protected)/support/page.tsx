import { createAdminClient } from '@/lib/supabase/admin'
import SupportRequestsConsoleClient, {
  type SupportRequestConsoleRow,
} from '@/components/superadmin/SupportRequestsConsoleClient'

/**
 * Demandes de support de toutes les écoles.
 *
 * CLIENT SERVICE-ROLE, et pas la session : l'éditeur n'appartient à aucun
 * établissement, la RLS de `support_requests` (bornée au tenant) ne lui
 * montrerait rien. La garde d'accès est celle du layout `(protected)`, sur la
 * colonne BRUTE du rôle — l'éditeur en intervention garde sa console.
 *
 * Bornée aux 500 dernières : l'écran répond à « qu'est-ce qui m'attend ? »,
 * pas à « qu'est-ce qui s'est passé depuis l'ouverture ». Aucune école n'en
 * produit assez pour que la borne se voie.
 */
export default async function ConsoleSupportPage() {
  const admin = createAdminClient()

  const { data: demandes } = await admin
    .from('support_requests')
    .select(`
      id, etablissement_id, category, impact, subject, message, attachment_path, context,
      email_status, email_error, author_name, author_email, author_role, created_at,
      etablissements ( nom )
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  type Brut = Omit<SupportRequestConsoleRow, 'ecole'> & {
    etablissements: { nom: string } | { nom: string }[] | null
  }

  const lignes: SupportRequestConsoleRow[] = ((demandes ?? []) as unknown as Brut[]).map(d => {
    // PostgREST rend la relation en objet ou en tableau selon la clé ; les deux
    // formes sont traitées, une école supprimée rend un nom vide plutôt qu'un
    // plantage.
    const rel = Array.isArray(d.etablissements) ? d.etablissements[0] : d.etablissements
    const { etablissements: _rel, ...reste } = d
    void _rel
    return { ...reste, ecole: rel?.nom ?? '' }
  })

  const nonRecues = lignes.filter(l => l.email_status !== 'sent').length

  return (
    <div className="space-y-4 animate-fade-in">

      <div>
        <h1 className="text-2xl font-bold text-secondary-800">Demandes de support</h1>
        <p className="text-warm-700 text-sm mt-1">
          {lignes.length === 0
            ? 'Aucune demande.'
            : `${lignes.length} demande${lignes.length > 1 ? 's' : ''}`
              + (nonRecues > 0
                  ? ` · ${nonRecues} non reçue${nonRecues > 1 ? 's' : ''} par email`
                  : '')}
        </p>
      </div>

      <SupportRequestsConsoleClient demandes={lignes} />

    </div>
  )
}
