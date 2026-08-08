/**
 * Gabarits d'email de Supabase Auth — SOURCE UNIQUE.
 *
 * ┌─ POURQUOI UN GÉNÉRATEUR POUR TROIS FICHIERS ────────────────────────────┐
 * │ Les gabarits se collent à la main dans le tableau de bord Supabase, et  │
 * │ celui-ci n'a pas de notion de fragment partagé : chaque gabarit doit    │
 * │ être un document HTML complet. En-tête, pied et styles seraient donc    │
 * │ recopiés trois fois — exactement le motif qui a produit, dans ce        │
 * │ projet, un calcul comptable faux dans deux écrans sur trois parce que   │
 * │ seul le premier avait été corrigé.                                     │
 * │                                                                         │
 * │ Ici la coque n'existe qu'une fois. `node build.mjs` régénère les trois  │
 * │ fichiers à coller.                                                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CE QUE CES EMAILS SONT, ET NE SONT PAS ────────────────────────────────┐
 * │ Ils portent l'authentification de TOUTES les écoles : les gabarits sont │
 * │ globaux au projet Supabase, pas par établissement. Ils ne touchent pas  │
 * │ aux communications d'une école (devoirs, relances, annonces), qui       │
 * │ partent par le SMTP propre à l'établissement — voir `src/lib/email.ts`. │
 * │                                                                         │
 * │ MARQUE : Bilal Education, jamais le nom de l'école. Décision du 8 août. │
 * │ Le nom de l'école n'est accessible que par `.Data` (métadonnées de      │
 * │ l'utilisateur), donnée qu'il faudrait écrire aux quatre points de       │
 * │ création de compte, rattraper sur les comptes existants, qui ne suivrait│
 * │ pas un changement de nom, et que l'utilisateur peut modifier lui-même.  │
 * │ Surtout : les écoles vivent sur `*.bilaleducation.fr` — l'email et le   │
 * │ domaine d'atterrissage portent donc la même marque, sans dissonance.    │
 * │ Le jour où une école aurait son domaine propre, l'arbitrage s'inverse ; │
 * │ le passage coûte un `{{ if .Data.etablissement_nom }}` dans la coque.   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * CONTRAINTES DU FORMAT EMAIL, qui expliquent le HTML daté ci-dessous :
 *   · mise en page en TABLEAUX — Outlook (moteur Word) ignore flex et grid ;
 *   · styles EN LIGNE — la plupart des clients suppriment les feuilles de style ;
 *   · AUCUNE image distante — Outlook et Gmail les bloquent par défaut pour un
 *     expéditeur inconnu, ce que nous serons au lancement. Le logotype est donc
 *     dessiné en texte et en fonds de cellule : il s'affiche toujours. Il ne
 *     dépend d'aucun hébergement, ce qui compte ici : le domaine racine doit
 *     devenir une vitrine peut-être hébergée ailleurs, une URL d'image posée
 *     dessus casserait le jour de la bascule ;
 *   · `color-scheme: only light` — sans cela Apple Mail et Gmail inversent les
 *     couleurs en thème sombre et massacrent un fond de marque foncé.
 *
 * VARIABLES (vérifiées dans la documentation Supabase, le 8 août) :
 *   · `.ConfirmationURL`, `.TokenHash`, `.SiteURL`, `.RedirectTo`, `.Email`,
 *     `.Data` — dans tous les emails d'authentification ;
 *   · `.OldEmail` — SEULEMENT dans « Email address changed ».
 *   Ne rien inventer d'autre : une variable inconnue s'affiche vide, sans erreur.
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))

// ─── Charte ──────────────────────────────────────────────────────────────────
// Valeurs reprises de `tailwind.config.ts` et des jetons de `globals.css`.
// Aucune couleur inventée : un email qui dérive de la charte se remarque.
const C = {
  fond:        '#f0ece8', // warm-100
  carte:       '#ffffff',
  marque:      '#0c5b51', // --brand-surface
  accent:      '#ffb800', // amber-400 — l'accent du logotype dans l'application
  bouton:      '#18aa99', // primary-500
  encre:       '#1f2e35', // --ink (secondary-800)
  encreDouce:  '#786d64', // --ink-muted (warm-700)
  filet:       '#f0ece8', // --line (warm-100)
  alerteFond:  '#fff8e6', // amber-50
  alerteEncre: '#996100', // amber-700
  tuile:       '#18aa99', // primary-500
}

const POLICE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const CONTACT = 'contact@bilaleducation.fr'

// ─── Coque commune ───────────────────────────────────────────────────────────

/**
 * @param {object} o
 * @param {string} o.titre        Titre affiché dans la carte (h1).
 * @param {string} o.apercu       Ligne de prévisualisation dans la boîte de réception.
 * @param {string} o.corps        Contenu HTML de la carte.
 */
