'use client'

import FormModal from '@/components/ui/FormModal'
import { FloatButton } from '@/components/ui/FloatFields'

/**
 * PROCÉDURE DE CONFIGURATION DE LA MESSAGERIE, à la portée de l'école.
 *
 * ── POURQUOI ICI ET PAS AILLEURS ───────────────────────────────────────────
 *
 * C'est l'écran où l'on est quand on en a besoin : on lit l'étape et on
 * remplit le champ juste à côté. Trois autres formes ont été écartées :
 *
 *  · un PDF dans `public/` (précédent du gabarit d'import) serait imprimable
 *    et transmissible, mais il **se périme en silence** — et la partie la plus
 *    périssable est justement le chemin de clic chez le fournisseur. Le projet
 *    a déjà payé ça sur `policies.sql`, `schema.sql` et le commentaire
 *    `app-open` : une documentation périmée inspire une confiance qu'elle ne
 *    mérite pas ;
 *  · une PAGE d'aide demanderait une route, un titre dans `DashboardNav`, une
 *    garde de rôle et une forme de plus dans la carte de `RouteSkeleton` —
 *    beaucoup de tuyauterie pour un document, et elle éloignerait du
 *    formulaire qu'on est en train de remplir ;
 *  · un email d'accueil se perd : la procédure sert surtout le jour où la
 *    messagerie CESSE de fonctionner, des mois après l'ouverture.
 *
 * ── LE CONTENU VIT ICI, ET NULLE PART AILLEURS ─────────────────────────────
 *
 * Pas de `.md` jumeau : la duplication est le défaut qui revient le plus dans
 * ce projet (le calcul comptable divergent dans trois sous-menus, les quatre
 * tables de situation familiale, les sept tables de libellés de rôle).
 *
 * ── CE QUI EST PÉRISSABLE EST ÉNONCÉ PAR SON OBJECTIF ──────────────────────
 *
 * Les réglages de sécurité des fournisseurs changent de place sans prévenir.
 * On dit donc CE QU'IL FAUT OBTENIR et quoi chercher, plutôt qu'un pas-à-pas
 * de douze étapes qui pourrirait sans que personne ne s'en aperçoive.
 *
 * ── AUCUNE GARDE DE RÔLE ───────────────────────────────────────────────────
 *
 * Inutile : l'encadré qui ouvre cette modale ne s'affiche que si la lecture de
 * la configuration a réussi, c'est-à-dire pour admin et direction seulement.
 *
 * Coque `FormModal`, comme `SupportRequestDetailModal` — la seule autre modale
 * de lecture du projet. Elle est documentée « pour la saisie », donc un peu
 * trop verrouillée pour un texte qu'on ne fait que lire ; la cohérence avec le
 * précédent vaut mieux qu'une seconde coque pour un gain marginal.
 */

/**
 * Réglages des fournisseurs courants. Les valeurs vérifiées en service sont
 * Gmail (la première école) et Infomaniak (l'éditeur) ; les deux autres sont
 * les plus probables pour les écoles suivantes. La restriction propre à
 * Microsoft est signalée sous le tableau et non dans une colonne : elle ne
 * concerne qu'une ligne, et une colonne presque vide se lit comme un oubli.
 */
const FOURNISSEURS: { nom: string; serveur: string; port: string; chiffrement: string }[] = [
  { nom: 'Gmail · Google Workspace',    serveur: 'smtp.gmail.com',      port: '587', chiffrement: 'STARTTLS' },
  { nom: 'Microsoft 365 · Outlook',     serveur: 'smtp.office365.com',  port: '587', chiffrement: 'STARTTLS' },
  { nom: 'Infomaniak',                  serveur: 'mail.infomaniak.com', port: '587', chiffrement: 'STARTTLS' },
  { nom: 'OVH',                         serveur: 'ssl0.ovh.net',        port: '587', chiffrement: 'STARTTLS' },
]

