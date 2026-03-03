import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bilal Education - Gestion Adminitrative & Pédagogique',
  description: 'Application de gestion complète pour école',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Amiri+Typewriter:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
