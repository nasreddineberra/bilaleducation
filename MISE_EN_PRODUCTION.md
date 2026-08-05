# Mise en production — plan de suivi

> **Document VIVANT.** Il se coche au fur et à mesure et **se supprime** une fois la
> production stable. Ce n'est pas de la documentation : c'est une liste de tâches
> avec un début et une fin. Cinq rapports figés ont été supprimés du dépôt le
> 5 août 2026 pour avoir survécu à leur objet — celui-ci ne doit pas les rejoindre.

**Modèle** : éditeur logiciel. Nasr-Eddine possède l'application et vend un
abonnement aux établissements. Un déploiement unique, une base unique, un
sous-domaine par école, cloisonnement par RLS.

**Légende** : `[ ]` à faire · `[x]` fait · **Toi** = action manuelle (achat,
compte, réglage chez un prestataire) · **Moi** = code, SQL, configuration.

---

## Phase 0 · Décisions — à trancher avant de commencer

- [ ] **Nom de domaine et extension** — `bilaleducation.fr` ? Vérifier la disponibilité.
      Conditionne tout le reste, y compris une valeur en dur dans le middleware.
- [ ] **Registrar + boîte aux lettres** — Infomaniak ou OVHcloud.
      Contrainte technique : le DNS doit accepter un enregistrement **générique**
      (`*.bilaleducation.fr`). Les deux le permettent.
- [ ] **Titulaire du domaine** — la structure qui vend, pas une personne physique
      si une société existe. Un domaine se transfère mal quand il dépend d'un individu.

### Décisions déjà prises (ne pas rouvrir sans raison)

| Sujet | Décision | Date |
|---|---|---|
| Envoi des emails | **SMTP par établissement**, avec accompagnement à la configuration. Pas d'envoi mutualisé par l'éditeur. | 5 août |
| Accès support de l'éditeur | Le `super_admin` entre dans une école en se rattachant à elle ; `get_user_role()` répond alors `admin`. Son rôle réel ne change **jamais** — il ne peut donc pas rester bloqué hors de la console. | 5 août |
| Entrée opérateur | Sous-domaine dédié et non annoncé (`console.`), pas le domaine racine, qui deviendra une vitrine. | 5 août |
| Compte `admin` | Reste le compte de tête de **l'école cliente**, distinct du `super_admin` éditeur. Créé par l'éditeur à l'ouverture du compte. | 5 août |

---

## Phase 1 · Domaine

- [ ] **Toi** — Acheter le domaine. **Ne prendre aucune option** proposée pendant la
      commande : ni hébergement, ni certificat, ni protection payante. Tout est inclus ailleurs.
- [ ] **Toi** — Activer l'**authentification à deux facteurs** sur le compte registrar.
      Qui contrôle le domaine contrôle le site, les emails, et toute réinitialisation de mot de passe.
- [ ] **Toi** — Vérifier que le **renouvellement automatique** est actif. Un domaine
      expiré arrête le site et la messagerie le même jour.
- [ ] **Toi** — Créer la boîte `contact@` (adresse de l'éditeur, pas d'une école).

---

## Phase 2 · Hébergement — déployer en préproduction

Objectif : le site tourne sur le vrai domaine, en HTTPS, **avec les données de test**.
Aucun utilisateur réel, aucune donnée réelle.

- [ ] **Toi** — Créer le compte Vercel et le connecter au dépôt GitHub.
      **Formule Pro nécessaire** : le gratuit interdit l'usage commercial.
- [ ] **Moi** — Vérifier que le projet se construit en production (`next build`),
      qui n'a jamais tourné depuis les dernières migrations.
- [ ] **Toi + Moi** — Variables d'environnement sur Vercel (les 3 clés Supabase,
      `NEXT_PUBLIC_SITE_URL`, `DEFAULT_TENANT_SLUG` **absente** en production —
      elle ne sert qu'en local).
- [ ] **Toi** — DNS : enregistrement **générique** `*.bilaleducation.fr` vers Vercel,
      plus la racine. C'est ce qui fait qu'ajouter une école ne demande aucun déploiement.
- [ ] **Vérifier** : `demo.bilaleducation.fr` affiche l'écran de connexion, en HTTPS,
      avec le nom et le logo de l'établissement.

> **Ce que cette phase valide et que le local ne peut pas tester** : la résolution du
> tenant par sous-domaine (en local, elle est court-circuitée par une variable fixe),
> les cookies `secure`, les liens d'authentification, et le contrôle d'appartenance au
> tenant écrit le 5 août — qui n'a jamais tourné dans sa forme réelle.

---

## Phase 3 · Base de données de production

**Problème connu** : `schema.sql` a été supprimé le 5 août (périmé et trompeur). Il
n'existe donc plus d'artefact de reconstruction. La réponse n'est pas de le réécrire
à la main mais de l'**exporter depuis la base réelle**.

- [ ] **Moi** — Générer un export du schéma depuis le projet Supabase actuel
      (`pg_dump --schema-only`). Exact, daté, vérifiable.
- [ ] **Toi** — Créer le projet Supabase de **production**. Formule Pro : la gratuite
      met le projet en pause et **ne fait pas de sauvegardes quotidiennes**.
- [ ] **Moi** — Appliquer le schéma exporté sur la production, puis vérifier les
      politiques RLS en base (`pg_policies`) — jamais depuis le dépôt.
- [ ] **Moi** — Créer l'établissement réel avec son **vrai slug** (aujourd'hui `demo`,
      qui donnerait `demo.bilaleducation.fr`).
