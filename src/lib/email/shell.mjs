/**
 * Coque commune à TOUS les emails — SOURCE UNIQUE.
 *
 * ┌─ DEUX CONSOMMATEURS, UN SEUL FICHIER ───────────────────────────────────┐
 * │ · `supabase/email-templates/build.mjs`, qui génère les gabarits          │
 * │   d'authentification à coller dans le tableau de bord ;                 │
 * │ · le code applicatif (alerte de sécurité, support, relances…), qui       │
 * │   compose ses emails à l'exécution.                                     │
 * │                                                                          │
 * │ Écrit en `.mjs` et non en `.ts` pour cette raison précise : `build.mjs`  │
 * │ est un script Node ordinaire, il ne peut pas importer du TypeScript. Le  │
 * │ projet ayant `allowJs`, l'application l'importe sans difficulté.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * POURQUOI ELLE EXISTE. Au 9 août, chaque email de l'application écrivait son
 * HTML sur place : demande de support, relance de paiement, alerte de
 * changement d'adresse, devoirs, annonces. Cinq mises en forme concurrentes
 * pour un même expéditeur — le motif exact qui avait produit la coque
 * d'authentification recopiée sept fois.
 *
 * CONTRAINTES DU FORMAT, qui expliquent le HTML daté :
 *   · mise en page en TABLEAUX — Outlook s'appuie sur le moteur de Word, qui
 *     ignore `flex` et `grid` ;
 *   · styles EN LIGNE — la plupart des clients suppriment les feuilles de style ;
 *   · UNE SEULE image, le logo, et RIEN qui en dépende — le logotype TEXTUEL
 *     porte seul le bandeau quand elle est bloquée ;
 *   · `color-scheme: only light` — sans lui, le thème sombre de Gmail et
 *     d'Apple Mail réécrit les couleurs et détruit le bandeau de marque.
 */

/** Charte : valeurs reprises de `tailwind.config.ts` et des jetons de `globals.css`. */
export const C = {
  fond:        '#f0ece8', // warm-100
  carte:       '#ffffff',
  marque:      '#0c5b51', // --brand-surface
  accent:      '#ffb800', // amber-400 — l'accent du logotype
  bouton:      '#18aa99', // primary-500
  encre:       '#1f2e35', // --ink (secondary-800)
  encreDouce:  '#786d64', // --ink-muted (warm-700)
  filet:       '#f0ece8', // --line (warm-100)
  alerteFond:  '#fff8e6', // amber-50
  alerteEncre: '#996100', // amber-700
}

export const POLICE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/**
 * Logo du bandeau. Servi par le domaine racine — le fichier doit continuer d'y
 * être servi le jour où la vitrine change d'hébergeur, sinon il disparaît de
 * tous les emails sans le moindre avertissement.
 */
export const LOGO_URL = 'https://bilaleducation.fr/email/logo.png'
export const LOGO_PX = 38

// ─── Fragments ───────────────────────────────────────────────────────────────

/** Paragraphe courant. @param {string} html */
export const p = (html) =>
  `              <p style="margin:0 0 14px 0; font-family:${POLICE}; font-size:14px; line-height:1.65; color:${C.encre};">${html}</p>`

/** Paragraphe secondaire, plus petit et plus clair. @param {string} html */
export const pDoux = (html) =>
  `              <p style="margin:0 0 14px 0; font-family:${POLICE}; font-size:13px; line-height:1.6; color:${C.encreDouce};">${html}</p>`

/** Bouton en TABLEAU : Outlook ignore le remplissage posé sur un lien seul.
 *  @param {string} url @param {string} libelle */
export const bouton = (url, libelle) =>
  `              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:22px 0;">
                <tr>
                  <td align="center" bgcolor="${C.bouton}" style="border-radius:10px;">
                    <a href="${url}" style="display:inline-block; padding:13px 30px; font-family:${POLICE}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">${libelle}</a>
                  </td>
                </tr>
              </table>`

/** Encadré d'alerte — « ce n'était pas vous ? ». @param {string} html */
export const alerte = (html) =>
  `              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 0 0;">
                <tr>
                  <td style="background-color:${C.alerteFond}; border-radius:10px; padding:14px 16px; font-family:${POLICE}; font-size:13px; line-height:1.6; color:${C.alerteEncre};">${html}</td>
                </tr>
              </table>`

