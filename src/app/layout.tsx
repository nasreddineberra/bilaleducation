import type { Metadata, Viewport } from 'next'
import { Inter, Amiri } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/lib/toast-context'
import { ToastContainer } from '@/components/ui/Toast'
import { validateEnv } from '@/lib/env'

// Valider les variables d'environnement au démarrage
validateEnv()

// ─── Google Fonts (self-hosted via Next.js) ──────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Bilal Education',
    template: '%s | Bilal Education',
  },
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
      <body className={`${inter.variable} ${amiri.variable}`}>
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  )
}
