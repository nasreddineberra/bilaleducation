// `require` et non `import` : ce fichier est charge en CommonJS par Next, et le
// projet a DELIBEREMENT refuse `"type": "module"` (03/10) — il basculerait tous
// les `.js` du depot. La regle ne s'applique donc pas ici.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createHash } = require('node:crypto')

// ── IDENTIFIANT DE BUILD, pour detecter un client perime ────────────────────
//
// Next donne a chaque server action un identifiant PROPRE AU BUILD, embarque
// dans le bundle du navigateur. Apres un deploiement, un onglet reste ouvert
// cite un identifiant que la nouvelle version ne connait plus : React leve
// « An unexpected response was received from the server. », nos `catch`
// l'affichent, et l'utilisateur croit avoir perdu sa saisie (vecu le 06/10).
//
// Cette constante est inlinee A LA COMPILATION des DEUX cotes — dans le bundle
// navigateur et dans la route `/api/version`. Un client ancien porte donc
// l'ancienne valeur pendant que la route rend la nouvelle : l'ecart se voit.
//
// HACHEE : la valeur brute est un SHA de commit. Le hacher ne coute rien et
// evite d'exposer l'historique d'un depot prive dans une page publique.
//
// HORS VERCEL, LA VALEUR EST LA CONSTANTE `dev`, ET CE N'EST PAS UNE FACILITE.
// Un `Date.now()` donnerait une valeur DIFFERENTE A CHAQUE EVALUATION de ce
// fichier — or rien ne garantit que Next ne l'evalue qu'une fois (compilateur
// navigateur, compilateur serveur). Client et route porteraient alors deux
// valeurs distinctes, et la banniere s'afficherait EN PERMANENCE en local.
// Une constante rend ce faux positif impossible, et la detection n'a de sens
// qu'en production, ou l'on deploie.
const source = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID
const BUILD_ID = source
  ? createHash('sha256').update(source).digest('hex').slice(0, 12)
  : 'dev'

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },

  // jsdom (sanitisation HTML au SSR) reste un module externe côté serveur :
  // chargé depuis node_modules à l'exécution, jamais bundlé. Côté navigateur,
  // il est neutralisé via le champ "browser" du package.json (window natif suffit).
  serverExternalPackages: ['jsdom'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // ── Protection clickjacking ──────────────────────────────────
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // ── Empêche le MIME sniffing ─────────────────────────────────
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // ── Contrôle du Referer ──────────────────────────────────────
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // ── APIs navigateur : camera=(self) pour la photo élève, le reste bloqué ─
          {
            key: 'Permissions-Policy',
            value: [
              'camera=(self)',
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'bluetooth=()',
              'accelerometer=()',
              'gyroscope=()',
              'magnetometer=()',
              'screen-wake-lock=()',
            ].join(', '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