export const filet =
  `              <div style="border-top:1px solid ${C.filet}; margin:22px 0 16px 0;"></div>`

/**
 * Tableau clé / valeur — devoir, absence, paiement.
 *
 * Sans bordures : les notifications les dessinaient en gris sur fond gris, ce
 * qui donnait un rendu de tableur. Un filet horizontal discret suffit à aligner
 * l'oeil, et la clé se distingue par sa couleur, pas par une case.
 *
 * @param {Array<[string, string]>} lignes Paires déjà échappées.
 */
export const tableauInfos = (lignes) =>
  `              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 14px 0;">
${lignes.filter(Boolean).map(([cle, valeur]) => `                <tr>
                  <td style="padding:7px 14px 7px 0; border-bottom:1px solid ${C.filet}; font-family:${POLICE}; font-size:13px; color:${C.encreDouce}; white-space:nowrap; vertical-align:top;">${cle}</td>
                  <td style="padding:7px 0; border-bottom:1px solid ${C.filet}; font-family:${POLICE}; font-size:13px; color:${C.encre};">${valeur}</td>
                </tr>`).join('\n')}
              </table>`

// ─── Coque ───────────────────────────────────────────────────────────────────

/**
 * Document complet : bandeau de marque, carte, pied.
 *
 * ┌─ DEUX MARQUES, ET IL NE FAUT PAS LES CONFONDRE ─────────────────────────┐
 * │ · SANS `ecole` — l'expéditeur est l'ÉDITEUR : authentification, alerte   │
 * │   de sécurité, demande de support. Bandeau « BILAL EDUCATION ».         │
 * │                                                                          │
 * │ · AVEC `ecole` — l'expéditeur est l'ÉTABLISSEMENT : relance de           │
 * │   cotisation, annonce aux familles, devoir. Le parent traite avec son    │
 * │   école, le message part par le SMTP de l'école, et son corps porte déjà │
 * │   sa signature. Un bandeau « Bilal Education » y serait faux, et         │
 * │   sèmerait le doute sur l'origine du message.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * @param {object} o
 * @param {string} o.titre   Titre de la carte, et `<title>` du document.
 * @param {string} o.apercu  Ligne de prévisualisation de la boîte de réception.
 * @param {string} o.corps   HTML du contenu (composé avec les fragments).
 * @param {{ nom: string, logoUrl?: string|null, pied?: string|null }} [o.ecole]
 *        Présent = l'établissement signe le message à la place de l'éditeur.
 * @returns {string}
 */
export function coque({ titre, apercu, corps, ecole }) {
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
                  <td width="${LOGO_PX}" style="vertical-align:middle; line-height:0;">
                    <!-- Dimensions déclarées en attribut ET en style : sans elles,
                         un client qui bloque l'image réserve une place au hasard
                         et déforme le bandeau. Texte de remplacement VIDE car le
                         logotype est écrit juste à côté — sinon la marque serait
                         annoncée deux fois, à l'oeil comme au lecteur d'écran.
                         (Aucun accent grave ici : ce bloc vit dans un gabarit de
                         chaine, un seul le refermerait.) -->
                    <img src="${ecole ? (ecole.logoUrl || LOGO_URL) : LOGO_URL}" width="${LOGO_PX}" height="${LOGO_PX}" alt=""
                         style="display:block; width:${LOGO_PX}px; height:${LOGO_PX}px; border:0; outline:none; text-decoration:none; background-color:#ffffff; border-radius:8px;">
                  </td>
                  <td style="padding-left:12px; vertical-align:middle; font-family:${POLICE}; font-size:17px; font-weight:700; letter-spacing:0.4px; color:#ffffff;">
                    ${ecole
                      ? ecole.nom
                      : `BILAL <span style="color:${C.accent};">EDUCATION</span>`}
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
              ${ecole
                // Message d'une ÉCOLE : elle se nomme, et l'éditeur reste en
                // retrait — le destinataire n'a pas affaire à nous.
                ? (ecole.pied || `Message envoyé par ${ecole.nom}.`)
                : `Message automatique &middot; Bilal Education &middot; Gestion administrative et pédagogique<br>
              Une question ? Contacter l'administrateur de votre école.`}
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
