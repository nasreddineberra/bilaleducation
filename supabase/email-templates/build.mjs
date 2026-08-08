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
 *   · UNE SEULE image, le logo, et RIEN qui en dépende — Gmail et Apple Mail
 *     affichent les images distantes ; Outlook de bureau les bloque tant que
 *     l'expéditeur n'est pas dans les contacts. Le logotype TEXTUEL porte donc
 *     seul le bandeau quand l'image manque, et aucune information n'est confiée
 *     à une image. Voir `LOGO_URL` ;
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
import { C, coque, p, pDoux, bouton, alerte, filet } from '../../src/lib/email/shell.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))

// La charte, les fragments et la coque vivent dans `src/lib/email/shell.mjs`,
// partages avec le code applicatif : un seul endroit pour le bandeau, la carte
// et le pied. Voir l'en-tete de ce module.
//
// Ne restent ici que les deux constantes PROPRES aux gabarits Supabase.

/**
 * Duree de validite ANNONCEE au destinataire.
 *
 * CE N'EST PAS UNE FORMULE, C'EST UN MIROIR. La valeur reelle est le reglage
 * Supabase `Authentication → Email OTP expiration` ; cette constante le RECOPIE.
 * Les deux changent ensemble — un email qui promet une heure sur un lien valable
 * dix minutes produit un appel au support a chaque envoi.
 *
 * Reglage constate le 8 aout : 10 minutes. Reserve a arbitrer : c'est tres court
 * pour le directeur d'une ecole nouvelle, qui ouvre sa boite quand il peut.
 */
const VALIDITE = '10 minutes'

/**
 * Lien du bouton de reinitialisation — PAS `{{ .ConfirmationURL }}`.
 *
 * Le lien direct de Supabase fait aboutir la session selon le flux qui a servi a
 * le fabriquer. Or nos liens naissent de trois endroits, et deux sont cote
 * serveur (console, fiche utilisateur) : la, aucun verificateur PKCE n'existe,
 * Supabase retombe sur le flux implicite et renvoie la session dans le FRAGMENT
 * de l'URL, que le serveur ne recoit jamais.
 *
 * `token_hash` ne depend d'aucun cookie prealable : il vaut pour les trois
 * chemins. Et `.RedirectTo` (non `.SiteURL`, que la doc emploie) porte le
 * SOUS-DOMAINE DE L'ECOLE ; il contient deja `?next=`, d'ou le `&`.
 *
 * Il mene a `/auth/confirm`, qui ne verifie que sur un vrai clic : les
 * inspecteurs de liens des messageries ouvrent les URL entrantes et brulent les
 * jetons a usage unique (Microsoft Safe Links, constate le 9 aout).
 */
const LIEN_REINIT = '{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery'

// ─── Les trois gabarits ──────────────────────────────────────────────────────

const GABARITS = [
  {
    fichier: 'reset-password.html',
    /** Où le coller. */
    emplacement: 'Authentication → Emails → Templates → Reset Password',
    objet: 'Définissez votre mot de passe Bilal Education',
    contenu: coque({
      titre: 'Définissez votre mot de passe',
      // La ligne d'aperçu annonce le délai elle aussi : c'est souvent tout ce
      // qu'on lit avant d'ouvrir. Elle passe donc par la même constante.
      apercu: `Un lien valable ${VALIDITE} pour définir le mot de passe de votre compte.`,
      corps: [
        // Nommer le compte concerné : c'est ce qui rend une erreur de
        // destinataire immédiatement visible, plutôt qu'un « votre compte »
        // que chacun rapporte au sien.
        p('Une demande a été faite pour le compte <strong style="color:' + C.encre + ';">{{ .Email }}</strong>.'),
        p('Cliquez ci-dessous pour choisir votre mot de passe. Vous serez ramené sur l\'espace de votre établissement.'),
        bouton(LIEN_REINIT, 'Définir mon mot de passe'),
        // Le délai est RECOPIÉ du réglage Supabase, il n'est pas décidé ici.
        // Voir `VALIDITE`.
        pDoux('Ce lien est valable <strong>' + VALIDITE + '</strong> et ne peut servir qu\'une seule fois. Passé ce délai, demandez-en un nouveau depuis l\'écran de connexion de votre établissement, par « Mot de passe oublié » — c\'est immédiat.'),
        // Repli texte : certains clients réécrivent ou tronquent les liens.
        // Groupé avec la note d'expiration — les deux parlent du lien, les
        // séparer d'un filet suggérerait à tort deux sujets distincts.
        pDoux('Le bouton ne fonctionne pas ? Copiez cette adresse dans votre navigateur :<br><span style="word-break:break-all;">' + LIEN_REINIT + '</span>'),
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