- [ ] **Toi** — Le projet Supabase actuel devient l'environnement de **développement**.
      Ton `.env.local` pointe dessus ; la production ne connaît que Vercel.
- [ ] **Toi** — Vérifier que les sauvegardes quotidiennes sont actives et **tester une
      restauration**. Une sauvegarde jamais restaurée n'est pas une sauvegarde.

---

## Phase 4 · Adaptations de code exigées par la production

- [ ] **Moi** — Le middleware reconnaît l'espace opérateur au **sous-domaine `console`**
      et non plus au domaine racine, libéré pour la vitrine (~3 lignes).
- [ ] **Moi** — Retirer `bilaleducation.fr` en dur du middleware au profit d'une variable.
- [ ] **Moi** — **Cookie de session valable sur les sous-domaines** (`.bilaleducation.fr`),
      sans quoi le passage de la console vers une école déconnecte.
- [ ] **Moi** — **Accès support du `super_admin`** : liste des écoles dans la console,
      rattachement à l'entrée, bandeau permanent « Vous intervenez sur X — quitter »,
      retour à NULL en sortie. Migration de `get_user_role()`.
- [ ] **Moi** — Vérifier que le journal attribue bien ces actions au `super_admin`
      et non à un employé de l'école.

---

## Phase 5 · Messagerie

- [ ] **Toi** — Configurer **SPF, DKIM et DMARC** sur le domaine (DNS). C'est de loin
      le premier facteur de délivrabilité, bien avant le choix du prestataire.
- [ ] **Moi** — Configurer le SMTP du premier établissement dans la fiche, et
      **tester un envoi réel** : devoir, relance, message aux parents, message au staff.
      Aucun email n'est jamais parti de cette application.
- [ ] **Toi** — Montée en charge **progressive** : quelques envois, puis quelques
      dizaines, sur plusieurs jours. Un domaine neuf qui émet 300 messages d'un coup
      s'installe durablement dans les indésirables.
- [ ] **Moi** — Rédiger la procédure de configuration SMTP à remettre aux écoles.

---

## Phase 6 · Tests

- [ ] **Toi + Moi** — **Un compte de chaque rôle** : admin, direction, comptable,
      responsable pédagogique, secrétaire, enseignant. La matrice RLS a été réécrite
      le 5 août et n'a jamais été éprouvée. Le mode de défaillance est silencieux :
      une politique trop stricte ne lève pas d'erreur, elle renvoie zéro ligne.
- [ ] **Toi** — Enrôlement TOTP des 7 comptes qui y échappaient. Un seul (admin) a
      un facteur configuré. Prévoir le téléphone et du temps.
- [ ] **Moi** — Vérifier le parcours support : entrer dans une école, agir, sortir.
- [ ] **Moi** — Vérifier l'expiration d'abonnement (redirection vers `/abonnement-expire`).

---

## Phase 7 · Ouverture

- [ ] **Toi** — Décider la **date**. Éviter une veille de rentrée : choisir une période calme.
- [ ] **Moi** — Effacer les données de test (`supabase/clean-all-data.sql`).
- [ ] **Moi** — Créer l'établissement réel, son `admin` et sa `direction`.
- [ ] **Toi** — Former les utilisateurs, en commençant par la direction.

---

## Phase 8 · Après l'ouverture

- [ ] **Toi** — **Contrat de sous-traitance RGPD** (article 28) avec chaque école.
      Tu traites des données d'enfants pour leur compte : elles sont responsables du
      traitement, tu es sous-traitant. À avoir **avant le premier client payant** —
      une école sérieuse le demandera, et c'est bien plus simple à faire maintenant
      qu'à rattraper sur dix clients.
- [ ] **Moi** — Procédure de **migration en production** : aujourd'hui le SQL se joue
      à la main. C'est là que vit le vrai risque d'une mise à jour — une migration à
      moitié appliquée sur des données réelles ne se rattrape pas facilement.
- [ ] **Toi** — Surveillance : être prévenu quand le site tombe, sans l'apprendre par un client.
- [ ] **Moi** — Reprendre les chantiers en attente (doublons apprenants/parents,
      unicité d'inscription, passage d'année, police latine).

---

## Coûts récurrents

| Poste | Ordre de grandeur | Note |
|---|---|---|
| Domaine | ~15 €/an | |
| Boîte `contact@` | ~2 à 6 €/mois | |
| Vercel Pro | ~20 $/mois | Le gratuit interdit l'usage commercial |
| Supabase Pro | ~25 $/mois | Le gratuit n'a **pas de sauvegardes quotidiennes** |
| **Socle mensuel** | **~50 €** | Indépendant du nombre d'écoles — à couvrir avec les premiers abonnements |

---

## Risques identifiés

**Le mode de défaillance de la RLS est silencieux.** Une politique trop stricte ne
produit aucune erreur : l'écran se vide. C'est pourquoi la phase 6 n'est pas une
formalité — et pourquoi elle doit avoir lieu **avant** toute donnée réelle.

**Les migrations SQL ne partent pas avec le déploiement.** Le code se déploie d'un
`git push` et se revient en un clic ; une migration jouée sur des données réelles, non.
C'est le point le plus dangereux d'une mise à jour, et il n'a pas encore de procédure.

**Les données réelles rendent tout irréversible.** Aujourd'hui la base contient
45 élèves de test qu'un script efface. Après l'ouverture, chaque évolution de schéma
devient une migration avec de vraies familles derrière.

**La délivrabilité est une réputation, pas un réglage.** Elle se construit lentement
et se détruit vite. Trois cents messages le premier jour depuis un domaine neuf est
la meilleure façon de finir en indésirables durablement.
