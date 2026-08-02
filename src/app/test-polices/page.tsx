// PAGE DE TEST TEMPORAIRE — comparaison des polices arabes.
// À SUPPRIMER une fois la police choisie (avec sa route `src/app/test-polices/`).
// Les polices sont chargées comme celles de l'application : `next/font/google`,
// donc ce que tu vois ici est exactement ce que rendra l'interface.

import { Amiri, Noto_Sans_Arabic, Cairo, Tajawal, IBM_Plex_Sans_Arabic } from 'next/font/google'

const amiri = Amiri({ subsets: ['arabic'], weight: ['400', '700'] })
const noto = Noto_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '700'] })
const cairo = Cairo({ subsets: ['arabic'], weight: ['400', '700'] })
const tajawal = Tajawal({ subsets: ['arabic'], weight: ['400', '700'] })
const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '700'] })

const FONTS = [
  { key: 'noto',  nom: 'Noto Sans Arabic',      famille: 'Sans neutre',      note: 'Référence de fait (Android, ChromeOS, Windows)', cls: noto.className },
  { key: 'cairo', nom: 'Cairo',                 famille: 'Sans moderne',     note: 'Très répandue sur le web arabophone',            cls: cairo.className },
  { key: 'taj',   nom: 'Tajawal',               famille: 'Sans géométrique', note: 'Interfaces modernes',                            cls: tajawal.className },
  { key: 'plex',  nom: 'IBM Plex Sans Arabic',  famille: 'Sans technique',   note: 'Documentation, interfaces produit',              cls: plex.className },
  { key: 'amiri', nom: 'Amiri (actuelle)',      famille: 'Naskh serif',      note: 'Conçue pour l’imprimé, pas pour l’écran',        cls: amiri.className },
]

// Chaînes réellement rencontrées dans le référentiel des cours.
const MATIERE = 'اللغة العربية'
const PHRASE  = 'قواعد القراءة والكتابة للمستوى الابتدائي'
const CHIFFRES = '١٢٣٤٥٦٧٨٩٠ · 1234567890'

function Bloc({ dark }: { dark: boolean }) {
  return (
    <div
      data-theme={dark ? 'dark' : 'light'}
      style={{
        background: dark ? '#161f24' : '#ffffff',
        color: dark ? '#e7eef0' : '#1f2e35',
        border: `1px solid ${dark ? '#2c3a42' : '#e7e1da'}`,
        borderRadius: 12, padding: 20, flex: '1 1 480px', minWidth: 0,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                  color: dark ? '#93a2a8' : '#786d64', marginBottom: 14 }}>
        Thème {dark ? 'sombre' : 'clair'}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${dark ? '#2c3a42' : '#e7e1da'}` }}>
            {['Police', 'Taille interface (14 px)', 'Agrandie (18 px)'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700,
                                   letterSpacing: '.06em', textTransform: 'uppercase',
                                   color: dark ? '#93a2a8' : '#786d64' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FONTS.map(f => (
            <tr key={f.key} style={{ borderBottom: `1px solid ${dark ? '#243139' : '#f0ece8'}` }}>
              <td style={{ padding: '10px 8px', verticalAlign: 'middle', width: 190 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{f.nom}</div>
                <div style={{ fontSize: 11, color: dark ? '#93a2a8' : '#786d64' }}>{f.famille}</div>
              </td>
              <td dir="rtl" className={f.cls} style={{ padding: '10px 8px', fontSize: 14, verticalAlign: 'middle' }}>
                {MATIERE}
              </td>
              <td dir="rtl" className={f.cls} style={{ padding: '10px 8px', fontSize: 18, verticalAlign: 'middle' }}>
                {MATIERE}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                  color: dark ? '#93a2a8' : '#786d64', margin: '20px 0 8px' }}>
        Phrase et chiffres
      </p>
      {FONTS.map(f => (
        <div key={f.key} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: dark ? '#93a2a8' : '#786d64', marginBottom: 2 }}>{f.nom}</div>
          <div dir="rtl" className={f.cls} style={{ fontSize: 15, lineHeight: 1.7 }}>{PHRASE}</div>
          <div dir="rtl" className={f.cls} style={{ fontSize: 14 }}>{CHIFFRES}</div>
        </div>
      ))}
    </div>
  )
}

export default function TestPolicesPage() {
  return (
    <main style={{ padding: 24, background: '#0e1418', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#e7eef0', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        Comparaison des polices arabes
      </h1>
      <p style={{ color: '#93a2a8', fontSize: 12, marginBottom: 20 }}>
        Page temporaire · à supprimer après le choix. Les polices sont chargées comme dans l’application.
      </p>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Bloc dark={false} />
        <Bloc dark />
      </div>
    </main>
  )
}
