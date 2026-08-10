/**
 * REGENERE LES QUATRE DECLINAISONS DU LOGO A PARTIR DU MASTER.
 *
 *   node scripts/generer-logos.mjs
 *
 * ┌─ POURQUOI UN SCRIPT ────────────────────────────────────────────────────┐
 * │ Le 3 aout, `apple-icon.png` avait ete fabrique a la main depuis          │
 * │ `icon.png`, lui-meme deja reduit a 512 px : on derivait d'une copie, et  │
 * │ les geometries (plaque, marges) ne vivaient que dans un README. Au       │
 * │ changement de logo suivant il a fallu les REMESURER sur les fichiers     │
 * │ existants pour ne pas les perdre.                                       │
 * │                                                                          │
 * │ Tout part desormais du master `assets/logo-source.png`, et les chiffres  │
 * │ sont ici. Changer de logo = remplacer le master, relancer ce script.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * A LANCER DEPUIS LA RACINE DU PROJET : ailleurs, Node n'y resout pas
 * `node_modules` et ne trouve pas `sharp`.
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const MASTER = 'assets/logo-source.png'

/**
 * Geometrie des plaques, MESUREE sur les fichiers du 8 aout et exprimee en
 * proportion du cote — les deux tailles existantes suivaient exactement le
 * meme rapport, ce sont donc bien des regles et non deux valeurs choisies au
 * coup par coup.
 */
const RAYON_PLAQUE = 0.263   // 20 px pour 76 · 32 px pour 120
const MARGE_PLAQUE = 0.132   // 10 px pour 76 · 16 px pour 120

/**
 * Le dessin n'est pas carre, les quatre sorties le sont. On le CENTRE dans un
 * carre transparent plutot que de le recadrer : un recadrage automatique
 * rognerait le dessin sans que personne ne l'ait decide.
 */
async function carre() {
  const m = await sharp(MASTER).metadata()
  const cote = Math.max(m.width, m.height)
  return sharp({
    create: { width: cote, height: cote, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{
      input: MASTER,
      left: Math.round((cote - m.width) / 2),
      top: Math.round((cote - m.height) / 2),
    }])
    .png()
    .toBuffer()
}

/**
 * Plaque blanche arrondie, logo insere au centre.
 *
 * La plaque n'est pas decorative : l'interieur de l'hexagone et le pourtour du
 * dessin sont TRANSPARENTS. Pose nu sur le bandeau teal d'un email ou sur
 * l'ecran d'accueil d'un iPhone, il se remplirait de la couleur du fond — noir
 * dans les themes sombres. Un logo est dessine pour un fond blanc.
 */
async function plaque(source, cote) {
  const rayon = Math.round(cote * RAYON_PLAQUE)
  const marge = Math.round(cote * MARGE_PLAQUE)
  const interieur = cote - marge * 2

  const fond = Buffer.from(
    `<svg width="${cote}" height="${cote}"><rect width="${cote}" height="${cote}" rx="${rayon}" ry="${rayon}" fill="#ffffff"/></svg>`,
  )
  const logo = await sharp(source)
    .resize({ width: interieur, height: interieur, fit: 'inside' })
    .png()
    .toBuffer()
  const lm = await sharp(logo).metadata()

  return sharp(fond)
    .composite([{
      input: logo,
      left: Math.round((cote - lm.width) / 2),
      top: Math.round((cote - lm.height) / 2),
    }])
    .png()
    .toBuffer()
}

const src = await carre()

await mkdir('public/email', { recursive: true })

// Favicon, manifeste, barre laterale, ecrans d'authentification, console.
// TRANSPARENT : il se pose aussi bien sur le teal de la marque que sur blanc.
await sharp(src).resize(512, 512).png().toFile('src/app/icon.png')

// iOS ignore la couche alpha et la remplit de NOIR : on aplatit nous-memes,
// sur blanc, mesure et non devinee (le dessin se lit mieux sur clair).
await sharp(src).resize(180, 180).flatten({ background: '#ffffff' }).png().toFile('src/app/apple-icon.png')

// Emails : produits au DOUBLE de leur taille d'affichage (38 px et 60 px),
// pour rester nets sur les ecrans a forte densite.
await sharp(await plaque(src, 76)).toFile('public/email/logo.png')
await sharp(await plaque(src, 120)).toFile('public/email/logo-signature.png')

for (const f of [
  'src/app/icon.png',
  'src/app/apple-icon.png',
  'public/email/logo.png',
  'public/email/logo-signature.png',
]) {
  const m = await sharp(f).metadata()
  console.log(`${f.padEnd(32)} ${m.width}x${m.height}  alpha=${m.hasAlpha}`)
}
