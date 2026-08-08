# Signature électronique — Bilal Education

`signature.html` se colle dans l'éditeur de signature de la messagerie. Ce n'est
pas du code applicatif : rien ne le lit à l'exécution, il est ici pour être
versionné — le jour où la charte bouge, la signature doit bouger avec elle.

## Telle quelle, rien à modifier

Le fichier est réglé pour **`contact@`, une adresse générique** : il ne nomme
personne. C'est délibéré — une adresse partagée n'a pas de titulaire, et y
afficher un nom laisse croire au destinataire qu'il écrit à une personne, puis
qu'on l'ignore le jour où c'est quelqu'un d'autre qui répond.

Copiez, collez, c'est fini.

### Pour une adresse nominative, plus tard

Le fichier contient un **bloc titulaire** désactivé (`Prénom NOM` / `Fonction`).
Retirez ses deux marqueurs de commentaire et remplacez les deux libellés.

Il vient **au-dessus** du nom de la marque, jamais en dessous : on lit d'abord
qui écrit, ensuite pour quelle maison.

## Installer dans Infomaniak Mail

1. Ouvrir la messagerie, puis les **paramètres** du compte ;
2. section **Signatures** → créer une signature ;
3. passer l'éditeur en **mode HTML** (bouton `< >` ou « source ») ;
4. coller le contenu de `signature.html` ;
5. enregistrer, et l'attacher à `contact@bilaleducation.fr`.

> **Le piège** : collé en mode WYSIWYG, le HTML s'affiche comme du texte brut —
> on voit les balises. Il faut le mode source, sinon rien ne fonctionne.

Même principe dans Thunderbird (« Utiliser HTML »), Outlook (éditeur de
signature) ou Apple Mail (coller le rendu, pas la source).

## Choix de fabrication

Les mêmes contraintes que les gabarits d'authentification
(`supabase/email-templates/`), pour les mêmes raisons :

- **mise en page en tableaux** — Outlook s'appuie sur le moteur de Word, qui
  ignore `flex` et `grid` ;
- **styles en ligne** — la plupart des clients suppriment les feuilles de style ;
- **filet vertical = cellule à fond coloré**, et non une bordure CSS : les
  bordures sont inégalement rendues d'un client à l'autre, un fond de cellule ne
  l'est jamais ;
- **`alt=""` sur le logo** — l'image est décorative, le nom de la marque est
  écrit juste à côté. Bloquée (Outlook de bureau, expéditeur inconnu), elle
  s'efface sans laisser ni doublon ni cadre vide ;
- **dimensions déclarées en attribut ET en style** — sans elles, un client qui
  bloque l'image réserve une place au hasard et disloque la signature.

### Le logo

`public/email/logo-signature.png` — plaque blanche arrondie, coins transparents,
produite au double de sa taille d'affichage (120 px pour 60 px affichés).

La plaque n'est pas décorative : les pétales du logo sont **transparents**, et
sans elle ils se rempliraient du fond du client de messagerie — noir dans les
thèmes sombres. C'est la décision du 3 août, déjà appliquée à `apple-icon.png`
et à la fiche établissement : un logo est dessiné pour un fond blanc.

> **Dépendance à connaître** : le fichier est servi par le domaine racine. Le
> jour où la vitrine passe sur un autre hébergeur, `/email/logo-signature.png`
> devra continuer d'être servi — sinon le logo disparaît de toutes les
> signatures envoyées, sans le moindre avertissement.

### L'accent doré

Le logotype de l'application écrit « EDUCATION » en `amber-400` (`#ffb800`),
mais **sur le fond teal foncé de la barre latérale**. Sur le fond blanc d'un
email, cette teinte tombe à moins de 2:1 — illisible.

La signature emploie donc **`amber-700` (`#996100`)**, la valeur que le projet
utilise partout où de l'ambre doit se lire sur clair. Même intention, contraste
conforme.

## Mention de confidentialité

Présente dans le fichier, **désactivée** (en commentaire). Sa valeur juridique
est très faible et elle alourdit chaque message. À n'activer que si un cadre
contractuel l'impose — retirer les deux marqueurs de commentaire.
