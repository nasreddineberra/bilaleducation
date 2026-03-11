# Guide d'installation BilalNotes

Ce guide vous accompagne pas à pas pour installer et configurer l'application BilalNotes.

## 📋 Prérequis

### 1. Installer Node.js

- Télécharger Node.js 18+ depuis https://nodejs.org
- Vérifier l'installation :
```bash
node --version  # Doit afficher v18.x ou supérieur
npm --version   # Doit afficher 9.x ou supérieur
```

### 2. Installer Visual Studio Code

- Télécharger depuis https://code.visualstudio.com
- Extensions recommandées :
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - GitLens

### 3. Installer Git (optionnel mais recommandé)

- Télécharger depuis https://git-scm.com

## 🚀 Installation

### Étape 1 : Ouvrir le projet dans VS Code

1. Ouvrir VS Code
2. File > Open Folder
3. Sélectionner le dossier `bilalnotes`
4. Ouvrir le terminal intégré (Ctrl + `)

### Étape 2 : Installer les dépendances

Dans le terminal VS Code :

```bash
npm install
```

Cette commande va télécharger toutes les bibliothèques nécessaires (Next.js, React, Tailwind, Supabase, etc.). Cela peut prendre 2-3 minutes.

### Étape 3 : Créer un compte Supabase

1. Aller sur https://supabase.com
2. Cliquer sur "Start your project"
3. Se connecter avec GitHub (ou créer un compte)
4. Cliquer sur "New Project"
5. Remplir :
   - Name: `bilalnotes`
   - Database Password: Choisir un mot de passe fort (le noter !)
   - Region: Europe West (Ireland) pour les meilleures performances
   - Plan: Free (gratuit)
6. Cliquer sur "Create new project"
7. Attendre 1-2 minutes que le projet soit créé

### Étape 4 : Créer la base de données

1. Dans Supabase, aller dans l'onglet "SQL Editor" (dans le menu de gauche)
2. Cliquer sur "New query"
3. Copier tout le contenu du fichier `supabase/schema.sql`
4. Coller dans l'éditeur SQL
5. Cliquer sur "Run" (en bas à droite)
6. Vérifier qu'il n'y a pas d'erreurs (message de succès)

### Étape 5 : Appliquer les politiques de sécurité

1. Toujours dans "SQL Editor"
2. Cliquer sur "New query"
3. Copier tout le contenu du fichier `supabase/policies.sql`
4. Coller dans l'éditeur SQL
5. Cliquer sur "Run"
6. Vérifier le message de succès

### Étape 6 : Récupérer les clés API

1. Dans Supabase, aller dans "Settings" (icône engrenage en bas du menu)
2. Cliquer sur "API" dans le sous-menu
3. Copier les valeurs suivantes :
   - **Project URL** : `https://xxxxxxxxx.supabase.co`
   - **anon public** : `eyJhbG...` (très longue clé)

### Étape 7 : Configurer les variables d'environnement

1. Dans VS Code, copier le fichier `.env.local.example`
2. Le renommer en `.env.local`
3. Ouvrir `.env.local` et remplacer :
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_publique_ici
   ```
   Par vos vraies valeurs copiées à l'étape 6
4. Sauvegarder le fichier (Ctrl + S)

### Étape 8 : Créer le premier compte admin

1. Dans Supabase, aller dans "Authentication" > "Users"
2. Cliquer sur "Add user" > "Create new user"
3. Remplir :
   - Email: `admin@bilaleducation.fr`
   - Password: `Admin123!` (ou votre choix)
   - Cocher "Auto Confirm User"
4. Cliquer sur "Create user"
5. Copier l'ID de l'utilisateur (un long texte comme `550e8400-e29b-41d4-a716-446655440000`)

6. Retourner dans "SQL Editor" > "New query"
7. Exécuter cette requête (remplacer `ID_UTILISATEUR` par l'ID copié) :
   ```sql
   INSERT INTO profiles (id, email, role, first_name, last_name)
   VALUES (
     'ID_UTILISATEUR',
     'admin@bilalnotes.fr',
     'admin',
     'Admin',
     'BilalNotes'
   );
   ```
8. Cliquer sur "Run"

### Étape 9 : Lancer l'application

Dans le terminal VS Code :

```bash
npm run dev
```

Attendre quelques secondes que le serveur démarre. Vous devriez voir :

```
▲ Next.js 14.1.0
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000
```

### Étape 10 : Tester l'application

1. Ouvrir un navigateur
2. Aller sur http://localhost:3000
3. Vous devriez être redirigé vers la page de connexion
4. Se connecter avec :
   - Email: `admin@bilalnotes.fr`
   - Mot de passe: celui que vous avez choisi
5. Vous devriez accéder au tableau de bord !

## ✅ Vérification de l'installation

Si tout fonctionne, vous devriez :
- ✅ Voir la page de connexion
- ✅ Pouvoir vous connecter
- ✅ Voir le tableau de bord avec les statistiques (0 partout au début)
- ✅ Voir le menu de gauche avec toutes les sections

## ❌ Problèmes fréquents

### Erreur "Module not found"
```bash
npm install
```

### Erreur "Invalid Supabase URL"
- Vérifier que `.env.local` est bien créé
- Vérifier que les valeurs sont correctes (pas de guillemets, pas d'espaces)

### Erreur "Failed to fetch"
- Vérifier que le serveur de dev tourne (`npm run dev`)
- Vérifier que Supabase est bien configuré

### Erreur "Invalid login credentials"
- Vérifier que l'utilisateur admin a bien été créé dans Supabase
- Vérifier que le profil a bien été inséré dans la table `profiles`

## 🎯 Prochaines étapes

Maintenant que l'installation est terminée, vous pouvez :

1. **Ajouter des données de test** (voir `GUIDE_UTILISATION.md`)
2. **Créer d'autres utilisateurs** (enseignants, parents)
3. **Commencer le développement** des fonctionnalités

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifier que toutes les étapes ont été suivies
2. Consulter les logs dans le terminal
3. Vérifier la console du navigateur (F12)
4. Chercher l'erreur sur Google ou dans la documentation Next.js/Supabase

## 🔄 Redémarrer après installation

Pour les prochaines fois, il suffit de :

1. Ouvrir VS Code dans le dossier `bilalnotes`
2. Ouvrir le terminal (Ctrl + `)
3. Lancer `npm run dev`
4. Ouvrir http://localhost:3000

C'est tout ! 🎉
