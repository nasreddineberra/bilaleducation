import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import SentMessagesClient from '@/components/communications/SentMessagesClient'

export default async function CommunicationsPage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // NI `auth.getUser()` NI LECTURE DU PROFIL : plus rien n'en depend depuis que
  // le perimetre est pose en RLS. Deux allers-retours economises sur une page
  // qui n'en avait pas besoin — `auth.getUser()` est le poste le plus lourd du
  // rendu (155 ms, mesure du 10 aout), et la session est deja verifiee par le
  // layout du tableau de bord.

  // CET ECRAN EST OUVERT A TOUT LE PERSONNEL, EN LECTURE SEULE (01/10).
  //
  // L'enseignant en avait ete exclu le 24/09, mais pour une raison devenue
  // caduque : l'historique etait alors filtre sur `published_by = lui`, donc il
  // n'y voyait qu'une liste VIDE. C'etait un constat d'inutilite, pas une
  // decision de principe. Depuis le lot 2 du chantier RLS, son perimetre de
  // lecture existe reellement — les messages de SA classe et ceux adresses a
  // toutes les familles — et la question « les parents de ma classe ont-ils ete
  // prevenus ? » trouve enfin sa reponse.
  //
  // AUCUNE GARDE DE ROLE ICI, et c'est delibere : le perimetre est pose en RLS,
  // qui s'applique quel que soit le chemin — ecran, adresse directe ou appel a
  // l'API. Une garde ici ne ferait que masquer un ecran deja vide, et finirait
  // par diverger de la base (motif de l'onglet Assiduite, 14 aout).
  //
  // Ce qui reste ferme : les deux ecrans d'ENVOI (`new`, `staff`), qui gardent
  // leurs gardes propres. L'enseignant ne communique que les devoirs.

  // Messages envoyes
  const query = supabase
    .from('announcements')
    .select('id, title, announcement_type, target_class_id, channel, recipient_count, published_at, sent_at, published_by, profiles:published_by(first_name, last_name), classes:target_class_id(name, cotisation_types(label), class_teachers(is_main_teacher, teachers(civilite, first_name, last_name)))')
    .eq('etablissement_id', etablissementId)
    .eq('is_published', true)
    .order('published_at', { ascending: false })


  const { data } = await query
  const messages = (data ?? []) as any[]

  // Annee en cours : libelle dynamique « Parents {annee} » (comme l'ecran d'envoi).
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('label')
    .eq('is_current', true)
    .single()

  return (
    <div className="space-y-4 animate-fade-in">
      <SentMessagesClient messages={messages} yearLabel={schoolYear?.label ?? null} />
    </div>
  )
}
