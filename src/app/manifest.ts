import type { MetadataRoute } from 'next'

/**
 * Manifeste d'application.
 *
 * Sans lui, l'application ne peut pas être INSTALLÉE sur un téléphone — or
 * c'est le contexte où l'icône sert le plus, et le service worker
 * (`public/sw.js`) comme les notifications push sont déjà en place.
 *
 * `theme_color` habille la barre système de l'appareil. Le manifeste ne connaît
 * qu'une seule valeur : on y met la surface de marque du thème CLAIR. Le thème
 * sombre reste piloté dans l'application par `data-theme`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bilal Education',
    short_name: 'Bilal',
    description:
      'Plateforme de gestion administrative et pédagogique pour école arabe et islamique.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    background_color: '#faf8f6',   // --surface-page (thème clair)
    theme_color: '#0c5b51',        // --brand-surface (thème clair)
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
