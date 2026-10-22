import Image from 'next/image'

/**
 * Marque de la CONSOLE DE L'EDITEUR (decision du 22/10) : logo, « Bilal
 * Education », pastille « CONSOLE EDITEUR ». Rien d'autre : un visiteur tombe
 * sur ces ecrans par hasard, ils ne doivent rien lui apprendre (ni version, ni
 * domaine, ni mesure de protection). Partagee par la connexion et les ecrans de
 * 2FA en contexte console. Posee sur fond graphite.
 */
export default function MarqueConsole() {
  return (
    <div className="flex flex-col items-center gap-3">
      <Image src="/icon.png" alt="" width={56} height={56} unoptimized className="logo-relief" />
      <h1 className="text-xl font-bold text-white tracking-tight">Bilal Education</h1>
      <PastilleConsole>Console éditeur</PastilleConsole>
    </div>
  )
}

export function PastilleConsole({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono text-[11px] font-medium uppercase tracking-[0.12em] px-3 py-1 rounded-full text-[var(--console-accent)] bg-[var(--console-pastille-fond)] border border-[var(--console-pastille-trait)]">
      {children}
    </span>
  )
}
