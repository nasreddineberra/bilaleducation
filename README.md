# Bilal Education - ERP pour École de Langue Arabe

Application web complète de gestion d'école pour 200 élèves et 20 enseignants.

## 🎯 Stack Technique

- **Frontend** : Next.js 14 + React + TypeScript
- **Styling** : Tailwind CSS
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Déploiement** : Vercel (frontend) + Supabase (backend)

## 📋 Fonctionnalités

### Phase 1 - MVP (Mars-Avril 2026)
- ✅ Authentification multi-rôles (Admin, Enseignant, Parent, Élève)
- ✅ Gestion des élèves et parents
- ✅ Gestion des classes et inscriptions
- ✅ Saisie et consultation des notes
- ✅ Gestion des absences

### Phase 2 - Fonctionnalités avancées (Mai-Juin 2026)
- ✅ Communication (annonces par classe/école)
- ✅ Tableau de bord personnalisé par rôle
- ✅ Module financier (inscriptions, paiements)
- ✅ Génération de bulletins PDF
- ✅ Planning des enseignants

### Phase 3 - Finitions (Juillet 2026)
- ✅ Statistiques et rapports
- ✅ Notifications temps réel
- ✅ Export de données
- ✅ Tests et optimisations

## 🚀 Installation

### Prérequis

- Node.js 18+ installé
- Compte Supabase (gratuit)
- VS Code + Claude Code

### Étape 1 : Cloner et installer les dépendances

```bash
cd bilaleducation
npm install
```

### Étape 2 : Configuration Supabase

1. Créer un compte sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Aller dans SQL Editor et exécuter le fichier `supabase/schema.sql`
4. Activer l'authentification Email dans Authentication > Providers
5. Copier les clés API depuis Settings > API

### Étape 3 : Variables d'environnement

Créer un fichier `.env.local` à la racine :

```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
```

### Étape 4 : Lancer le serveur de développement

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 📁 Structure du projet

```
bilaleducation/
├── src/
│   ├── app/                    # Pages Next.js (App Router)
│   │   ├── (auth)/            # Routes authentification
│   │   ├── (dashboard)/       # Routes tableau de bord
│   │   ├── layout.tsx         # Layout principal
│   │   └── page.tsx           # Page d'accueil
│   ├── components/            # Composants réutilisables
│   │   ├── ui/               # Composants UI de base
│   │   ├── forms/            # Formulaires
│   │   └── layout/           # Composants de layout
│   ├── lib/                   # Utilitaires et configurations
│   │   ├── supabase/         # Client Supabase
│   │   ├── database/         # Couche d'abstraction BDD
│   │   └── utils/            # Fonctions utilitaires
│   └── types/                 # Types TypeScript
├── supabase/                  # Configuration Supabase
│   ├── schema.sql            # Schéma de base de données
│   └── policies.sql          # Politiques RLS
├── public/                    # Assets statiques
└── package.json
```

## 🔐 Rôles et Permissions

- **Admin** : Accès complet à toutes les fonctionnalités
- **Enseignant** : Gestion de ses classes, notes, absences
- **Parent** : Consultation des informations de ses enfants
- **Élève** : Consultation de ses notes et absences

## 🛠️ Commandes utiles

```bash
npm run dev          # Lancer en développement
npm run build        # Build production
npm run start        # Lancer en production
npm run lint         # Vérifier le code
npm run type-check   # Vérifier les types TypeScript
```

## 📚 Documentation

- [Next.js](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs)

## 🤝 Support

Pour toute question, contacter l'équipe de développement.

## 📅 Planning

- **Février-Mars 2026** : Fondations et CRUD de base
- **Avril-Mai 2026** : Fonctionnalités core (notes, absences, communication)
- **Juin-Juillet 2026** : Finitions et déploiement
- **Livraison : Fin juillet 2026**

## 📝 License

Projet à but non lucratif pour école de langue arabe.
