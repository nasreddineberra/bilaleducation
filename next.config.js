/** @type {import('next').NextConfig} */
const nextConfig = {
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
