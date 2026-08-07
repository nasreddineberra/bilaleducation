import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Building2, Users, GraduationCap, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { EnterButton, SupportBar } from './SupportControls'
import ClickableRow from './ClickableRow'

function formatDate(date: string | null | undefined) {
  if (!date) return null
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpired(date: string | null | undefined) {
  if (!date) return false
  return new Date(date) < new Date()
}

export default async function SuperAdminPage() {
  const supabase = createAdminClient()

  const { data: etablissements } = await supabase
    .from('etablissements')
    .select('id, slug, nom, is_active, subscription_expires_at')
    .order('nom', { ascending: true })

  const stats = await Promise.all(
    (etablissements ?? []).map(async (e) => {
      const [{ count: users }, { count: students }] = await Promise.all([
        // Le super-admin rattaché pour une intervention porte l'établissement
        // dans son profil : sans cette exclusion, le compteur d'utilisateurs de
        // l'école grimperait d'un le temps du dépannage.
        supabase.from('profiles').select('id', { count: 'exact', head: true })
          .eq('etablissement_id', e.id).neq('role', 'super_admin'),
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('etablissement_id', e.id),
      ])
      return { id: e.id, users: users ?? 0, students: students ?? 0 }
    })
  )

  const statsMap = Object.fromEntries(stats.map(s => [s.id, s]))

  // Intervention en cours : l'état réel, pas le profil mis en cache — c'est lui
  // qui décide de ce que l'on peut ouvrir.
  const { data: { user } } = await (await createClient()).auth.getUser()
  const { data: me } = user
    ? await supabase.from('profiles').select('etablissement_id').eq('id', user.id).single()
    : { data: null }
  const supportEcole = me?.etablissement_id
    ? (etablissements ?? []).find(e => e.id === me.etablissement_id) ?? null
    : null

  return (
    <div className="space-y-6 animate-fade-in">

      {supportEcole && <SupportBar ecole={supportEcole.nom} slug={supportEcole.slug} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800">Établissements</h1>
          <p className="text-warm-700 text-sm mt-1">
            {etablissements?.length ?? 0} établissement{(etablissements?.length ?? 0) > 1 ? 's' : ''} enregistré{(etablissements?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/superadmin/ecoles/new" className="btn btn-primary">
          Nouvel établissement
        </Link>
      </div>

      {!etablissements?.length ? (
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 text-warm-700 mx-auto mb-3" />
          <p className="text-warm-700 font-medium">Aucun établissement</p>
          <p className="text-warm-700 text-sm mt-1">Créez votre premier client avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-xs" aria-label="Établissements clients">
            <thead>
              <tr>
                <th scope="col" className="list-th text-left">Établissement</th>
                <th scope="col" className="list-th text-left">Statut</th>
                <th scope="col" className="list-th text-left">Abonnement</th>
                <th scope="col" className="list-th text-right">Utilisateurs</th>
                <th scope="col" className="list-th text-right">Élèves</th>
                <th scope="col" className="list-th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {etablissements.map(e => {
                const expired = isExpired(e.subscription_expires_at)
                const dateStr = formatDate(e.subscription_expires_at)
                const s       = statsMap[e.id]

                return (
                  <ClickableRow
                    key={e.id}
                    href={`/superadmin/ecoles/${e.id}`}
                    label={`Fiche de ${e.nom}`}
                  >
                    <td className="list-td">
                      <p className="list-name">{e.nom}</p>
                      <p className="text-xs text-warm-700 mt-0.5 font-mono">{e.slug}.bilaleducation.fr</p>
                    </td>
                    <td className="list-td">
                      {e.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3.5 h-3.5" /> Inactif
                        </span>
                      )}
                    </td>
                    <td className="list-td">
                      {dateStr ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${expired ? 'text-red-600 bg-red-50' : 'text-warm-700 bg-warm-100'}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {expired ? 'Expiré ' : ''}{dateStr}
                        </span>
                      ) : (
                        <span className="text-xs text-warm-700">Sans expiration</span>
                      )}
                    </td>
                    <td className="list-td text-right">
                      <span className="inline-flex items-center gap-1 text-warm-700">
                        <Users className="w-3.5 h-3.5" />{s?.users ?? '·'}
                      </span>
                    </td>
                    <td className="list-td text-right">
                      <span className="inline-flex items-center gap-1 text-warm-700">
                        <GraduationCap className="w-3.5 h-3.5" />{s?.students ?? '·'}
                      </span>
                    </td>
                    <td className="list-td" data-no-row-nav>
                      <div className="flex items-center justify-end">
                        <EnterButton
                          id={e.id}
                          slug={e.slug}
                          disabled={Boolean(supportEcole) && supportEcole?.id !== e.id}
                        />
                      </div>
                    </td>
                  </ClickableRow>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
