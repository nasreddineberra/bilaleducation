'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { setOwnTheme } from '@/app/dashboard/mon-compte/actions'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme:  Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {} })

/**
 * Thème de l'interface (clair/sombre) — réservé au dashboard.
 *
 * Source de vérité = `profiles.theme` (passé en `initialTheme` par le layout) :
 * la préférence suit l'utilisateur d'un poste à l'autre. `localStorage` sert de
 * chemin rapide pour le script anti-FOUC du layout racine, qui peint la bonne
 * couleur avant le rendu sur le poste habituel.
 */
export function ThemeProvider({
  children,
  initialTheme = 'light',
}: {
  children: React.ReactNode
  initialTheme?: Theme
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  // Aligne l'affichage et le cache local sur la préférence du profil (cas d'un
  // nouveau navigateur, ou d'un choix fait depuis un autre poste).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', initialTheme)
    try { localStorage.setItem('theme', initialTheme) } catch { /* stockage indispo */ }
    setTheme(initialTheme)
  }, [initialTheme])

  const toggle = () => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      try { localStorage.setItem('theme', next) } catch { /* stockage indispo */ }
      // Persistance sur le profil (non bloquant : l'affichage a déjà basculé).
      void setOwnTheme(next)
      return next
    })
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
