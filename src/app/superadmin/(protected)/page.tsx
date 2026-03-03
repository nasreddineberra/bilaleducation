import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Building2, Plus, Users, GraduationCap, CheckCircle2, XCircle, Clock } from 'lucide-react'

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
    .select('id, slug, nom, is_active, subscription_expires_at, annee_courante')
    .order('nom', { ascending: true })

  const stats = await Promise.all(
    (etablissements ?? []).map(async (e) => {
      const [{ count: users }, { count: students }] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('etablissement_id', e.id),
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('etablissement_id', e.id),
      ])
      return { id: e.id, users: users ?? 0, students: students ?? 0 }
    })
  )

  const statsMap = Object.fromEntries(stats.map(s => [s.id, s]))

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800">Établissements</h1>
          <p className="text-warm-500 text-sm mt-1">
            {etablissements?.length ?? 0} établissement{(etablissements?.length ?? 0) > 1 ? 's' : ''} enregistré{(etablissements?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/superadmin/ecoles/new" className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvel établissement
        </Link>
      </div>

      {!etablissements?.length ? (
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 text-warm-300 mx-auto mb-3" />
          <p className="text-warm-500 font-medium">Aucun établissement</p>
          <p className="text-warm-400 text-sm mt-1">Créez votre premier client avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100 bg-warm-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wide">Établissement</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wide">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wide">Abonnement</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wide">Utilisateurs</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wide">Élèves</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {etablissements.map(e => {
                const expired = isExpired(e.subscription_expires_at)
                const dateStr = formatDate(e.subscription_expires_at)
                const s       = statsMap[e.id]

                return (
                  <tr key={e.id} className="hover:bg-warm-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-secondary-800">{e.nom}</p>
                      <p className="text-xs text-warm-400 mt-0.5 font-mono">{e.slug}.bilaleducation.fr</p>
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      {dateStr ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${expired ? 'text-red-600 bg-red-50' : 'text-warm-600 bg-warm-100'}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {expired ? 'Expiré ' : ''}{dateStr}
                        </span>
                      ) : (
                        <span className="text-xs text-warm-400">Sans expiration</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-warm-600">
                        <Users className="w-3.5 h-3.5" />{s?.users ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-warm-600">
                        <GraduationCap className="w-3.5 h-3.5" />{s?.students ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/superadmin/ecoles/${e.id}`} className="btn btn-secondary text-xs py-1.5 px-3">
                        Gérer
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
