import { defineConfig } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/**
 * Configuration ESLint « plate », celle qu'attend ESLint 9.
 *
 * `next lint` a disparu en Next 16 (le 15 juillet, le script `lint` a cesse de
 * fonctionner) : le projet n'a plus ete linte pendant deux mois. Seuls
 * `type-check` et le build faisaient garde, et TypeScript ne voit ni une
 * variable inutilisee, ni un `useEffect` aux dependances fausses.
 *
 * Les deux jeux de regles sont ceux que `next lint` appliquait : Core Web
 * Vitals (React, hooks, accessibilite, images) et TypeScript.
 *
 * ── ARBITRAGES DU 16 SEPTEMBRE (premier passage : 695 signalements) ────────
 *
 * Une regle en ERREUR bloque ; en AVERTISSEMENT elle reste visible. Le but est
 * un `npm run lint` qui rend 0 erreur et devienne une garde, pas une liste de
 * 600 lignes que personne ne lit.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'next-env.d.ts',
      // Sorties et scripts hors application
      'public/**',
      'supabase/**',
      'scripts/**',
    ],
  },
  {
    rules: {
      // 503 occurrences : un chantier a part entiere, pas un passage de lint.
      // Visible, non bloquant, pour ne pas en ajouter.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Signale chaque apostrophe d'un texte JSX en francais (« l'eleve »).
      // JSX les accepte ; la regle vise des fautes de frappe sur `>` et `}`
      // que TypeScript attrape deja.
      'react/no-unescaped-entities': 'off',

      // `setState` synchrone dans un effet. Les 13 cas ont ete LUS UN PAR UN le
      // 16 septembre, tous deliberes : 6 hydratations depuis `sessionStorage`
      // (motif du 16 juillet, un ref ne suffisait pas), 3 lectures de `window`
      // apres montage (hostname, parametre d'URL, capacite push — impossibles au
      // rendu serveur), 1 garde de portail, 2 reinitialisations de selection
      // (saisie des notes), 1 champ de recherche semi-controle (16 aout). La
      // regle vise les rendus en cascade du React Compiler, non active ici.
      'react-hooks/set-state-in-effect': 'off',

      // Avis du React Compiler, qui n'est PAS active sur ce projet : sans lui,
      // une memoisation manuelle « non preservable » n'a aucun effet.
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
])
