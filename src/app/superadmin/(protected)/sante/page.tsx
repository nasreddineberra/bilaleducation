import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import ClickableRow from '../ClickableRow'
import { formatDateFr } from '@/lib/dates'

/**
 * Santé des établissements clients.
 *
 * Écran distinct de la liste, et non trois colonnes de plus : la liste répond à
 * « quels sont mes clients ? », celui-ci à « lesquels vont mal ? ». Deux
 * questions, deux lectures — les mélanger aurait donné un tableau que personne
 * ne lit en entier.
 *
 * Les quatre signaux retenus sont ceux qui annoncent un problème AVANT qu'il ne
 * soit signalé : une école qui ne se connecte plus, une messagerie jamais
 * configurée, un effectif qui touche sa limite, un abonnement qui approche.
 */

/** Nombre de jours entre aujourd'hui et une date (négatif = passé). */
function joursAvant(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
}

/**
 * « aujourd'hui », « il y a 3 j », « il y a 2 mois ».
 *
 * Une date brute obligerait à compter mentalement : ce qu'on veut savoir, c'est
 * si l'école s'est connectée récemment, pas le jour exact.
 */
function depuis(date: string | null): { texte: string; jours: number | null } {
  if (!date) return { texte: 'Jamais', jours: null }
  const jours = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
  if (jours <= 0) return { texte: "Aujourd'hui", jours }
  if (jours === 1) return { texte: 'Hier', jours }
  if (jours < 31) return { texte: `Il y a ${jours} j`, jours }
  const mois = Math.floor(jours / 30)
  return { texte: `Il y a ${mois} mois`, jours }
}

function formatDate(date: string | null | undefined) {
  if (!date) return null
  return formatDateFr(date)
}

export default async function SantePage() {
  const supabase = createAdminClient()

  const [{ data: etablissements }, { data: sante }] = await Promise.all([
    supabase
      .from('etablissements')
      .select('id, slug, nom, is_active, logo_url, max_students, subscription_expires_at')
      .order('nom', { ascending: true }),
    // Un seul appel pour tous les établissements : la liste faisait trois
    // requêtes par école, en boucle.
    supabase.rpc('get_etablissements_sante'),
  ])

  type Sante = {
    etablissement_id: string
    users_count: number
    students_count: number
    classes_count: number
    last_sign_in: string | null
    smtp_configured: boolean
  }
  const parId = Object.fromEntries(((sante ?? []) as Sante[]).map(s => [s.etablissement_id, s]))

  const lignes = (etablissements ?? []).map(e => {
    const s        = parId[e.id]
    const activite = depuis(s?.last_sign_in ?? null)
    const jAvant   = joursAvant(e.subscription_expires_at ?? null)
    const quota    = e.max_students && s ? s.students_count / e.max_students : null

    // Un signal n'est une alerte que s'il appelle une action. Un établissement
    // désactivé n'en produit aucune : son silence et sa messagerie absente sont
    // la conséquence d'une décision, pas un symptôme.
    const alertes = e.is_active ? [
      !s?.smtp_configured                  && 'Messagerie non configurée',
      activite.jours === null              && 'Jamais connecté',
      activite.jours !== null && activite.jours >= 30 && `Sans connexion depuis ${activite.texte.toLowerCase().replace('il y a ', '')}`,
      quota !== null && quota >= 0.9       && "Effectif proche de la limite",
      jAvant !== null && jAvant < 0        && 'Abonnement expiré',
      jAvant !== null && jAvant >= 0 && jAvant <= 30 && `Abonnement dans ${jAvant} j`,
    ].filter(Boolean) as string[] : []

    return { e, s, activite, jAvant, quota, alertes }
  })

  const aSurveiller = lignes.filter(l => l.alertes.length > 0).length

  return (
    <div className="space-y-4 animate-fade-in">

      <div>
        <h1 className="text-2xl font-bold text-secondary-800">Santé des établissements</h1>
        <p className="text-warm-700 text-sm mt-1">
          {aSurveiller === 0
            ? 'Aucun point à surveiller.'
            : `${aSurveiller} établissement${aSurveiller > 1 ? 's' : ''} à surveiller.`}
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs" aria-label="Santé des établissements clients">
          <thead>
            <tr>
              <th scope="col" className="list-th w-14" />
              <th scope="col" className="list-th text-left">Établissement</th>
              <th scope="col" className="list-th text-left whitespace-nowrap">Dernière connexion</th>
              <th scope="col" className="list-th text-left">Messagerie</th>
              <th scope="col" className="list-th text-right">Élèves</th>
              <th scope="col" className="list-th text-left">Abonnement</th>
              <th scope="col" className="list-th text-left">À surveiller</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {lignes.map(({ e, s, activite, jAvant, quota, alertes }) => (
              <ClickableRow key={e.id} href={`/superadmin/ecoles/${e.id}`} label={`Fiche de ${e.nom}`}>
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
                  {!e.is_active && (
                    <p className="text-xs text-red-700 mt-0.5">Accès coupé</p>
                  )}
                </td>

                <td className="list-td whitespace-nowrap">
                  <span className={activite.jours === null || activite.jours >= 30 ? 'text-amber-700 font-medium' : 'text-warm-700'}>
                    {activite.texte}
                  </span>
                </td>

                <td className="list-td whitespace-nowrap">
                  {s?.smtp_configured
                    ? <span className="text-warm-700">Configurée</span>
                    : <span className="text-amber-700 font-medium">À configurer</span>}
                </td>

                <td className="list-td text-right whitespace-nowrap tabular-nums">
                  <span className={quota !== null && quota >= 0.9 ? 'text-amber-700 font-medium' : 'text-warm-700'}>
                    {s?.students_count ?? '·'}
                    {e.max_students ? ` / ${e.max_students}` : ''}
                  </span>
                </td>

                <td className="list-td whitespace-nowrap">
                  {jAvant === null ? (
                    <span className="text-warm-700">Sans expiration</span>
                  ) : jAvant < 0 ? (
                    <span className="text-red-700 font-medium">Expiré</span>
                  ) : (
                    <span className={jAvant <= 30 ? 'text-amber-700 font-medium' : 'text-warm-700'}>
                      {formatDate(e.subscription_expires_at)}
                    </span>
                  )}
                </td>

                <td className="list-td">
                  {alertes.length === 0 ? (
                    <span className="text-warm-700" aria-label="Rien à signaler">·</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {alertes.map(a => (
                        <li key={a} className="text-amber-700">{a}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
