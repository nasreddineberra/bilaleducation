import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { createNotification } from '@/lib/notifications'
import { marqueEcole } from '@/lib/email/marque-ecole'
import { destinatairesDeLaClasse } from '@/lib/email/destinataires-classe'
import { coque, tableauInfos, POLICE, C } from '@/lib/email/shell.mjs'
import { formatJourLongFr, horodatageParis } from '@/lib/dates'
import { escapeHtml } from '@/lib/security/escape-html'

/**
 * PREVENIR LES FAMILLES D'UNE SEANCE ANNULEE OU RETABLIE (lot 3c, 28/10).
 *
 * Un email par foyer ET par classe, qui liste toutes ses seances : une absence
 * d'une semaine fait un email, pas cinq. Il dit la classe, le jour et l'horaire,
 * JAMAIS le motif de l'absence ni le nom de l'enseignant absent.
 *
 * Seules les seances A VENIR sont annoncees : une seance passee ne se rattrape
 * pas par un email. Une seance est « prevenue » quand au moins un email de sa
 * classe est parti : la base n'en garde la date (`marquer_familles_prevenues`)
 * que pour celles-la.
 */

export type SeanceCle = { slotId: string; date: string }
export type Sorte = 'annulee' | 'retablie'

type Detail = SeanceCle & { classId: string; classe: string; isAdult: boolean; debut: string; fin: string }

const cle = (s: SeanceCle) => `${s.slotId}|${s.date}`

/** Les seances a venir parmi `seances`, avec leur classe et leur horaire. */
async function seancesAVenir(supabase: SupabaseClient<Database>, seances: SeanceCle[]): Promise<Detail[]> {
  if (seances.length === 0) return []
  const { data: slots } = await supabase
    .from('schedule_slots')
    .select('id, class_id, start_time, end_time, classes(name, cotisation_types(is_adult))')
    .in('id', [...new Set(seances.map(s => s.slotId))])
  const slotDe = new Map((slots ?? []).map(s => [s.id, s]))
  const maintenant = horodatageParis(new Date())
  const vues = new Set<string>()
  const rendu: Detail[] = []
  for (const s of seances) {
    const slot = slotDe.get(s.slotId)
    if (!slot || vues.has(cle(s))) continue
    vues.add(cle(s))
    const debut = slot.start_time.slice(0, 5)
    if (`${s.date}T${debut}` <= maintenant) continue
    const classe = slot.classes as unknown as { name: string; cotisation_types: { is_adult: boolean } | null } | null
    rendu.push({
      ...s, classId: slot.class_id, classe: classe?.name ?? '', isAdult: !!classe?.cotisation_types?.is_adult,
      debut, fin: slot.end_time.slice(0, 5),
    })
  }
  return rendu.sort((a, b) => `${a.date}${a.debut}`.localeCompare(`${b.date}${b.debut}`))
}

/**
 * Envoie les emails. Rend les seances prevenues (au moins un email parti pour
 * leur classe) et le nombre de foyers que l'envoi n'a pas atteints.
 */
export async function prevenirFamilles(
  supabase: SupabaseClient<Database>,
  etablissementId: string,
  seances: SeanceCle[],
  sorte: Sorte,
): Promise<{ prevenues: SeanceCle[]; echecs: number }> {
  const details = await seancesAVenir(supabase, seances)
  if (details.length === 0) return { prevenues: [], echecs: 0 }

  const parClasse = new Map<string, Detail[]>()
  for (const d of details) parClasse.set(d.classId, [...(parClasse.get(d.classId) ?? []), d])

  const ecole = await marqueEcole(supabase, etablissementId)
  const prevenues: SeanceCle[] = []
  let echecs = 0

  for (const [classId, liste] of parClasse) {
    const { classe, isAdult } = liste[0]
    const plusieurs = liste.length > 1
    const titreSeul = sorte === 'annulee'
      ? (plusieurs ? 'Séances annulées' : 'Séance annulée')
      : (plusieurs ? 'Séances maintenues' : 'Séance maintenue')
    const phrase = sorte === 'annulee'
      ? (plusieurs ? 'Ces séances sont annulées : il n’y aura pas cours.' : 'Cette séance est annulée : il n’y aura pas cours.')
      : (plusieurs
          ? 'Ces séances, annoncées annulées, ont bien lieu aux horaires habituels.'
          : 'Cette séance, annoncée annulée, a bien lieu à l’horaire habituel.')
    const lignesSeances = liste.map((d, i) => [
      i === 0 ? (plusieurs ? 'Séances' : 'Séance') : '',
      `${formatJourLongFr(`${d.date}T12:00`)} · ${d.debut}-${d.fin}`,
    ] as [string, string])

    const destinataires = await destinatairesDeLaClasse(supabase, classId, isAdult)
    let parti = false
    for (const dest of destinataires) {
      const titre = `${titreSeul} · ${classe}`
      const corps = `${classe} · ${liste.map(d => `${formatJourLongFr(`${d.date}T12:00`)} ${d.debut}-${d.fin}`).join(' · ')}`
      // Le gabarit attend du HTML : noms de classe et d'eleves echappes.
      const html = coque({
        titre: escapeHtml(titre),
        apercu: escapeHtml(corps),
        corps: [
          `              <div style="font-family:${POLICE}; font-size:14px; line-height:1.65; color:${C.encre};">${phrase}</div>`,
          tableauInfos(([
            [isAdult ? 'Participant' : 'Élève', escapeHtml(dest.nom)],
            ['Classe', escapeHtml(classe)],
            ...lignesSeances,
          ] as [string, string][]).filter(([l, v]) => !!v || l === '')),
        ].join('\n'),
        ecole: { nom: ecole.nom, logoUrl: ecole.logoUrl },
      })
      const res = await createNotification({
        etablissement_id: etablissementId,
        type: 'seance',
        parent_id: dest.parent_id,
        title: titre,
        body: corps,
        metadata: { sorte, seances: liste.map(d => ({ slot_id: d.slotId, date: d.date })) },
        emailSubject: titre,
        emailHtml: html,
        ...(dest.emailsOverride ? { emailsOverride: dest.emailsOverride } : {}),
      })
      if (res.ok && res.emailStatus === 'sent') parti = true
      else echecs++
    }
    if (parti) prevenues.push(...liste.map(({ slotId, date }) => ({ slotId, date })))
  }
  return { prevenues, echecs }
}

/** Phrase d'avertissement quand des foyers n'ont pas ete atteints. */
export function phraseEchecs(echecs: number): string | undefined {
  if (echecs === 0) return undefined
  return `${echecs} famille${echecs > 1 ? 's n’ont' : ' n’a'} pas pu être prévenue${echecs > 1 ? 's' : ''} par email.`
}