export default function AideMessagerie({ onClose }: { onClose: () => void }) {
  return (
    <FormModal
      title="Configurer la messagerie"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-end w-full">
          <FloatButton variant="secondary" onClick={onClose}>Fermer</FloatButton>
        </div>
      }
    >
      <p className="text-sm text-secondary-800 leading-relaxed">
        L&apos;application envoie ses emails <strong>depuis la boîte de l&apos;établissement</strong> :
        les familles reçoivent les devoirs, les absences et les annonces à votre
        nom, et vous répondent chez vous. Il faut donc lui confier les accès de
        cette boîte.
      </p>

      {/* ── 1. Le cadre : savoir ce qu'on cherche avant de chercher ───────── */}
      <section className="space-y-1.5">
        <h3 className="section-title">Les quatre informations à réunir</h3>
        <ul className="text-sm text-secondary-800 space-y-1 list-disc pl-5">
          <li><strong>Le serveur</strong> d&apos;envoi (SMTP) et son <strong>port</strong> — voir le tableau ci-dessous.</li>
          <li><strong>L&apos;identifiant</strong> : l&apos;adresse email complète de la boîte.</li>
          <li><strong>Un mot de passe d&apos;application</strong>, et non le mot de passe habituel.</li>
          <li><strong>L&apos;adresse d&apos;expédition</strong> : celle de cette même boîte.</li>
        </ul>
      </section>

      {/* ── 2. Ce qui fait réellement gagner du temps ─────────────────────── */}
      <section className="space-y-1.5">
        <h3 className="section-title">Réglages des fournisseurs courants</h3>
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-warm-50 border-b border-warm-100">
              <tr>
                <th scope="col" className="list-th-compact">Fournisseur</th>
                <th scope="col" className="list-th-compact">Serveur</th>
                <th scope="col" className="list-th-compact">Port</th>
                <th scope="col" className="list-th-compact">Chiffrement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {FOURNISSEURS.map(f => (
                <tr key={f.nom}>
                  <td className="px-2 py-1.5 text-xs text-secondary-800">{f.nom}</td>
                  <td className="px-2 py-1.5 text-xs text-secondary-800 font-mono">{f.serveur}</td>
                  <td className="px-2 py-1.5 text-xs text-secondary-800">{f.port}</td>
                  <td className="px-2 py-1.5 text-xs text-secondary-800">{f.chiffrement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-warm-700">
          Le port <strong>465</strong> avec le chiffrement <strong>SSL/TLS</strong> fonctionne
          aussi chez la plupart d&apos;entre eux. En cas de doute, la documentation
          de votre fournisseur fait foi — cherchez-y « paramètres SMTP ».
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <strong>Microsoft 365</strong> désactive souvent l&apos;envoi SMTP par défaut.
          Si le test échoue malgré des réglages corrects, c&apos;est à
          l&apos;administrateur de votre abonnement Microsoft de l&apos;autoriser pour
          cette boîte.
        </p>
      </section>

      {/* ── 3. Le point qui bloque le plus souvent ────────────────────────── */}
      <section className="space-y-1.5">
        <h3 className="section-title">Le mot de passe d&apos;application</h3>
        <p className="text-sm text-secondary-800 leading-relaxed">
          Dès que la double authentification est active sur la boîte — ce qui est
          le cas par défaut chez Google, et recommandé partout — le fournisseur
          <strong> refuse le mot de passe habituel</strong> pour un envoi
          automatique. Il faut lui demander un mot de passe distinct, réservé à
          cet usage.
        </p>
        <p className="text-sm text-secondary-800 leading-relaxed">
          Cherchez <strong>« mot de passe d&apos;application »</strong> dans les
          réglages de <em>sécurité</em> de la boîte. Chez Google, c&apos;est dans
          la gestion du compte, rubrique Sécurité, après avoir activé la
          validation en deux étapes. Le fournisseur affiche alors une suite de
          caractères : c&apos;est elle qu&apos;on saisit ici, une seule fois.
        </p>
        <p className="text-xs text-warm-700">
          Le mot de passe enregistré n&apos;est <strong>jamais réaffiché</strong>, ni
          dans cet écran ni ailleurs. Pour le remplacer, saisissez simplement le
          nouveau ; en le laissant vide, l&apos;ancien est conservé.
        </p>
      </section>

      {/* ── 4. La règle de délivrabilité, développée ──────────────────────── */}
      <section className="space-y-1.5">
        <h3 className="section-title">L&apos;adresse d&apos;expédition</h3>
        <p className="text-sm text-secondary-800 leading-relaxed">
          Elle doit être <strong>celle du compte dont vous venez de donner les
          accès</strong>. Y mettre une autre adresse — même une adresse à vous —
          fait classer vos messages en indésirables, parce que le fournisseur qui
          les reçoit constate que l&apos;expéditeur annoncé ne correspond pas au
          serveur qui envoie.
        </p>
        <p className="text-sm text-secondary-800 leading-relaxed">
          Le <strong>nom affiché</strong>, lui, est libre : c&apos;est ce que la
          famille lit en haut du message. Et les réponses ne reviennent pas à
          cette adresse technique mais à l&apos;<strong>email de contact</strong> de
          l&apos;établissement, renseigné dans l&apos;encadré Identité.
        </p>
      </section>

      {/* ── 5. Pourquoi le test n'est pas une formalité ───────────────────── */}
      <section className="space-y-1.5">
        <h3 className="section-title">Tester avant d&apos;enregistrer</h3>
        <p className="text-sm text-secondary-800 leading-relaxed">
          « Tester la connexion » <strong>envoie un vrai message</strong> à
          l&apos;email de contact de l&apos;établissement. Ce n&apos;est pas une
          vérification de façade : un serveur qui répond ne prouve rien — le
          compte peut avoir atteint son quota, refuser l&apos;adresse
          d&apos;expédition, ou être restreint par son administrateur. Seul un
          message réellement reçu le prouve.
        </p>
        <p className="text-xs text-warm-700">
          Le test porte sur ce qui est <strong>saisi à l&apos;écran</strong>, pas sur
          ce qui est enregistré : on valide d&apos;abord, on enregistre ensuite.
        </p>
      </section>

      {/* ── 6. Le dépannage, par fréquence réelle ─────────────────────────── */}
      <section className="space-y-1.5">
        <h3 className="section-title">Si le test échoue</h3>
        <ul className="text-sm text-secondary-800 space-y-1 list-disc pl-5">
          <li>
            <strong>Neuf fois sur dix, le mot de passe.</strong> Vérifiez que
            c&apos;est bien un mot de passe d&apos;application et non celui de la
            boîte, et qu&apos;aucun espace ne s&apos;est glissé au collage.
          </li>
          <li>
            <strong>Le couple port / chiffrement.</strong> Essayez l&apos;autre
            combinaison : 587 avec STARTTLS, ou 465 avec SSL/TLS.
          </li>
          <li>
            <strong>L&apos;envoi SMTP non autorisé</strong> sur la boîte. C&apos;est
            fréquent sur les abonnements professionnels, et cela se débloque chez
            le fournisseur, pas ici.
          </li>
        </ul>
        <p className="text-xs text-warm-700">
          Le message d&apos;erreur affiché sous les champs vient du fournisseur
          lui-même : recopiez-le dans une demande de support si rien de ce qui
          précède ne débloque la situation.
        </p>
      </section>
    </FormModal>
  )
}
