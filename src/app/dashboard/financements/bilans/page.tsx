import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BilansClient, { type OptionBilan } from '@/components/financements/BilansClient'
import { isFinanceRole } from '@/lib/financements/roles'
import { effectiveRole } from '@/lib/auth/effective-role'
import { etablirBilan, type BilanChiffres } from '@/lib/financements/bilan'
import { chargerEntreesBilan } from '@/lib/financements/bilan-donnees'

// Bilans annuels (02/11) : le bilan financier FIGE de chaque annee archivee
// (`bilans_financiers`, etabli a l'archivage), et le bilan PROVISOIRE de l'annee
// en cours, calcule a la volee par le meme code. Trio Financements ; la RLS de
// la table applique la meme regle.

const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })

export default async function BilansPage({ searchParams }: { searchParams: Promise<{ bilan?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  if (!isFinanceRole(effectiveRole(me))) redirect('/dashboard')

  const [{ data: courante }, { data: figes }, { data: etablissement }] = await Promise.all([
    supabase.from('school_years').select('id, label, start_date, end_date').eq('is_current', true).maybeSingle(),
    supabase.from('bilans_financiers')
      .select('id, school_year_id, year_label, chiffres, etabli_le, etabli_par_nom')
      .order('year_label', { ascending: false }),
    supabase.from('etablissements').select('nom, logo_url, adresse').single(),
  ])

  // L'annee en cours n'a de bilan provisoire que tant qu'elle n'est pas archivee.
  const couranteFigee = !!courante && (figes ?? []).some(f => f.school_year_id === courante.id)
  const options: OptionBilan[] = [
    ...(courante && !couranteFigee ? [{ cle: 'provisoire', libelle: `${courante.label} (provisoire)` }] : []),
    ...(figes ?? []).map(f => ({ cle: f.id, libelle: f.year_label })),
  ]

  const { bilan: demande } = await searchParams
  const cle = options.some(o => o.cle === demande) ? demande! : (options[0]?.cle ?? null)

  let chiffres: BilanChiffres | null = null
  let mention = ''
  if (cle === 'provisoire' && courante) {
    chiffres = etablirBilan(await chargerEntreesBilan(supabase, courante))
    mention = `Provisoire au ${fmtDate(new Date().toISOString())}`
  } else if (cle) {
    const f = (figes ?? []).find(x => x.id === cle)!
    chiffres = f.chiffres
    mention = `Établi le ${fmtDate(f.etabli_le)}${f.etabli_par_nom ? ` par ${f.etabli_par_nom}` : ''}`
  }

  return (
    <div className="h-full animate-fade-in">
      <BilansClient
        options={options}
        cle={cle}
        chiffres={chiffres}
        mention={mention}
        etablissement={{ nom: etablissement?.nom ?? 'Établissement', logo: etablissement?.logo_url ?? null, adresse: etablissement?.adresse ?? null }}
      />
    </div>
  )
}
