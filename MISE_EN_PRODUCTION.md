# Mise en production — plan de suivi

> **Document VIVANT.** Il se coche au fur et à mesure et **se supprime** une fois la
> production stable. Ce n'est pas de la documentation : c'est une liste de tâches
> avec un début et une fin. Cinq rapports figés ont été supprimés du dépôt le
> 5 août 2026 pour avoir survécu à leur objet — celui-ci ne doit pas les rejoindre.

**Modèle** : éditeur logiciel. Nasr-Eddine possède l'application et vend un
abonnement aux établissements. Un déploiement unique, une base unique, un
sous-domaine par école, cloisonnement par RLS.

> **Reprise (6 août, fin de journée)** — phases 1, 2 et 4 terminées. Le site tourne sur
> `bilal-neuville.bilaleducation.fr`, la vitrine occupe la racine, la console vit sur
> `superadmin.bilaleducation.fr`. L'**accès support** est livré et vérifié en base ; il
> reste à l'éprouver à l'écran (entrer, agir, sortir, contrôler le journal de l'école).
>
> **7 août** — Phase 4 bis **TERMINÉE** : sécurité, charte et ajouts. La console exige la 2FA,
> ses actions sont gardées, cloisonnées et tracées ; elle porte le journal des interventions,
> la vue de santé des écoles et l'envoi des liens de mot de passe.
>
> **8 août — MESSAGERIE (phase 5), volet gabarits FAIT.** Les 3 emails d'authentification
> sont écrits à la charte et relus à l'écran (`supabase/email-templates/`). Vérification
> décisive au passage : **5 des 6 gabarits d'authentification ne se déclenchent jamais**,
> seul « Reset Password » est en service.
>
> **CE QUI RESTE, ET DANS CET ORDRE** — tout le volet gabarits est inerte sans le premier point :
> 1. **Toi** — créer les boîtes `contact@`, `admin@` et `superadmin@bilaleducation.fr` ;
> 2. **Toi** — les 2 enregistrements DNS de protection dans Vercel (TXT `@` = `v=spf1 -all`,
>    TXT `_dmarc` = `v=DMARC1; p=reject;`), toujours en attente depuis le 5 août ;
> 3. **Toi + Moi** — renseigner le SMTP du projet Supabase avec `contact@`, coller les
>    3 gabarits, **activer les 2 notifications de sécurité**, vérifier les 3 réglages ;
> 4. **Moi + Toi** — configurer le SMTP de la première école et **tester un envoi réel**.
>    Aucun email n'est jamais parti de cette application.
>
> À éprouver à l'écran par ailleurs : se reconnecter à la console — elle demandera le
> code TOTP, ayez le téléphone —, puis le parcours support (entrer dans l'école, agir,
> sortir, contrôler que le journal de l'école porte bien votre nom).

**Légende** : `[ ]` à faire · `[x]` fait · **Toi** = action manuelle (achat,
compte, réglage chez un prestataire) · **Moi** = code, SQL, configuration.

## Règle de coût — décidée le 6 août

**Rien à payer pour la phase de test.** Les formules gratuites de Vercel et de
Supabase conviennent exactement à cette étape : la restriction de Vercel porte sur
l'usage *commercial*, or il n'y a aucun client ; ce qui manque au gratuit de
Supabase, ce sont les *sauvegardes quotidiennes*, or il n'y a que des données
factices.

**Le déclencheur du passage en Pro n'est pas la mise en ligne, c'est la première
école qui paie.** Ce jour-là deux choses changent ensemble : l'activité devient
commerciale, et la base contient de vraies données d'enfants et de paiements.

Réserve à surveiller : un projet Supabase gratuit **se met en pause après une
semaine sans activité**.

---

## Phase 0 · Décisions — à trancher avant de commencer

- [x] **Nom de domaine** — `bilaleducation.fr`, acheté le 5 août 2026 chez Infomaniak,
      6,12 € TTC la première année puis **8,40 € TTC/an** (déduit de la grille pluriannuelle,
      le tarif de renouvellement n'étant affiché nulle part).
- [x] **Registrar** — Infomaniak. Options écartées à l'achat : DNS Fast Anycast (gain
      en millisecondes pour un public français), Domain Privacy (l'AFNIC masque déjà les
      données des personnes physiques sur un `.fr`), Renewal Warranty (couvre un risque
      qu'un renouvellement automatique supprime gratuitement). Économie : ~10 €/an.
- [ ] **Boîte aux lettres éditeur** `contact@bilaleducation.fr` — pas urgente : aucune
      dépendance avec le déploiement, les enregistrements MX n'entrent pas en conflit
      avec ceux de l'hébergement.
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

- [x] **Toi** — Domaine acheté, sans option.
- [x] **Toi** — Authentification à deux facteurs activée sur le compte Infomaniak.
- [x] **Toi** — Renouvellement automatique actif.
- [ ] **Toi** — Rappel agenda **début juin 2027**, deux mois avant l'échéance. C'est le
      seul filet contre une carte bancaire expirée, que le renouvellement automatique
      ne couvre pas.
- [ ] **Toi** — Créer la boîte `contact@` (adresse de l'éditeur, pas d'une école).
      Peut attendre la phase 5.

---

## Phase 2 · Hébergement — déployer en préproduction

Objectif : le site tourne sur le vrai domaine, en HTTPS, **avec les données de test**.
Aucun utilisateur réel, aucune donnée réelle.

- [x] **Toi** — Compte Vercel créé, dépôt connecté (accès GitHub limité au seul dépôt
      `bilaleducation`), formule gratuite.
- [x] **Moi** — Build de production vérifié le 6 août 2026 : toutes les routes
      compilent, middleware inclus. C'était le vrai risque technique de la phase —
      le projet a déjà connu un build cassé par une dépendance mal isolée (jsdom,
      10 juillet), invisible en développement.
- [x] **Toi + Moi** — 4 variables posées : les 3 clés Supabase et `NEXT_PUBLIC_SITE_URL`.
      `DEFAULT_TENANT_SLUG` volontairement absente — le middleware ne la lit que dans la
      branche locale, elle serait inerte en production et source de confusion.
- [x] **Toi** — DNS délégué à Vercel (`ns1`/`ns2.vercel-dns.com`). Un domaine **générique**
      impose cette délégation : le certificat HTTPS générique se valide par le DNS, donc
      Vercel doit contrôler la zone. Infomaniak reste le registrar.
      Conséquence : les enregistrements de la future messagerie se créeront côté Vercel.
- [ ] **Toi** — Recréer dans la zone Vercel les deux protections perdues à la délégation :
      TXT `@` = `v=spf1 -all` et TXT `_dmarc` = `v=DMARC1; p=reject;`. Sans elles, n'importe
      qui peut usurper `@bilaleducation.fr`.
- [x] **Vérifié le 6 août** en conditions réelles :
      `bilal-neuville.bilaleducation.fr/login` répond 200 avec un certificat valide ;
      la route publique renvoie « ÉCOLE BILAL » et son logo, prouvant que le middleware
      résout le slug, trouve l'école et transmet son identifiant ; un sous-domaine inconnu
      est rejeté vers `/abonnement-expire`.
      **Toute la chaîne multi-établissement tourne** — ce que le local ne pouvait pas
      éprouver, puisqu'il court-circuite cette résolution.

> **Ce que cette phase valide et que le local ne peut pas tester** : la résolution du
> tenant par sous-domaine (en local, elle est court-circuitée par une variable fixe),
> les cookies `secure`, les liens d'authentification, et le contrôle d'appartenance au
> tenant écrit le 5 août — qui n'a jamais tourné dans sa forme réelle.

---

## Phase 3 · Base de données de production

**Problème connu** : `schema.sql` a été supprimé le 5 août (périmé et trompeur). Il
n'existe donc plus d'artefact de reconstruction. La réponse n'est pas de le réécrire
à la main mais de l'**exporter depuis la base réelle**.

- [x] **Moi** — Export généré le 6 août 2026 dans `supabase/restore/` : 64 tables,
      155 politiques, 31 fonctions, 92 déclencheurs, 120 index, 287 privilèges,
      9 compartiments de stockage et 37 politiques de fichiers. Procédure et pièges
      documentés dans son `README.md`.
      Deux manques que `pg_dump` ne signale pas ont dû être comblés à part : il
      **n'exporte jamais les extensions** (la restauration s'arrêtait sur la contrainte
      GiST de l'emploi du temps) et **rien du schéma `storage`**. Et `--no-privileges`,
      qui paraît anodin, retirait les `GRANT`/`REVOKE` : la base restaurée aurait repris
      les droits par défaut de Supabase au lieu du régime « serveur uniquement » de
      `etablissement_smtp`.
- [ ] **Toi** — Créer le projet Supabase de **production**. **Formule gratuite** pour
      la phase de test.
- [ ] **Moi** — Appliquer le schéma exporté sur la production, puis vérifier les
      politiques RLS en base (`pg_policies`) — jamais depuis le dépôt.
- [x] **Moi** — Slug renommé `demo` → **`bilal-neuville`** le 6 août. L'adresse de
      l'école sera donc `bilal-neuville.bilaleducation.fr`. `.env.local` aligné pour que
      le développement local continue de résoudre la même école.
      Ce renommage a révélé un **bug de production** : voir phase 4.
- [ ] **Toi** — Le projet Supabase actuel devient l'environnement de **développement**.
      Ton `.env.local` pointe dessus ; la production ne connaît que Vercel.
- [ ] **Moi** — Mettre en place une **sauvegarde automatique locale** (`pg_dump`,
      désormais installé). Elle ne remplace pas celles de Supabase : elle couvre la
      période où il y aura de vraies données sans que le Pro soit encore souscrit.
- [ ] **Toi** — Une fois en Pro : vérifier que les sauvegardes quotidiennes sont actives
      et **tester une restauration**. Une sauvegarde jamais restaurée n'est pas une
      sauvegarde.

---

## Phase 4 · Adaptations de code exigées par la production

- [x] **Moi** — Espace opérateur déplacé sur **`superadmin.bilaleducation.fr`** (6 août).
      Le sous-domaine plutôt qu'un chemin : le jour où la vitrine sera un site distinct
      hébergé ailleurs, `bilaleducation.fr/superadmin` cesserait d'exister.
      La racine ne pouvait pas être simplement retirée de l'espace opérateur — elle serait
      tombée dans la résolution d'établissement et aurait affiché « accès suspendu ». Elle
      sert donc une **page d'attente** (`/vitrine`), réécrite pour que l'adresse reste
      inchangée, sans aucun lien de connexion.
      `/superadmin` est refermé sur les domaines d'école : un parent y voyait l'écran de
      connexion de l'éditeur. Vérifié en production sur les 4 adresses.
- [ ] **Moi** — Interdire les slugs **réservés** à la création d'une école (`www`, `console`,
      `api`, `mail`, `admin`). Rien ne l'empêche aujourd'hui, et un slug ne se modifie pas :
      une école nommée `www` capterait l'adresse de la vitrine.
- [x] **Moi** — Domaine en dur retiré du middleware, déduit de `NEXT_PUBLIC_SITE_URL`,
      déjà définie dans Vercel — pas de variable supplémentaire.
- [ ] **Moi** — **Cookie de session valable sur les sous-domaines** (`.bilaleducation.fr`),
      sans quoi le passage de la console vers une école déconnecte.
- [x] **Moi** — **Accès support du `super_admin`** (6 août) : bouton « Intervenir » par
      école dans la console, rattachement à l'entrée, bandeau permanent nommant l'école et
      portant sa sortie, retour à NULL à la fermeture. Migration
      `add-superadmin-support-access.sql` **exécutée et vérifiée**.
      - Le rattachement se prend **depuis la console** et de nulle part ailleurs : ouvrir
        une intervention est une écriture, elle doit invalider le cache du profil — ce
        qu'un rendu de page n'a pas le droit de faire. Le layout du tableau de bord se
        contente de vérifier que le rattachement désigne l'école du sous-domaine visité.
      - Il est **exclusif** : entrer dans une seconde école est refusé tant que la
        première n'est pas quittée. Un profil ne porte qu'un établissement — sans ce
        refus, le premier onglet se mettrait silencieusement à travailler sur l'autre.
      - **26 fichiers** lisaient le rôle en direct et auraient refusé l'éditeur : la base
        lui aurait tout ouvert pendant que chaque enregistrement échouait — il aurait pu
        regarder sans rien réparer, l'inverse du but. Ils passent tous par
        `effectiveRole()`, miroir applicatif de la fonction SQL.
      - Deux gardes restent sur la colonne **brute**, délibérément : le layout de la
        console et les actions de support. Traduites, elles refuseraient la sortie au
        moment précis où elle est nécessaire.
- [ ] **Moi** — Vérifier que le journal attribue bien ces actions au `super_admin` et non
      à un employé de l'école. La trace de fin d'intervention s'écrit **avant** le
      détachement : `logAudit` abandonne en silence quand le profil n'a plus
      d'établissement, et le journal montrerait des interventions jamais refermées.
- [x] **Moi** — **L'accueil d'un client était inopérant** (corrigé le 6 août,
      `fix-audit-log-etablissements-table.sql`) : créer OU modifier une école depuis
      l'espace super-admin échouait systématiquement en 23502. Le déclencheur d'audit
      cherche l'établissement dans le profil de l'utilisateur connecté, or le super-admin
      travaille en service-role — sans session — et la table `etablissements` n'a pas de
      colonne `etablissement_id` : elle EST l'établissement. La suppression échouait
      elle aussi, ce qui cassait les chemins de rattrapage de la création et laissait des
      écoles orphelines. Découvert en renommant le slug, pas par un test.

---

## Phase 4 bis · Console super-admin — audit du 6 août, rien n'est fait

Audit demandé après un constat de l'utilisateur : **la console ne lui a jamais demandé la 2FA**,
alors que le domaine d'une école, oui. La console a été écrite avant les passes de refonte et
**aucune ne l'a suivie depuis** — ce n'est pas une accumulation d'oublis, c'est un décalage
cohérent. Trois blocs, dans cet ordre.

### Bloc 1 · Sécurité — FAIT le 7 août

> Livré et vérifié en base. Deux conséquences à connaître : la console **exige
> désormais la 2FA** (facteur déjà vérifié pour l'éditeur, donc aucun
> ré-enrôlement), et un **journal côté éditeur** reste à construire — une
> connexion à la console ne concerne aucune école, donc aucun journal ne peut
> l'accueillir. La mention de l'écran de connexion a été corrigée en
> conséquence ; le journal lui-même est au bloc 3.

- [x] **2FA absente de la console** — CORRIGÉ le 7 août., par DEUX causes cumulées : la branche du sous-domaine
      `superadmin.` **sort du middleware** avant le contrôle, et ce contrôle est de toute façon
      conditionné à `pathname.startsWith('/dashboard')`. La surface la plus privilégiée du système
      — liste des clients, création de comptes, entrée dans n'importe quelle école — n'est protégée
      que par un mot de passe.
- [x] **Boucle de redirection infinie** — CORRIGÉE le 7 août. pour tout compte non super-admin : le middleware renvoie
      vers `/superadmin` qui est déjà connecté et demande `/superadmin/login` ; le layout protégé
      renvoie vers `/superadmin/login` qui n'est pas super-admin. Chacune est juste, ensemble elles
      bouclent. Depuis que le cookie porte le domaine entier, **n'importe quel utilisateur d'école
      connecté** qui tape l'adresse de la console la déclenche.
- [x] **Régression du 6 août (de moi)** — CORRIGÉE le 7 août. : les 8 actions de `superadmin/actions.ts` sont gardées par
      `requireRoleServer(['super_admin'])`, or cette garde compare désormais le rôle **effectif**,
      qui vaut `admin` pendant une intervention. **Dès qu'une intervention est ouverte, aucune
      action de la console ne fonctionne.** Elles doivent utiliser `requireEditor()` (colonne brute),
      comme `support-actions.ts` — la règle était écrite, je ne l'ai pas appliquée à ce fichier.
- [x] **`createTenantUser` ne pose pas `app_metadata`** — CORRIGÉ le 7 août. (rôle + établissement). Un compte créé
      depuis la console est donc traité comme un **parent** par le middleware : **2FA contournée** et
      contrôle d'appartenance au sous-domaine inopérant. `createTenant` le fait correctement : les
      deux chemins de création divergent.
- [x] **`updateTenantUser` n'est pas cloisonnée** — CORRIGÉ le 7 août. : `.eq('id', profileId)` sans vérifier que le
      profil appartient à l'école affichée, en service-role donc sans RLS pour rattraper, et sans
      valider le rôle transmis.
- [x] **Aucune action de la console n'est tracée** — CORRIGÉ le 7 août. : créer une école, changer un abonnement,
      désactiver un client, créer un compte. Et la page de connexion affiche « Accès surveillé et
      journalisé », ce qui est faux aujourd'hui.

### Bloc 2 · Charte et ergonomie — FAIT le 7 août

> La console garde une identité DISTINCTE — arriver chez l'éditeur ne doit pas
> ressembler à arriver chez un client — mais cette distinction passe désormais
> par les **jetons de marque** et l'**orange de la charte**, non par une palette
> inventée. Reste à valider **à l'écran**.

- [x] **Écran de connexion** (repris sur celui des écoles) : aucune des corrections du 3 août apportées à celui des écoles.
      Pas de focus initial, pas de détection du verrouillage majuscules, bouton désactivé à vide
      (alors qu'on a décidé qu'un bouton grisé n'explique rien), œil hors navigation clavier et sans
      `aria-label`, erreur sans `role="alert"`.
- [x] **Couleurs en dur, hors charte** — remplacées par les jetons. : `#0f1923` / `#16232f` / `#e85d04` (connexion) et le dégradé
      `#2e4550` de la barre latérale — la valeur même que nous avons retirée de l'emploi du temps le
      2 août au profit des jetons. L'orange de la charte est `#f97316`. La console ne suit ni le
      thème clair/sombre ni les jetons : une évolution de la marque ne l'entraînera pas.
- [x] **Système de composants non utilisé** — `.list-th`/`.list-td`/`.stat-label`, `card p-0`, icône retirée. : `<input>`/`<label>` bruts au lieu des champs à libellé
      flottant, en-têtes maison au lieu de `.list-th`, cartes en `text-2xl` au lieu de
      `ListStatCard`, icône `Plus` sur « Ajouter ».
- [x] **Trois actions lourdes sans confirmation** — `ConfirmModal` sur les trois. : désactiver un établissement (coupe l'accès à
      toute une école), retirer la date d'abonnement, retirer la limite d'élèves.
- [x] **Ni limite de saisie ni compteur** — compteur dans le champ, limites partagées avec la fiche établissement (`lib/tenant/limites.ts`). sur nom (30) et adresse (80), pourtant imposés en base
      depuis le 5 août : la frappe est acceptée puis rejetée par un message générique.
- [x] Détails traités : grille en 4 colonnes pour 3 cartes, lignes de liste non cliquables (règle projet),
      survol du fil d'Ariane de la même couleur que son état normal, `parent` proposé dans les rôles
      alors que ces comptes sont suspendus en V1.

### Bloc 3 · Ajouts fonctionnels — à arbitrer une fois le reste sain

- [ ] **Journal des interventions de support** dans la console (qui, quelle école, ouverte quand,
      fermée quand) et **expiration automatique** : aujourd'hui une intervention oubliée reste
      ouverte indéfiniment.
- [x] **Vue de santé par école** (7 août) : messagerie configurée ou non, dernière connexion,
      effectif face à la limite, abonnement proche de l'échéance. Écran distinct de la liste —
      celle-ci répond à « quels sont mes clients ? », celui-là à « lesquels vont mal ? ».
      Un établissement désactivé ne produit aucune alerte : son silence est la conséquence
      d'une décision, pas un symptôme.
- [x] **Lien de réinitialisation** (7 août) : à la création d'une école ou d'un compte, un
      lien de définition du mot de passe part vers l'intéressé ; un bouton par utilisateur le
      renvoie depuis la fiche. Le mot de passe généré reste en repli, affiché **une seule
      fois** après la création — si l'email n'arrive pas, un compte sans mot de passe est un
      compte inutilisable.
      - **Bug corrigé au passage** : la réinitialisation déjà proposée dans l'écran Utilisateurs
        d'une école construisait son lien avec `NEXT_PUBLIC_SITE_URL`, c'est-à-dire le domaine
        RACINE devenu la vitrine. Le lien partait et menait hors de toute école. Il se fabrique
        désormais depuis l'en-tête `host` de la requête, donc le sous-domaine visité.
- [ ] **Toi** — **BLOQUANT pour ce qui précède** : créer la boîte `contact@bilaleducation.fr`,
      puis la renseigner dans **Supabase → Project Settings → Authentication → SMTP**.
      L'expéditeur par défaut de Supabase est limité à **2 ou 3 emails par heure** : c'est un
      service de test, inutilisable dès la deuxième école créée dans l'heure.
      Décision du 7 août : ce SMTP sert à l'**authentification de toutes les écoles** (création
      de compte, mot de passe oublié) ; il ne touche PAS aux communications des écoles, qui
      gardent leur propre configuration et leur propre expéditeur.
- [x] **« Support technique » dans la barre latérale de l'ÉCOLE** (8 août), au-dessus des
      informations d'application, réservé à `direction` et `admin`. Un **formulaire**, décidé
      contre le simple `mailto:` : six natures de demande, impact conditionnel sur un incident,
      pièce jointe (1 Mo), et le contexte joint automatiquement (école, auteur, **page d'origine**,
      version, navigateur) — montré à l'utilisateur, replié.
      - Le lien mène à une **page d'historique** (`/dashboard/support`) avec filtres et recherche,
        calquée sur « Messages envoyés » ; le bouton « Contacter le support » y ouvre la modale.
        L'email partant par relais SMTP, **aucune copie n'atterrit dans le dossier « Envoyés »**
        de l'école : sans cette page, elle n'avait aucun moyen de vérifier ce qu'elle avait envoyé.
      - **La demande est ÉCRITE avant d'être notifiée** (`support_requests`). Sans cela,
        « ma messagerie ne fonctionne plus » — motif de demande parfaitement ordinaire —
        serait la seule demande incapable d'arriver : l'école croirait avoir écrit.
      - **`Reply-To` = l'auteur**, pas l'école : répondre écrit à qui a le problème sous les yeux.
      - **Migration `create-support-requests.sql` À JOUER** — sans elle, l'écran échoue.
- [ ] **Toi** — **Conséquence de la décision du 8 août : configurer la messagerie devient un
      PRÉREQUIS D'OUVERTURE pour chaque école**, et non une option. Le formulaire de support en
      dépend, comme les devoirs, les relances et les annonces. À intégrer à la procédure de
      mise en service d'un client, et à la procédure SMTP à leur remettre.
- [ ] **Consentement et durée** de l'intervention (RGPD) : à traiter avec le contrat de
      sous-traitance de la phase 8.

---

## Phase 5 · Messagerie

- [ ] **Toi** — Configurer **SPF, DKIM et DMARC** sur le domaine (DNS). C'est de loin
      le premier facteur de délivrabilité, bien avant le choix du prestataire.
- [ ] **Toi** — **Créer les boîtes** `contact@`, `admin@` et `superadmin@bilaleducation.fr`
      chez Infomaniak (décidé le 7 août).
- [ ] **Toi + Moi** — **SMTP du projet Supabase** (Project Settings → Authentication → SMTP),
      avec `contact@bilaleducation.fr` en expéditeur. Il couvre l'**authentification de toutes
      les écoles** : création de compte, mot de passe oublié.
      - **Paramètres Infomaniak** (vérifiés le 8 août) : `mail.infomaniak.com`, **port 587 +
        STARTTLS** (465 en SSL toléré) ; identifiant = l'**adresse complète**, pas un login
        court ; envoi anonyme refusé.
      - **Les plafonds, et lequel mord.** Expéditeur intégré de Supabase : **2 messages/heure**,
        un service de démonstration. Avec SMTP personnalisé : **30/heure, RÉGLABLE** dans
        `Authentication → Rate Limits` — la valeur basse est une précaution de réputation, pas
        une limite de formule. Infomaniak, service Mail payant : **1 440 messages / 24 h** par
        adresse, quota libéré **progressivement sur 24 h glissantes** (atteindre le plafond ne
        bloque donc pas jusqu'au lendemain), et **relevable sur demande écrite et motivée**.
        → Le circuit d'authentification tient très largement : quelques dizaines de liens au
        démarrage d'une école.
      - **RAISON SUPPLÉMENTAIRE DE BRANCHER LE SMTP** : depuis le **3 juin 2026**, un projet
        gratuit resté sur l'expéditeur par défaut **ne peut plus modifier ses gabarits d'email**.
        Le nôtre est antérieur, donc probablement épargné — mais le SMTP personnalisé supprime
        le doute : c'est lui qui rend les gabarits écrits le 8 août utilisables **et** les
        limites configurables.
      - **Ne concerne PAS le circuit 2** (communications d'école) : celui-ci passe par
        `etablissement_smtp`, propre à chaque école, et Supabase n'y touche pas. Les 200-300
        foyers d'une diffusion sont portés par le fournisseur de l'ÉCOLE, pas par le tien.
- [x] **Moi** — **Gabarits d'email de Supabase refondus à la charte** (8 août).
      `supabase/email-templates/` : `build.mjs` (source unique) génère les 3 fichiers à coller,
      `README.md` porte la marche à suivre. Coque unique — l'en-tête et le pied n'existent
      qu'en un exemplaire, pour ne pas rejouer le calcul comptable copié en trois écrans.
      - **TROIS gabarits, pas treize.** Vérifié dans le code : **5 des 6 gabarits
        d'authentification ne se déclenchent jamais** (les 7 `createUser` posent
        `email_confirm: true` ; `inviteUserByEmail`, `signInWithOtp` et `reauthenticate`
        sont absents ; `updateUserById({ email })` change l'adresse sans confirmation).
        Seul **Reset Password** est en service — 4 points d'appel. Les habiller tous aurait
        été cinq sixièmes de travail perdu.
      - **Décision du 8 août — marque Bilal Education seule**, pas le nom de l'école, à
        l'inverse de l'intention du 7. Raison : les écoles vivent sur `*.bilaleducation.fr`,
        l'email et le domaine d'atterrissage portent donc la même marque. Le nom d'école
        n'était accessible que par `.Data` (métadonnées utilisateur) : à écrire aux 4 points
        de création, à rattraper sur les comptes existants, **modifiable par l'utilisateur
        lui-même**, et **ne suivant pas un changement de nom**. Réversible pour un
        `{{ if .Data.etablissement_nom }}` si une école prend un domaine propre.
      - **Décision du 8 août — les 2 notifications de sécurité sont retenues** :
        « Password changed » et « Email address changed ». Elles sont **désactivées par
        défaut au niveau du projet** : un gabarit collé sans activation ne part jamais.
      - **Épreuve visuelle** produite avant tout collage (rendu réel + bascule
        exemple/variables), générée depuis les fichiers eux-mêmes pour ne pas en dériver.
- [ ] **Toi + Moi** — **Coller les 3 gabarits** dans Supabase, **activer les 2 notifications**,
      et vérifier les 3 réglages du projet : SMTP, `Email OTP expiration` (**10 minutes**,
      constaté le 8 août ; le gabarit recopie cette valeur par la constante `VALIDITE`, les deux
      changent ensemble — **à arbitrer** : 10 min est très court pour le directeur d'une école
      nouvelle, qui ouvre sa boîte quand il peut, et l'échec tomberait sur la première impression
      d'un client payant), et
      l'allow-list `https://*.bilaleducation.fr/**`. **Aucune variante `www.`** : le certificat
      générique ne couvre qu'un niveau, `www.ecole.bilaleducation.fr` déclenche un
      avertissement de sécurité chez le destinataire.
- [ ] **Moi, si le symptôme apparaît** — Route `/auth/confirm` portant `.TokenHash`, contre les
      **analyseurs de liens** des messageries d'entreprise, qui ouvrent le lien avant
      l'utilisateur et **consomment le jeton à usage unique**. Symptôme reconnaissable :
      « le lien dit qu'il a expiré alors que je viens de recevoir le mail. » Laissé de côté
      faute d'occurrence, nos destinataires étant sur des messageries grand public.
- [ ] **Moi** — Configurer le SMTP du premier établissement dans sa fiche, et **tester un envoi
      réel** : devoir, relance, message aux parents, message au staff. Distinct du précédent :
      celui-ci porte les communications de l'école, pas l'authentification.
      Aucun email n'est jamais parti de cette application.
- [ ] **Toi** — Montée en charge **progressive** : quelques envois, puis quelques
      dizaines, sur plusieurs jours. Un domaine neuf qui émet 300 messages d'un coup
      s'installe durablement dans les indésirables.
- [ ] **Moi** — Rédiger la procédure de configuration SMTP à remettre aux écoles.

---

## Phase 6 · Tests

- [ ] **Toi** — **`Authentication → Providers → Email → Allow new users to sign up`
      doit être DÉSACTIVÉ.** Tous les comptes sont créés côté serveur, par un
      administrateur : personne ne doit pouvoir s'inscrire seul. Si le réglage est actif,
      `signUp` reste appelable depuis l'API avec la clé publique, **quoi que fasse notre
      code** — un compte `auth` peut alors naître sans que l'école l'ait décidé.
      Repéré le 8 août en supprimant un `createUser` mort qui appelait précisément `signUp`
      depuis le navigateur.
- [ ] **Moi + Toi** — **Vérifier la policy INSERT de `profiles`**, avec un compte non
      administrateur. Le garde-fou anti-escalade posé le 8 juillet est un trigger
      **`BEFORE UPDATE`** : il ne voit pas un INSERT. Si la policy d'insertion est permissive,
      un utilisateur authentifié pourrait créer une ligne `profiles` en choisissant son rôle,
      sans jamais passer par une server action. À éprouver en même temps que la matrice de
      rôles ci-dessous — c'est le même test, avec le même compte.
- [ ] **Toi + Moi** — **Un compte de chaque rôle** : admin, direction, comptable,
      responsable pédagogique, secrétaire, enseignant. La matrice RLS a été réécrite
      le 5 août et n'a jamais été éprouvée. Le mode de défaillance est silencieux :
      une politique trop stricte ne lève pas d'erreur, elle renvoie zéro ligne.
- [ ] **Toi** — Enrôlement TOTP des 7 comptes qui y échappaient. Un seul (admin) a
      un facteur configuré. Prévoir le téléphone et du temps.
- [ ] **Toi** — **Vérifier le parcours support à l'écran** : depuis la console, entrer
      dans l'école, constater le bandeau, agir (une modification quelconque), sortir par
      le bandeau puis par la console. Vérifier au journal de l'école que l'acteur est bien
      l'éditeur. Le cycle a été éprouvé en base, pas encore dans un navigateur.
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

### Pendant la phase de test — aujourd'hui

| Poste | Coût |
|---|---|
| Domaine | 6,12 € payés, puis 8,40 €/an |
| Vercel · formule gratuite | 0 € |
| Supabase · formule gratuite | 0 € |
| **Total** | **0 €/mois** |

### À partir du premier client payant

| Poste | Ordre de grandeur | Pourquoi |
|---|---|---|
| Boîte `contact@` | ~2 à 6 €/mois | Adresse de l'éditeur |
| Vercel Pro | ~20 $/mois | L'activité devient commerciale |
| Supabase Pro | ~25 $/mois | Sauvegardes quotidiennes sur de vraies données |
| **Socle mensuel** | **~50 €** | Indépendant du nombre d'écoles |

**À intégrer au prix de vente** : une seule école ne couvre pas tout à fait ce socle.
Deux le couvrent, et tout le reste est marge.

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
