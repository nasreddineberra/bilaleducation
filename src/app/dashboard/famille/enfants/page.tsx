import { createClient } from '@/lib/supabase/server'
import { chargerParticipants } from '@/lib/espace-famille/donnees'
import { titulaireActuel } from '@/lib/teachers/titulaire'
import { nomCompletEnseignant } from '@/lib/teachers/nom'
import { Puce, Vide } from '@/components/dashboard/tdb'
import { formatDateFr } from '@/lib/dates'
import { accordGenre } from '@/lib/texte/genre'

/**
 * Espace famille · Mes enfants : identite, classe de l'annee et titulaire. Un
 * enfant parti est signale (ses bulletins de l'annee restent lisibles). Le
 * tuteur inscrit a un cours adulte y voit aussi « Mon cours » (fusion du 03/11).
 */
export default async function FamilleEnfantsPage() {
  const supabase = await createClient()
  const [{ enfants, monCours }, { data: enseignants }] = await Promise.all([
    chargerParticipants(supabase),
    supabase.rpc('famille_enseignants'),
  ])
  const titulaireDe = (classId: string) => {
    const t = titulaireActuel((enseignants ?? []).filter(x => x.class_id === classId))
    return t ? nomCompletEnseignant(t) : null
  }

  if (enfants.length === 0 && monCours.length === 0) return <Vide>Aucun enfant rattaché à votre foyer.</Vide>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-fade-in">
      {enfants.map(e => (
        <section key={e.id} className="card p-4 flex items-start gap-3" aria-label={`${e.last_name} ${e.first_name}`}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 select-none bg-warm-100 text-warm-700 ring-1 ring-warm-200" aria-hidden="true">
            {`${(e.last_name?.[0] ?? '').toUpperCase()}${(e.first_name?.[0] ?? '').toUpperCase()}`}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="list-name text-secondary-800">{e.last_name} {e.first_name}</h2>
              {e.parti && (
                <Puce ton="neutre">
                  {e.date_depart ? `${accordGenre(e.gender, 'Parti', 'Partie', 'Départ')} le ${formatDateFr(e.date_depart)}` : accordGenre(e.gender, 'Parti', 'Partie', 'Départ')}
                </Puce>
              )}
            </div>
            {e.date_of_birth && (
              <p className="text-xs text-warm-700">{accordGenre(e.gender, 'Né', 'Née', 'Naissance')} le {formatDateFr(e.date_of_birth)}</p>
            )}
            <p className="text-xs text-warm-700">
              Classe : <span className="font-medium text-secondary-800">{e.classe_nom ?? accordGenre(e.gender, 'Non affecté', 'Non affectée', 'Sans classe')}</span>
            </p>
            {e.titulaire && !e.parti && (
              <p className="text-xs text-warm-700">Titulaire : <span className="font-medium text-secondary-800">{e.titulaire}</span></p>
            )}
          </div>
        </section>
      ))}
      {monCours.map(c => (
        <section key={c.class_id} className="card p-4 flex items-start gap-3" aria-label="Mon cours">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 select-none bg-warm-100 text-warm-700 ring-1 ring-warm-200" aria-hidden="true">
            {(c.classes?.name?.[0] ?? '').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="list-name text-secondary-800">Mon cours</h2>
              <Puce ton="info">Cours adulte</Puce>
            </div>
            <p className="text-xs text-warm-700">Classe : <span className="font-medium text-secondary-800">{c.classes?.name ?? ''}</span></p>
            {titulaireDe(c.class_id) && (
              <p className="text-xs text-warm-700">Enseignant : <span className="font-medium text-secondary-800">{titulaireDe(c.class_id)}</span></p>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
