'use client'

// Avatar silhouette style — gris clair, inspiré du style classique profil M/F

export function MaleAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#f0f0f0" />
      <g fill="#c8c8c8">
        {/* Tete */}
        <ellipse cx="100" cy="78" rx="32" ry="36" />
        {/* Cheveux courts */}
        <ellipse cx="100" cy="60" rx="34" ry="22" />
        {/* Epaules / buste */}
        <ellipse cx="100" cy="200" rx="72" ry="70" />
      </g>
    </svg>
  )
}

export function FemaleAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#f0f0f0" />
      <g fill="#c8c8c8">
        {/* Cheveux longs */}
        <ellipse cx="100" cy="72" rx="42" ry="46" />
        <rect x="58" y="72" width="84" height="40" rx="6" />
        {/* Tete */}
        <ellipse cx="100" cy="78" rx="30" ry="34" fill="#d4d4d4" />
        {/* Epaules / buste */}
        <ellipse cx="100" cy="200" rx="68" ry="68" />
      </g>
    </svg>
  )
}

export function DefaultAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#f0f0f0" />
      <g fill="#c8c8c8">
        <ellipse cx="100" cy="78" rx="30" ry="34" />
        <ellipse cx="100" cy="200" rx="68" ry="68" />
      </g>
    </svg>
  )
}
