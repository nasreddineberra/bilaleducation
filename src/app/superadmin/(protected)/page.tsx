import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Building2, Users, Layers, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { SupportBar } from './SupportControls'
import ClickableRow from './ClickableRow'
import TruncatedText from '@/components/ui/TruncatedText'
import CreerEcoleDemo from './CreerEcoleDemo'
import { FloatButton } from '@/components/ui/FloatFields'
import { INTERVENTION_MAX_HEURES } from '@/lib/support/duree'
import { abonnementExpire, joursRestants } from '@/lib/tenant/abonnement'
import FiltresEcoles, { type Filtre } from './FiltresEcoles'
import { depuis, SEUIL_INACTIVITE_JOURS } from '@/lib/tenant/activite'

// Le fuseau est FIXE : cette page est rendue cote SERVEUR, qui tourne en UTC.
// Les heures d'intervention s'affichaient avec deux heures de retard.
/** Échéance d'abonnement au format 31/07/2026, heure de Paris. */
function formatDate(date: string | null | undefined) {
  if (!date) return null
  return new Date(date).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/** « 07/10/26, 22:49 », heure de Paris. */
function formatDateHeure(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/** Durée d'une intervention, en heures et minutes. */
function duree(debut: string, fin: string) {
  const minutes = Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 60000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

// Meme regle que le middleware : jour d'echeance inclus. Sinon la console
// annoncerait « Expire » le dernier jour, quand l'ecole y a encore acces.
const isExpired = (date: string | null | undefined) => abonnementExpire(date)

// Recherche insensible aux accents et a la casse.
const norm = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Echeance dans 30 jours ou moins, ou deja depassee. */
const SEUIL_ECHEANCE_JOURS = 30

export default async function SuperAdminPage({ searchParams }: {
  searchParams: Promise<{ filtre?: string; q?: string }>
}) {
  const sp = await searchParams
  const filtre: Filtre = (['surveiller', 'echeance', 'inactives'] as const).find(f => f === sp.filtre) ?? 'toutes'
  const q = (sp.q ?? '').trim()
  const supabase = createAdminClient()

  const { data: etablissements } = await supabase
    .from('etablissements')
    .select('id, slug, nom, is_active, subscription_expires_at, logo_url, max_students, donnees_effacees_le, est_demo')
    .order('nom', { ascending: true })

  // UN SEUL appel pour tous les comptages. Cette page en faisait trois PAR
  // ÉCOLE, en boucle : à dix clients, trente allers-retours pour une liste.
  // La fonction exclut le super-admin des utilisateurs — rattaché pendant une
  // intervention, il gonflerait l'effectif de l'école qu'il dépanne.
  const { data: sante } = await supabase.rpc('get_etablissements_sante')

  type Sante = {
    etablissement_id: string; users_count: number; base_facturable: number
    classes_count: number; last_sign_in: string | null
  }
  const statsMap = Object.fromEntries(
    ((sante ?? []) as Sante[]).map(s => [s.etablissement_id, {
      users: s.users_count, inscrits: s.base_facturable, classes: s.classes_count,
      derniereConnexion: s.last_sign_in,
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
    // Pas de limite (decision du 13/10) : la colonne defile a l'interieur. Seul
    // le plafond de l'API (1 000 lignes) s'applique ; la purge de chaque fiche
    // ecole garde l'historique loin de ce seuil.

  const nomEcole = Object.fromEntries((etablissements ?? []).map(e => [e.id, e.nom]))

  // Depuis quand l'intervention en cours est-elle ouverte ? C'est la seule
  // information que l'historique ne dit pas d'un coup d'oeil, et c'est celle qui
  // compte : elle se referme d'office au-dela du delai.
  const ouverte = (interventions ?? []).find(i => !i.closed_at)
  // Composant SERVEUR, rendu une fois par requete : « maintenant » y est stable
  // par construction, la regle vise la memoisation d'un composant client.
  // eslint-disable-next-line react-hooks/purity
  const maintenant = Date.now()
  const heuresOuvertes = ouverte
    ? (maintenant - new Date(ouverte.opened_at).getTime()) / 3_600_000
    : null

  // ── Filtres ────────────────────────────────────────────────────────────────
  // Memes regles que les couleurs des cellules : un filtre et une couleur ne
  // peuvent pas se contredire. Jour d'echeance inclus (`joursRestants`).
  const signaux = (e: NonNullable<typeof etablissements>[number]) => {
    const st = statsMap[e.id]
    const jours = joursRestants(e.subscription_expires_at, new Date(maintenant))
    const echeance = jours !== null && jours <= SEUIL_ECHEANCE_JOURS
    const quotaAtteint = Boolean(e.max_students && st && st.inscrits / e.max_students >= 0.9)
    const act = depuis(st?.derniereConnexion ?? null, maintenant)
    const dormante = act.jours === null || act.jours >= SEUIL_INACTIVITE_JOURS
    return {
      echeance,
      surveiller: Boolean(e.is_active) && (echeance || quotaAtteint || dormante),
      inactive: !e.is_active,
    }
  }
  const toutes = etablissements ?? []
  const comptes: Record<Filtre, number> = {
    toutes:     toutes.length,
    surveiller: toutes.filter(e => signaux(e).surveiller).length,
    echeance:   toutes.filter(e => signaux(e).echeance).length,
    inactives:  toutes.filter(e => signaux(e).inactive).length,
  }
  const qn = norm(q)
  const visibles = toutes
    .filter(e => filtre === 'toutes'
      || (filtre === 'surveiller' && signaux(e).surveiller)
      || (filtre === 'echeance' && signaux(e).echeance)
      || (filtre === 'inactives' && signaux(e).inactive))
    .filter(e => !qn || norm(e.nom ?? '').includes(qn) || norm(e.slug ?? '').includes(qn))
    // L'ecole de demonstration toujours en tete (tri STABLE : les autres gardent
    // leur ordre).
    .sort((a, b) => Number(Boolean(b.est_demo)) - Number(Boolean(a.est_demo)))

  return (
    // `min-h-full` + grille en `flex-1` : la colonne des interventions descend
    // jusqu'au bas de la fenetre, sans barre de defilement de page.
    <div className="min-h-full flex flex-col gap-6 animate-fade-in">

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
        <div className="flex items-center gap-2">
          {!(etablissements ?? []).some(e => e.est_demo) && <CreerEcoleDemo />}
          <FloatButton href="/superadmin/ecoles/new" variant="submit">
            Nouvel établissement
          </FloatButton>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 items-start">

      <div className="col-span-3 space-y-2">
      {toutes.length > 0 && <FiltresEcoles filtre={filtre} q={q} comptes={comptes} />}
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
                {/* Toutes les colonnes a la largeur de leur contenu (`w-px` +
                    `whitespace-nowrap`), sauf Etablissement qui prend le reste.
                    Donnees centrees, sauf Etablissement et Derniere connexion. */}
                <th scope="col" className="list-th w-px px-2" />
                <th scope="col" className="list-th text-left">Établissement</th>
                <th scope="col" className="list-th w-px whitespace-nowrap text-center">Statut</th>
                <th scope="col" className="list-th w-px whitespace-nowrap text-center">Abonnement</th>
                <th scope="col" className="list-th w-px whitespace-nowrap text-center">Inscrits</th>
                <th scope="col" className="list-th w-px whitespace-nowrap text-left">Dernière connexion</th>
                <th scope="col" className="list-th w-px whitespace-nowrap text-center">Utilisateurs</th>
                <th scope="col" className="list-th w-px whitespace-nowrap text-center">Classes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {visibles.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-warm-700">Aucun établissement ne correspond.</td></tr>
              )}
              {visibles.map(e => {
                const expired = isExpired(e.subscription_expires_at)
                const dateStr = formatDate(e.subscription_expires_at)
                const s       = statsMap[e.id]
                // Base facturable (eleves actifs + adultes inscrits) : le chiffre
                // qui fixe le prix, et que la limite d'inscrits plafonne.
                const quota    = e.max_students && s ? s.inscrits / e.max_students : null
                const activite = depuis(s?.derniereConnexion ?? null, maintenant)
                const dormante = e.is_active && (activite.jours === null || activite.jours >= SEUIL_INACTIVITE_JOURS)

                return (
                  <ClickableRow
                    key={e.id}
                    href={`/superadmin/ecoles/${e.id}`}
                    label={`Fiche de ${e.nom}`}
                    className={e.donnees_effacees_le ? 'opacity-60 grayscale' : ''}
                  >
                    <td className="list-td px-2">
                      {e.logo_url ? (
                        <Image
                          src={e.logo_url}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="w-8 h-8 max-w-none rounded-lg object-contain bg-[#ffffff] ring-1 ring-warm-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold select-none bg-warm-100 text-warm-700 ring-1 ring-warm-200">
                          {(e.nom ?? '?').trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="list-td">
                      <p className="list-name flex items-center gap-2">
                        {e.nom}
                        {e.est_demo && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700">Démo</span>
                        )}
                      </p>
                      <p className="text-xs text-warm-700 mt-0.5 font-mono">{e.slug}.bilaleducation.fr</p>
                    </td>
                    <td className="list-td whitespace-nowrap text-center">
                      {e.donnees_effacees_le ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warm-700 bg-warm-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                          <XCircle className="w-3.5 h-3.5" /> Données effacées
                        </span>
                      ) : e.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3.5 h-3.5" /> Inactif
                        </span>
                      )}
                    </td>
                    <td className="list-td whitespace-nowrap text-center">
                      {dateStr ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${expired ? 'text-red-600 bg-red-50' : 'text-warm-700 bg-warm-100'}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {expired ? 'Expiré ' : ''}{dateStr}
                        </span>
                      ) : (
                        <span className="text-xs text-warm-700">Sans expiration</span>
                      )}
                    </td>
                    <td className="list-td text-center whitespace-nowrap tabular-nums">
                      <span className={quota !== null && quota >= 0.9 ? 'text-amber-700 font-medium' : 'text-warm-700'}>
                        {s?.inscrits ?? '·'}
                        {e.max_students ? ` / ${e.max_students}` : ''}
                      </span>
                    </td>
                    <td className="list-td whitespace-nowrap">
                      <span className={dormante ? 'text-amber-700 font-medium' : 'text-warm-700'}>
                        {s ? activite.texte : '·'}
                      </span>
                    </td>
                    <td className="list-td text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-warm-700">
                        <Users className="w-3.5 h-3.5" />{s?.users ?? '·'}
                      </span>
                    </td>
                    <td className="list-td text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-warm-700">
                        <Layers className="w-3.5 h-3.5" />{s?.classes ?? '·'}
                      </span>
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
      {/* Hauteur FIXEE a celle de la page (`relative` + `absolute inset-0`) : la
          liste ne pousse pas la page, elle defile a l'interieur. */}
      <div className="col-span-1 self-stretch relative min-h-[12rem]">
      <div className="absolute inset-0 flex flex-col gap-2">
        {/* Le délai vit dans le titre : sur une colonne étroite, une phrase
            d'explication coûtait deux lignes pour une information qui tient en
            trois mots. La valeur reste tirée de la constante — la changer ne doit
            pas laisser un libellé qui ment. */}
        <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest whitespace-nowrap truncate">
          Interventions de support ({INTERVENTION_MAX_HEURES} h max)
        </h2>

        {/* `card p-0` : un tableau de liste ne prend pas le retrait de 24 px.
            Padding réduit à `px-2` — sur un quart de largeur, les 16 px de
            `.list-th` mangeraient un cinquième de la place utile. */}
        <div className="card p-0 flex-1 min-h-0 overflow-y-auto list-scroll">
          {/* `table-fixed` : en disposition automatique, un tableau s'elargit a son
              contenu et la troncature du nom n'agit pas — « Refermee · 1 h 04 »
              poussait une barre de defilement horizontale. Date et statut ont une
              largeur taillee sur leur valeur la plus longue, le nom prend le reste. */}
          <table className="w-full table-fixed text-xs" aria-label="Interventions de support">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th scope="col" className="list-th px-2 text-left">Établissement</th>
                <th scope="col" className="list-th px-2 text-left w-[6.75rem]">Date</th>
                <th scope="col" className="list-th px-2 text-left w-[7.75rem]">Statut</th>
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
                      <div className="flex min-w-0">
                        <TruncatedText className="list-name" text={nomEcole[i.etablissement_id] ?? 'Établissement supprimé'} />
                      </div>
                    </td>
                    <td className="list-td px-2 text-warm-700 whitespace-nowrap">
                      {formatDateHeure(i.opened_at)}
                    </td>
                    <td className="list-td px-2">
                      {!i.closed_at ? (
                        <span className="text-amber-700 font-medium whitespace-nowrap">En cours</span>
                      ) : (
                        // Sur une ligne : la duree dit ce que la date ne dit pas,
                        // combien de temps l'acces est reste ouvert.
                        <span className="text-warm-700 whitespace-nowrap">
                          {i.closed_reason === 'expiration' ? 'Refermée' : 'Terminée'} · {duree(i.opened_at, i.closed_at)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      </div>{/* fin grille */}

    </div>
  )
}
