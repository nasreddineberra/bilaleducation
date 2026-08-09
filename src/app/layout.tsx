import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_Arabic } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/lib/toast-context'
import { ToastContainer } from '@/components/ui/Toast'
import { validateEnv } from '@/lib/env'
import { headers } from 'next/headers'
import { getCachedEtablissement } from '@/lib/cache/dashboard'
import TitreFenetre from '@/components/layout/TitreFenetre'

// Valider les variables d'environnement au démarrage
validateEnv()

// ─── Google Fonts (self-hosted via Next.js) ──────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

// Noto Sans Arabic : sans arabe de reference (Android, ChromeOS, Windows),
// proportions proches d'Inter. Pas de sous-ensemble latin : le latin reste
// rendu par Inter, on ne charge donc que l'arabe.
const arabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-arabic',
  display: 'swap',
})

/**
 * Titre d'onglet : « NOM DE L'ÉCOLE - Bilal Education ».
 *
 * Le nom de l'établissement vient du SOUS-DOMAINE, via l'en-tête que pose le
 * middleware — la seule source disponible ici, une page pouvant être servie
 * sans session (la connexion, par exemple). Sur la console de l'éditeur et sur
 * le domaine racine, aucun établissement n'est résolu : le titre reste
 * « Bilal Education » seul.
 *
 * Le titre ne nomme JAMAIS la page. Ne pas réintroduire de `template` ni de
 * `title` dans une page : ils repasseraient devant.
 */
export async function generateMetadata(): Promise<Metadata> {
  let prefixe = ''
  try {
    const etabId = (await headers()).get('x-etablissement-id')
    if (etabId) {
      const etab = await getCachedEtablissement(etabId).catch(() => null)
      if (etab?.nom) prefixe = `${etab.nom} - `
    }
  } catch {
    // Titre de repli : mieux vaut un onglet sans nom d'école qu'une page en erreur.
  }

  return { ...metadata, title: `${prefixe}Bilal Education` }
}

const metadata: Metadata = {
  title: 'Bilal Education',
  description: 'Bilal Education · Plateforme de gestion administrative et pédagogique pour école arabe et islamique. Suivi des élèves, enseignants, absences, cotisations et bulletins.',
  keywords: ['école arabe', 'école islamique', 'gestion scolaire', 'ERP scolaire', 'Bilal Education', 'suivi élèves', 'gestion pédagogique', 'administration école'],
  openGraph: {
    title: 'Bilal Education',
    description: 'Plateforme de gestion administrative et pédagogique pour école arabe et islamique.',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Bilal Education',
  },
  twitter: {
    card: 'summary',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#18aa99',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Thème avant le rendu (anti-FOUC). Appliqué sur /dashboard ET /auth (2FA) :
            dès la 2FA l'utilisateur est identifié, donc son thème s'applique.
            /login reste toujours clair (on ne sait pas encore qui se connecte). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=location.pathname;var a=p.indexOf('/dashboard')===0||p.indexOf('/auth')===0;var t=a&&localStorage.getItem('theme')==='dark'?'dark':'light';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${arabic.variable}`}>
        <TitreFenetre />
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  )
}
