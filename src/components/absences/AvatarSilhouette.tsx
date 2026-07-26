// Silhouettes d'avatar du trombinoscope — affichées quand l'apprenant n'a pas de photo.
//
// Style : silhouette PLEINE d'une seule teinte, tête + épaules coupées par le bas du
// cadre, SANS rectangle de fond (la carte reste visible derrière).
// La teinte vient de `--silhouette-ink`, qui bascule avec le thème : l'ancienne version
// avait des fonds clairs en dur (#eef2f7, #f5eef7) qui « brillaient » sur carte sombre,
// et des teintes bleu-gris / violet hors charte.

const SVG_PROPS = {
  viewBox: '0 0 150 200',
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'var(--silhouette-ink)',
  style: { display: 'block', width: '100%', height: '100%' },
  'aria-hidden': true,
} as const

// Cheveux courts au dessus légèrement ondulé + oreilles dégagées.
export function MaleAvatar({ className }: { className?: string }) {
  return (
    <svg {...SVG_PROPS} className={className}>
      <ellipse cx="39" cy="86" rx="6" ry="9" />
      <ellipse cx="111" cy="86" rx="6" ry="9" />
      <path d="M40 84C39 70 39 56 42 46C45 34 51 26 59 24C63 19 69 18 75 21C81 18 87 19 91 24C99 26 105 34 108 46C111 56 111 70 110 84C108 100 99 112 88 118C84 120 79 121 75 121C71 121 66 120 62 118C51 112 42 100 40 84Z" />
      <path d="M64 114H86V140C86 148 64 148 64 140Z" />
      <path d="M75 138C40 138 8 165 8 200H142C142 165 110 138 75 138Z" />
    </svg>
  )
}

// Masse de cheveux longs ondulés : un seul tracé, ni oreilles ni cou visibles.
export function FemaleAvatar({ className }: { className?: string }) {
  return (
    <svg {...SVG_PROPS} className={className}>
      <path d="M75 20C49 20 32 41 32 78C32 97 29 113 25 129C21 145 23 159 29 169C22 180 19 191 19 200H131C131 191 128 180 121 169C127 159 129 145 125 129C121 113 118 97 118 78C118 41 101 20 75 20Z" />
    </svg>
  )
}

// Genre non renseigné : mêmes proportions, crâne lisse et sans oreilles.
export function DefaultAvatar({ className }: { className?: string }) {
  return (
    <svg {...SVG_PROPS} className={className}>
      <path d="M40 84C39 70 39 56 42 46C46 32 58 22 75 22C92 22 104 32 108 46C111 56 111 70 110 84C108 100 99 112 88 118C84 120 79 121 75 121C71 121 66 120 62 118C51 112 42 100 40 84Z" />
      <path d="M64 114H86V140C86 148 64 148 64 140Z" />
      <path d="M75 138C40 138 8 165 8 200H142C142 165 110 138 75 138Z" />
    </svg>
  )
}
