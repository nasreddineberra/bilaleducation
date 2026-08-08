# Gabarits d'email — Supabase Auth

Ces trois fichiers HTML se **collent à la main** dans le tableau de bord Supabase.
Ils ne sont lus par aucun code de l'application : le dépôt les conserve pour qu'ils
soient versionnés, relus et régénérables.

```bash
node supabase/email-templates/build.mjs
```

`build.mjs` est la **source unique** : en-tête, pied, couleurs et boutons n'y
existent qu'en un exemplaire. Ne jamais modifier les `.html` à la main — ils
seraient écrasés à la prochaine génération, et la coque repartirait en trois
copies divergentes.

---

## Ce que ces emails couvrent, et ce qu'ils ne couvrent pas

| | Authentification | Communications d'école |
|---|---|---|
| **Sert à** | mot de passe oublié, définition du mot de passe à la création d'un compte | devoirs, relances, annonces, messages au personnel |
| **Expéditeur** | `contact@bilaleducation.fr` — SMTP du **projet Supabase** | SMTP **propre à l'établissement**, saisi dans sa fiche |
| **Gabarits** | ces trois fichiers, **globaux au projet** | construits dans le code (`src/lib/email.ts`, `src/lib/communications/`) |

Les deux circuits sont **indépendants**. Une école dont la messagerie n'est pas
configurée reçoit quand même ses emails d'authentification.

---

## Les trois gabarits

| Fichier | Emplacement dans Supabase | Objet à saisir |
|---|---|---|
| `reset-password.html` | Authentication → Emails → Templates → **Reset Password** | `Définissez votre mot de passe Bilal Education` |
| `password-changed.html` | Authentication → Emails → Templates → **Password changed** | `Le mot de passe de votre compte a été modifié` |
| `email-changed.html` | Authentication → Emails → Templates → **Email address changed** | `L'adresse de connexion de votre compte a changé` |

### Les deux notifications de sécurité doivent être ACTIVÉES

Elles sont désactivées par défaut au niveau du projet, et un gabarit collé sans
activation ne partira jamais. Décision du 8 août : on active les deux.

### Pourquoi trois, et pas les six gabarits d'authentification

Vérifié dans le code le 8 août — **cinq des six ne se déclenchent jamais** :

| Gabarit | Pourquoi il ne part pas |
|---|---|
| Confirm signup | les 7 appels `createUser` posent `email_confirm: true` |
| Invite user | `inviteUserByEmail` n'existe pas dans le code |
| Magic link | `signInWithOtp` n'existe pas |
| Change email address | `updateUserById({ email })` change l'adresse **sans confirmation** |
| Reauthentication | `reauthenticate` n'existe pas |

Les habiller aurait été cinq sixièmes de travail perdu. **Si l'un de ces flux est
activé un jour, son gabarit devra être écrit** — à défaut, Supabase enverra son
gabarit anglais par défaut, hors charte.

---

## Réglages du projet à vérifier

### 1. SMTP (Project Settings → Authentication → SMTP)

Expéditeur `contact@bilaleducation.fr`, nom d'affichage `Bilal Education`.

L'expéditeur intégré de Supabase est plafonné à **deux ou trois messages par
heure** : c'est un service de démonstration, inutilisable dès la deuxième école
créée dans l'heure.

> **Règle de délivrabilité** : l'adresse d'expédition doit être celle du compte
> SMTP, pour que SPF et DKIM s'alignent. Mettre `contact@bilaleducation.fr` en
> expéditeur tout en passant par le SMTP d'un autre domaine classe le message en
> indésirable, quand il n'est pas rejeté.

### 2. Durée de validité (Authentication → Email OTP expiration)

Le gabarit `reset-password.html` **annonce une heure**. C'est la valeur par défaut
de Supabase. **Si ce réglage change, la phrase du gabarit doit changer avec lui** —
un email qui promet une heure sur un lien valable dix minutes produit un appel au
support à chaque envoi.

### 3. Redirect URLs (Authentication → URL Configuration)

L'allow-list doit couvrir les sous-domaines d'école, sans quoi Supabase refuse la
redirection et le lien ne mène nulle part :

```
https://*.bilaleducation.fr/**
```

**Ne pas ajouter de variante `www.`** — et ce n'est pas une question de goût. Le
certificat générique `*.bilaleducation.fr` couvre **exactement un niveau** :
`www.ecole.bilaleducation.fr` n'est couvert par rien et déclenche
« votre connexion n'est pas privée » chez le destinataire. L'application
normalise déjà les liens qu'elle fabrique (`src/lib/tenant/canonical-host.ts`) ;
autoriser la forme `www.` dans Supabase ne ferait que rouvrir la porte.

---

## Risque connu, non traité

**Les analyseurs de liens consomment le jeton.** Certaines messageries
d'entreprise ouvrent les liens d'un message avant l'utilisateur, pour les
inspecter. Le lien de réinitialisation étant à **usage unique**, il est alors
déjà brûlé : le destinataire lit « lien expiré » sur un email qui vient
d'arriver.

Le contournement documenté consiste à ne pas envoyer le lien direct, mais à
construire une adresse portant `{{ .TokenHash }}` vers une route maison
(`/auth/confirm`) qui ne consomme le jeton qu'au moment du clic. Cette route
n'existe pas aujourd'hui.

Non traité faute d'occurrence : nos destinataires sont le personnel des écoles,
majoritairement sur des messageries grand public. **À construire si le symptôme
apparaît** — il est reconnaissable : « le lien dit qu'il a expiré alors que je
viens de recevoir le mail ».

---

## Modifier la charte

Tout est dans `build.mjs` :

- **couleurs** : objet `C` en tête, valeurs reprises de `tailwind.config.ts` et des
  jetons de `globals.css` ;
- **coque** (bandeau, carte, pied) : fonction `coque()` ;
- **fragments** : `p`, `pDoux`, `bouton`, `alerte`, `filet` ;
- **contenus** : tableau `GABARITS`.

Trois contraintes du format à ne pas défaire :

1. **mise en page en tableaux** — Outlook s'appuie sur le moteur de Word, qui
   ignore `flex` et `grid` ;
2. **aucune image distante** — Outlook et Gmail les bloquent par défaut pour un
   expéditeur inconnu, ce que nous serons au lancement. Le logotype est dessiné en
   texte et en fonds de cellule : il s'affiche toujours, et ne dépend d'aucun
   hébergement — ce qui compte, le domaine racine devant devenir une vitrine
   peut-être hébergée ailleurs ;
3. **`color-scheme: only light`** — sans lui, le thème sombre d'Apple Mail et de
   Gmail réécrit les couleurs et détruit le bandeau de marque.

## Variables disponibles

Vérifiées dans la documentation Supabase le 8 août. Une variable inconnue
**s'affiche vide, sans erreur** : ne rien inventer.

| Variable | Disponible dans |
|---|---|
| `.ConfirmationURL` | tous les emails d'authentification |
| `.TokenHash` | tous les emails d'authentification |
| `.SiteURL`, `.Email`, `.Data` | tous les gabarits |
| `.RedirectTo` | tous les emails d'authentification |
| `.NewEmail` | « Change email address » seulement |
| `.OldEmail` | « Email address changed » seulement |

`.Data` expose `auth.users.user_metadata` — **seul levier** pour afficher le nom
d'une école. Écarté le 8 août : voir l'en-tête de `build.mjs` pour le
raisonnement complet.
