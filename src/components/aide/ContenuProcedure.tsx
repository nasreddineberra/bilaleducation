import Link from 'next/link'
import { PROCEDURES, segments } from '@/lib/aide'
import type { Procedure } from '@/lib/aide/types'

/** Texte d'une procedure : les noms entre « ... » (boutons, champs) mis en valeur. */
export function Texte({ children }: { children: string }) {
  return (
    <>
      {segments(children).map((s, i) => s.fort
        ? <strong key={i} className="font-semibold text-secondary-800">{s.texte}</strong>
        : <span key={i}>{s.texte}</span>)}
    </>
  )
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="section-title">{titre}</h3>
      {children}
    </section>
  )
}

/**
 * Corps d'une procedure (deja filtree pour le role : `procedurePour`). Rendu
 * identique dans le tiroir et sur la page de l'aide ; `compact` resserre le
 * tiroir.
 */
export default function ContenuProcedure({ procedure: p, compact = false }: { procedure: Procedure; compact?: boolean }) {
  const voirAussi = (p.voirAussi ?? []).map(s => PROCEDURES.find(x => x.slug === s)).filter(Boolean) as Procedure[]
  return (
    <div className={compact ? 'space-y-4 text-sm text-secondary-700' : 'space-y-6 text-sm text-secondary-700'}>
      <div className="space-y-1">
        <p className="leading-relaxed">{p.resume}</p>
        <p className="text-xs text-warm-700">Menu : {p.acces}</p>
      </div>

      <Section titre="Pas à pas">
        <div className="space-y-4">
          {p.taches.map((t, i) => (
            <article key={i} className="rounded-lg border border-[var(--card-border)] px-3 py-2.5 space-y-2">
              <h4 className="text-sm font-semibold text-secondary-800">{t.titre}</h4>
              <ol className="list-decimal pl-5 space-y-1 leading-relaxed marker:text-warm-700 marker:tabular-nums">
                {t.etapes.map((e, j) => <li key={j}><Texte>{e}</Texte></li>)}
              </ol>
              {t.aSavoir && t.aSavoir.length > 0 && (
                <ul className="border-l-2 border-[var(--brand-line)] pl-3 space-y-1 text-xs text-warm-700 leading-relaxed">
                  {t.aSavoir.map((a, j) => <li key={j}><Texte>{a}</Texte></li>)}
                </ul>
              )}
            </article>
          ))}
        </div>
      </Section>

      {p.regles && p.regles.length > 0 && (
        <Section titre="Règles à connaître">
          <ul className="list-disc pl-5 space-y-1 leading-relaxed">
            {p.regles.map((r, i) => <li key={i}><Texte>{r.texte}</Texte></li>)}
          </ul>
        </Section>
      )}

      {p.grise && p.grise.length > 0 && (
        <Section titre="Un bouton est grisé ou absent">
          <dl className="space-y-2">
            {p.grise.map((g, i) => (
              <div key={i} className="space-y-0.5">
                <dt className="font-semibold text-secondary-800"><Texte>{g.element}</Texte></dt>
                <dd className="leading-relaxed"><Texte>{g.raison}</Texte> <Texte>{g.solution}</Texte></dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {p.faq && p.faq.length > 0 && (
        <Section titre="Questions fréquentes">
          <dl className="space-y-2">
            {p.faq.map((f, i) => (
              <div key={i} className="space-y-0.5">
                <dt className="font-semibold text-secondary-800"><Texte>{f.question}</Texte></dt>
                <dd className="leading-relaxed"><Texte>{f.reponse}</Texte></dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {voirAussi.length > 0 && (
        <Section titre="Voir aussi">
          <ul className="flex flex-wrap gap-2">
            {voirAussi.map(v => (
              <li key={v.slug}>
                <Link href={`/dashboard/aide/${v.slug}`} className="text-[var(--brand-surface)] dark:text-[var(--brand-accent)] font-medium hover:underline">
                  {v.titre}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
