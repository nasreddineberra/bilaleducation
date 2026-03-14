'use client'

// Avatar silhouette moderne — style épuré, profil M/F

export function MaleAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }}>
      <rect width="150" height="200" fill="#eef2f7" />
      <circle cx="75" cy="68" r="30" fill="#b0bec5" />
      <path d="M45 64 C45 44 58 32 75 32 C92 32 105 44 105 64 C105 54 94 46 75 46 C56 46 45 54 45 64Z" fill="#9aa8b2" />
      <rect x="64" y="94" width="22" height="14" rx="4" fill="#b0bec5" />
      <path d="M75 108 C38 108 10 140 10 178 L10 200 L140 200 L140 178 C140 140 112 108 75 108Z" fill="#b0bec5" />
    </svg>
  )
}

export function FemaleAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }}>
      <rect width="150" height="200" fill="#f5eef7" />
      <path d="M30 70 C30 36 50 22 75 22 C100 22 120 36 120 70 L120 116 C120 122 116 126 112 126 L38 126 C34 126 30 122 30 116Z" fill="#c5a8ce" />
      <circle cx="75" cy="68" r="28" fill="#c9b2d1" />
      <rect x="65" y="92" width="20" height="14" rx="4" fill="#c9b2d1" />
      <path d="M75 106 C38 106 10 138 10 174 L10 200 L140 200 L140 174 C140 138 112 106 75 106Z" fill="#c5a8ce" />
    </svg>
  )
}

export function DefaultAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }}>
      <rect width="150" height="200" fill="#f0f0f0" />
      <circle cx="75" cy="68" r="28" fill="#b8b8b8" />
      <rect x="65" y="92" width="20" height="14" rx="4" fill="#b8b8b8" />
      <path d="M75 106 C38 106 10 138 10 174 L10 200 L140 200 L140 174 C140 138 112 106 75 106Z" fill="#b8b8b8" />
    </svg>
  )
}