function coque({ titre, apercu, corps }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Verrouille le rendu en clair : sans cela, le thème sombre de Gmail et
       d'Apple Mail réécrit les couleurs et détruit le bandeau de marque. -->
  <meta name="color-scheme" content="only light">
  <meta name="supported-color-schemes" content="only light">
  <title>${titre}</title>
</head>
<body style="margin:0; padding:0; background-color:${C.fond};">

  <!-- Ligne d'aperçu : ce que la boîte de réception affiche à côté de l'objet.
       Sans elle, elle y montre le premier texte trouvé dans le HTML. -->
  <div style="display:none; font-size:1px; color:${C.fond}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
    ${apercu}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${C.fond};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="width:100%; max-width:600px;">

          <!-- Bandeau de marque -->
          <tr>
            <td style="background-color:${C.marque}; border-radius:16px 16px 0 0; padding:22px 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="38" style="vertical-align:middle;">
                    <!-- Logotype dessiné, pas une image : voir l'en-tête du générateur. -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="38" height="38" align="center" bgcolor="${C.tuile}" style="border-radius:10px; font-family:${POLICE}; font-size:21px; font-weight:700; color:#ffffff; line-height:38px;">B</td>
                      </tr>
                    </table>
                  </td>
                  <td style="padding-left:12px; vertical-align:middle; font-family:${POLICE}; font-size:17px; font-weight:700; letter-spacing:0.4px; color:#ffffff; white-space:nowrap;">
                    BILAL <span style="color:${C.accent};">EDUCATION</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Carte -->
          <tr>
            <td style="background-color:${C.carte}; border-radius:0 0 16px 16px; padding:32px;">
              <h1 style="margin:0 0 16px 0; font-family:${POLICE}; font-size:19px; font-weight:700; color:${C.encre};">${titre}</h1>
${corps}
            </td>
          </tr>

          <!-- Pied -->
          <tr>
            <td style="padding:20px 32px 0 32px; font-family:${POLICE}; font-size:11px; line-height:1.6; color:${C.encreDouce};">
              Message automatique &middot; Bilal Education &middot; Gestion administrative et pédagogique<br>
              Une question ? <a href="mailto:${CONTACT}" style="color:${C.encreDouce}; text-decoration:underline;">${CONTACT}</a>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`
}

// ─── Fragments réutilisables ─────────────────────────────────────────────────

const p = (html) =>
  `              <p style="margin:0 0 14px 0; font-family:${POLICE}; font-size:14px; line-height:1.65; color:${C.encre};">${html}</p>`

const pDoux = (html) =>
  `              <p style="margin:0 0 14px 0; font-family:${POLICE}; font-size:13px; line-height:1.6; color:${C.encreDouce};">${html}</p>`

/** Bouton en tableau : Outlook ignore le remplissage posé sur un lien seul. */
const bouton = (url, libelle) =>
  `              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:22px 0;">
                <tr>
                  <td align="center" bgcolor="${C.bouton}" style="border-radius:10px;">
                    <a href="${url}" style="display:inline-block; padding:13px 30px; font-family:${POLICE}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">${libelle}</a>
                  </td>
                </tr>
              </table>`

/** Encadré d'alerte : « ce n'était pas vous ? ». */
const alerte = (html) =>
  `              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 0 0;">
                <tr>
                  <td style="background-color:${C.alerteFond}; border-radius:10px; padding:14px 16px; font-family:${POLICE}; font-size:13px; line-height:1.6; color:${C.alerteEncre};">${html}</td>
                </tr>
              </table>`

const filet =
  `              <div style="border-top:1px solid ${C.filet}; margin:22px 0 16px 0;"></div>`

// ─── Les trois gabarits ──────────────────────────────────────────────────────

const GABARITS = [
  {
    fichier: 'reset-password.html',
    /** Où le coller. */
    emplacement: 'Authentication → Emails → Templates → Reset Password',
    objet: 'Définissez votre mot de passe Bilal Education',
    contenu: coque({
      titre: 'Définissez votre mot de passe',
      apercu: 'Un lien valable une heure pour définir le mot de passe de votre compte.',
      corps: [
        // Nommer le compte concerné : c'est ce qui rend une erreur de
        // destinataire immédiatement visible, plutôt qu'un « votre compte »
        // que chacun rapporte au sien.
        p('Une demande a été faite pour le compte <strong style="color:' + C.encre + ';">{{ .Email }}</strong>.'),
        p('Cliquez ci-dessous pour choisir votre mot de passe. Vous serez ramené sur l\'espace de votre établissement.'),
        bouton('{{ .ConfirmationURL }}', 'Définir mon mot de passe'),
        // Le délai doit rester en accord avec le réglage Supabase
        // « Email OTP expiration ». Voir le README.
        pDoux('Ce lien est valable <strong>une heure</strong> et ne peut servir qu\'une seule fois. Passé ce délai, demandez-en un nouveau depuis l\'écran de connexion, par « Mot de passe oublié ».'),
        // Repli texte : certains clients réécrivent ou tronquent les liens.
        // Groupé avec la note d'expiration — les deux parlent du lien, les
        // séparer d'un filet suggérerait à tort deux sujets distincts.
        pDoux('Le bouton ne fonctionne pas ? Copiez cette adresse dans votre navigateur :<br><span style="word-break:break-all;">{{ .ConfirmationURL }}</span>'),
        filet,
        alerte('<strong>Vous n\'avez rien demandé ?</strong> Ignorez ce message : sans clic, votre mot de passe actuel reste inchangé. Si vous recevez plusieurs demandes de ce type, prévenez la direction de votre établissement.'),
      ].join('\n'),
    }),
  },

  {
    fichier: 'password-changed.html',
    emplacement: 'Authentication → Emails → Templates → Password changed',
    objet: 'Le mot de passe de votre compte a été modifié',
    contenu: coque({
      titre: 'Mot de passe modifié',
      apercu: 'Le mot de passe de votre compte vient d\'être modifié.',
      corps: [
        p('Le mot de passe du compte <strong style="color:' + C.encre + ';">{{ .Email }}</strong> vient d\'être modifié.'),
        p('Si vous êtes à l\'origine de cette modification, il n\'y a rien à faire : ce message n\'est qu\'une confirmation.'),
        filet,
        // C'est la RAISON D'ÊTRE de cette notification : prévenir celui qui n'a
        // rien fait. Le chemin d'escalade doit donc être explicite et interne —
        // la direction peut réinitialiser un accès, nous ne le pouvons pas
        // depuis l'extérieur.
        alerte('<strong>Vous n\'êtes pas à l\'origine de ce changement ?</strong> Votre accès est peut-être compromis. Prévenez sans attendre la direction de votre établissement : elle peut réinitialiser votre mot de passe et vérifier votre compte.'),
      ].join('\n'),
    }),
  },

  {
    fichier: 'email-changed.html',
    emplacement: 'Authentication → Emails → Templates → Email address changed',
    objet: 'L\'adresse de connexion de votre compte a changé',
    contenu: coque({
      titre: 'Adresse de connexion modifiée',
      apercu: 'L\'adresse servant à vous connecter a été modifiée.',
      corps: [
        // `.OldEmail` n'existe QUE dans ce gabarit. `.Email` porte l'adresse
        // courante, donc la nouvelle.
        p('L\'adresse de connexion de votre compte a été modifiée. Vous vous connectez désormais avec <strong style="color:' + C.encre + ';">{{ .Email }}</strong>, en remplacement de {{ .OldEmail }}.'),
        p('Votre mot de passe, lui, n\'a pas changé.'),
        filet,
        // Chez nous une adresse ne se change QUE par une action
        // d'administrateur (fiche utilisateur, ou console de l'éditeur pendant
        // une intervention) : l'intéressé n'en est donc jamais l'auteur, et le
        // message ne doit pas lui suggérer le contraire.
        alerte('<strong>Ce changement vous surprend ?</strong> Une adresse de connexion ne peut être modifiée que par un administrateur de votre établissement. Contactez la direction pour en vérifier la raison.'),
      ].join('\n'),
    }),
  },
]

// ─── Écriture ────────────────────────────────────────────────────────────────

for (const g of GABARITS) {
  writeFileSync(join(ICI, g.fichier), g.contenu, 'utf8')
  console.log(`  ${g.fichier.padEnd(24)} → ${g.emplacement}`)
  console.log(`  ${''.padEnd(24)}   objet : ${g.objet}`)
}
console.log(`\n${GABARITS.length} gabarits générés.`)
