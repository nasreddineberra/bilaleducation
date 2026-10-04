'use client'

import { createContext, useContext, useState } from 'react'

/**
 * DEUX ETATS DISTINCTS, et il ne faut jamais les confondre :
 *
 *  - `collapsed`    : le mode REDUIT du grand ecran (92 px, grille d icones).
 *                     Choix de confort, pris par l utilisateur au clic.
 *  - `ouvertMobile` : le TIROIR du petit ecran (sous 1024 px), ou la barre
 *                     sort du flux et se superpose au contenu.
 *
 * Les melanger donnerait un tiroir de 92 px, illisible : sur un telephone on
 * veut la barre COMPLETE, libellees comprises. Le mode reduit n a de sens que
 * la ou la barre partage la largeur avec le contenu.
 */
interface SidebarContextValue {
  collapsed:       boolean
  setCollapsed:    (v: boolean | ((prev: boolean) => boolean)) => void
  ouvertMobile:    boolean
  setOuvertMobile: (v: boolean | ((prev: boolean) => boolean)) => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed:       false,
  setCollapsed:    () => {},
  ouvertMobile:    false,
  setOuvertMobile: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]       = useState(false)
  // Ferme par defaut : sur un petit ecran, le contenu demande doit s afficher,
  // pas un menu qu il faudrait d abord refermer.
  const [ouvertMobile, setOuvertMobile] = useState(false)

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, ouvertMobile, setOuvertMobile }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
