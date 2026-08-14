import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { ToastProvider } from '@/lib/toast-context'
import { ToastContainer } from '@/components/ui/Toast'
import { validateEnv } from '@/lib/env'
import { headers } from 'next/headers'
import { getEtablissement } from '@/lib/cache/dashboard'
import TitreFenetre from '@/components/layout/TitreFenetre'

// Valider les variables d'environnement au démarrage
validateEnv()

// ─── Polices, HEBERGEES DANS LE DEPOT ────────────────────────────────────────
//
// ┌─ POURQUOI PAS `next/font/google` ────────────────────────────────────────┐
// │ Il TELECHARGE les polices PENDANT le build. Quand cet appel echoue chez  │
// │ Vercel — ce qui est arrive deux jours de suite — le build s'effondre sur │
// │ un message trompeur :                                                     │
// │                                                                           │
// │   inter_xxx.module.css: Can't resolve                                     │
// │   '@vercel/turbopack-next/internal/font/google/font'                      │
// │                                                                           │
// │ Il se lit comme un import casse et n'a rien a voir avec le code pousse :  │
// │ Next a genere un CSS pointant vers un module interne qu'il ne peut plus   │
// │ resoudre faute d'avoir recu la police. On cherche donc le defaut dans son │
// │ propre commit, ou il n'est pas.                                           │
// │                                                                           │
// │ Les deux fichiers vivent desormais dans le depot : le build ne fait plus  │
// │ AUCUN appel reseau pour les polices, et ce mode de panne disparait.       │
// └───────────────────────────────────────────────────────────────────────────┘
//
// Ce sont les MEMES fichiers que servait Google, aux memes sous-ensembles, et
// ce sont des polices VARIABLES : un seul fichier couvre 400 a 700, la ou il en
// aurait fallu quatre en graisses fixes.
//
// `unicode-range` est conserve tel que Google le declarait : sans lui, le
// navigateur telechargerait la police arabe (166 Ko) sur des pages qui n'en
// affichent pas un seul caractere.
//
// A NE PAS CONFONDRE avec `public/fonts/NotoSansArabic-*.ttf`, qui sert au PDF
// bilingue : jsPDF a besoin d'un TTF recuperable par URL a l'execution, ces
// woff2-ci sont empreintes et servis par Next. Les deux coexistent a dessein.

const inter = localFont({
  src: './fonts/Inter-latin.woff2',
  weight: '400 700',
  variable: '--font-inter',
  display: 'swap',
  declarations: [{
    prop: 'unicode-range',
    value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  }],
})

// Noto Sans Arabic : sans arabe de reference (Android, ChromeOS, Windows),
// proportions proches d'Inter. Sous-ensemble ARABE seul : le latin reste rendu
// par Inter.
const arabic = localFont({
  src: './fonts/NotoSansArabic-arabic.woff2',
  weight: '400 700',
  variable: '--font-arabic',
  display: 'swap',
  declarations: [{
    prop: 'unicode-range',
    value: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EE03, U+1EE05-1EE1F, U+1EE21-1EE22, U+1EE24, U+1EE27, U+1EE29-1EE32, U+1EE34-1EE37, U+1EE39, U+1EE3B, U+1EE42, U+1EE47, U+1EE49, U+1EE4B, U+1EE4D-1EE4F, U+1EE51-1EE52, U+1EE54, U+1EE57, U+1EE59, U+1EE5B, U+1EE5D, U+1EE5F, U+1EE61-1EE62, U+1EE64, U+1EE67-1EE6A, U+1EE6C-1EE72, U+1EE74-1EE77, U+1EE79-1EE7C, U+1EE7E, U+1EE80-1EE89, U+1EE8B-1EE9B, U+1EEA1-1EEA3, U+1EEA5-1EEA9, U+1EEAB-1EEBB, U+1EEF0-1EEF1',
  }],
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
      const etab = await getEtablissement(etabId).catch(() => null)
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
