import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Building2, Users, GraduationCap, Layers, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { EnterButton, SupportBar } from './SupportControls'
import ClickableRow from './ClickableRow'
import { INTERVENTION_MAX_HEURES } from '@/lib/support/duree'
import { formatDateFr, formatDateHeureFr } from '@/lib/dates'

// Le fuseau est FIXE : cette page est rendue cote SERVEUR, qui tourne en UTC.
// Les heures d'intervention s'affichaient avec deux heures de retard.
function formatDate(date: string | null | undefined) {
  if (!date) return null
  return formatDateFr(date)
}

const formatDateHeure = formatDateHeureFr

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

  // UN SEUL appel pour tous les comptages. Cette page en faisait trois PAR
  // ÉCOLE, en boucle : à dix clients, trente allers-retours pour une liste.
  // La fonction exclut le super-admin des utilisateurs — rattaché pendant une
  // intervention, il gonflerait l'effectif de l'école qu'il dépanne.
  const { data: sante } = await supabase.rpc('get_etablissements_sante')

  type Sante = { etablissement_id: string; users_count: number; students_count: number; classes_count: number }
  const statsMap = Object.fromEntries(
    ((sante ?? []) as Sante[]).map(s => [s.etablissement_id, {
      users: s.users_count, students: s.students_count, classes: s.classes_count,
    }])
  )

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

      <div className="grid grid-cols-4 gap-4 items-start">

      <div className="col-span-3">
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
                          nom={e.nom}
                          disabled={Boolean(supportEcole) && supportEcole?.id !== e.id}
                          dejaOuverte={supportEcole?.id === e.id}
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
      </div>{/* fin colonne établissements */}

      {/* Colonne étroite : l'historique se lit EMPILÉ — nom, date, issue — là où
          la pleine largeur permettait une ligne. Encadré toujours affiché, même
          vide : masqué faute de lignes, il laissait croire que la fonctionnalité
          n'existait pas. */}
      <div className="col-span-1 space-y-2">
        {/* Le délai vit dans le titre : sur une colonne étroite, une phrase
            d'explication coûtait deux lignes pour une information qui tient en
            trois mots. La valeur reste tirée de la constante — la changer ne doit
            pas laisser un libellé qui ment. */}
        <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">
          Interventions de support (expir. session {INTERVENTION_MAX_HEURES}h)
        </h2>

        {/* `card p-0` : un tableau de liste ne prend pas le retrait de 24 px.
            Padding réduit à `px-2` — sur un quart de largeur, les 16 px de
            `.list-th` mangeraient un cinquième de la place utile. */}
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-xs" aria-label="Interventions de support">
            <thead>
              <tr>
                <th scope="col" className="list-th px-2 text-left">Établissement</th>
                <th scope="col" className="list-th px-2 text-left">Date</th>
                <th scope="col" className="list-th px-2 text-left">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {!interventions?.length ? (
                <tr>
                  <td colSpan={3} className="px-2 py-3 text-xs text-warm-700 leading-snug">
                    Aucune intervention enregistrée. L&apos;historique démarre au
                    premier «&nbsp;Intervenir&nbsp;».
                  </td>
                </tr>
              ) : (
                interventions.map(i => (
                  <tr key={i.id}>
                    <td className="list-td px-2">
                      <span className="list-name block truncate">
                        {nomEcole[i.etablissement_id] ?? 'Établissement supprimé'}
                      </span>
                    </td>
                    <td className="list-td px-2 text-warm-700 whitespace-nowrap">
                      {formatDateHeure(i.opened_at)}
                    </td>
                    <td className="list-td px-2">
                      {!i.closed_at ? (
                        <span className="text-amber-700 font-medium whitespace-nowrap">En cours</span>
                      ) : (
                        <>
                          <span className="text-warm-700 whitespace-nowrap">
                            {i.closed_reason === 'expiration' ? 'Refermée' : 'Terminée'}
                          </span>
                          {/* La durée sous le statut : elle dit ce que la date ne
                              dit pas — combien de temps l'accès est resté ouvert. */}
                          <span className="block text-warm-700 whitespace-nowrap">
                            {duree(i.opened_at, i.closed_at)}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      </div>{/* fin grille */}

    </div>
  )
}
