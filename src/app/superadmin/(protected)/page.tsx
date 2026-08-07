import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Building2, Users, GraduationCap, Layers, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { EnterButton, SupportBar } from './SupportControls'
import ClickableRow from './ClickableRow'
import { INTERVENTION_MAX_HEURES } from '@/lib/support/intervention'

function formatDate(date: string | null | undefined) {
  if (!date) return null
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateHeure(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

/** Durée d'une intervention, en heures et minutes. */
function duree(debut: string, fin: string) {
  const minutes = Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 60000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

function isExpired(date: string | null | undefined) {
  if (!date) return false
  return new Date(date) < new Date()
}

export default async function SuperAdminPage() {
  const supabase = createAdminClient()

  const { data: etablissements } = await supabase
    .from('etablissements')
    .select('id, slug, nom, is_active, subscription_expires_at, logo_url')
    .order('nom', { ascending: true })

  const stats = await Promise.all(
    (etablissements ?? []).map(async (e) => {
      const [{ count: users }, { count: students }, { count: classes }] = await Promise.all([
        // Le super-admin rattaché pour une intervention porte l'établissement
        // dans son profil : sans cette exclusion, le compteur d'utilisateurs de
        // l'école grimperait d'un le temps du dépannage.
        supabase.from('profiles').select('id', { count: 'exact', head: true })
          .eq('etablissement_id', e.id).neq('role', 'super_admin'),
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('etablissement_id', e.id),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('etablissement_id', e.id),
      ])
      return { id: e.id, users: users ?? 0, students: students ?? 0, classes: classes ?? 0 }
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

  const { data: interventions } = await supabase
    .from('support_interventions')
    .select('id, etablissement_id, opened_at, closed_at, closed_reason')
    .order('opened_at', { ascending: false })
    .limit(10)

  const nomEcole = Object.fromEntries((etablissements ?? []).map(e => [e.id, e.nom]))

  // Depuis quand l'intervention en cours est-elle ouverte ? C'est la seule
  // information que l'historique ne dit pas d'un coup d'oeil, et c'est celle qui
  // compte : elle se referme d'office au-dela du delai.
  const ouverte = (interventions ?? []).find(i => !i.closed_at)
  const heuresOuvertes = ouverte
    ? (Date.now() - new Date(ouverte.opened_at).getTime()) / 3_600_000
    : null

  return (
    <div className="space-y-6 animate-fade-in">

      {supportEcole && (
        <SupportBar
          ecole={supportEcole.nom}
          slug={supportEcole.slug}
          depuis={heuresOuvertes}
          maxHeures={INTERVENTION_MAX_HEURES}
        />
      )}

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
                <th scope="col" className="list-th w-14" />
                <th scope="col" className="list-th text-left">Établissement</th>
                <th scope="col" className="list-th text-left">Statut</th>
                <th scope="col" className="list-th text-left">Abonnement</th>
                <th scope="col" className="list-th text-right">Utilisateurs</th>
                <th scope="col" className="list-th text-right whitespace-nowrap">Classes</th>
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
                      {e.logo_url ? (
                        <Image
                          src={e.logo_url}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="w-8 h-8 rounded-lg object-contain bg-[#ffffff] ring-1 ring-warm-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold select-none bg-warm-100 text-warm-700 ring-1 ring-warm-200">
                          {(e.nom ?? '?').trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
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
                        <Layers className="w-3.5 h-3.5" />{s?.classes ?? '·'}
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

      {Boolean(interventions?.length) && (
        <div className="card p-4 space-y-2">
          <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">
            Interventions de support
          </h2>
          <p className="text-xs text-warm-700">
            Une intervention se referme d&apos;elle-même au bout d&apos;
            {INTERVENTION_MAX_HEURES === 1 ? 'une heure' : `${INTERVENTION_MAX_HEURES} heures`}
            {' '}; elle se rouvre en un clic.
          </p>
          <ul className="divide-y divide-warm-100">
            {interventions!.map(i => (
              <li key={i.id} className="flex items-center gap-3 py-1.5 text-xs">
                <span className="font-semibold text-secondary-800 min-w-0 truncate">
                  {nomEcole[i.etablissement_id] ?? 'Établissement supprimé'}
                </span>
                <span className="text-warm-700 whitespace-nowrap">
                  {formatDateHeure(i.opened_at)}
                </span>
                <span className="ml-auto whitespace-nowrap">
                  {!i.closed_at ? (
                    <span className="text-amber-700 font-medium">En cours</span>
                  ) : i.closed_reason === 'expiration' ? (
                    <span className="text-warm-700">Refermée d&apos;office · {duree(i.opened_at, i.closed_at)}</span>
                  ) : (
                    <span className="text-warm-700">Terminée · {duree(i.opened_at, i.closed_at)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
