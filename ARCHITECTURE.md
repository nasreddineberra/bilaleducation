# Architecture Bilal Education

## 🏗️ Vue d'ensemble

Bilal Education utilise une architecture moderne en couches (layered architecture) qui sépare les responsabilités et facilite la maintenance.

```
┌─────────────────────────────────────┐
│     INTERFACE UTILISATEUR           │  <- Pages Next.js (React)
│  (Pages, Composants, Formulaires)   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    COUCHE MÉTIER (Repository)       │  <- /lib/database/*.ts
│  (Logique d'accès aux données)      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    CLIENT SUPABASE                  │  <- /lib/supabase/*.ts
│  (Connexion à la base de données)   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    SUPABASE (Backend as a Service)  │  <- PostgreSQL + Auth + Storage
│  - Base de données PostgreSQL       │
│  - Authentification                 │
│  - Row Level Security (RLS)         │
│  - Realtime subscriptions           │
└─────────────────────────────────────┘
```

## 📁 Structure des dossiers

```
bilaleducation/
│
├── src/
│   ├── app/                      # Pages Next.js 14 (App Router)
│   │   ├── (auth)/              # Groupe de routes authentification
│   │   │   └── login/           # Page de connexion
│   │   ├── dashboard/           # Zone protégée
│   │   │   ├── layout.tsx       # Layout avec sidebar
│   │   │   ├── page.tsx         # Tableau de bord
│   │   │   ├── students/        # Gestion élèves
│   │   │   ├── teachers/        # Gestion enseignants
│   │   │   └── ...
│   │   ├── layout.tsx           # Layout racine
│   │   ├── page.tsx             # Page d'accueil (redirect)
│   │   └── globals.css          # CSS global + Tailwind
│   │
│   ├── components/              # Composants réutilisables
│   │   ├── ui/                  # Composants UI de base
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Card.tsx
│   │   ├── forms/               # Formulaires
│   │   │   ├── StudentForm.tsx
│   │   │   └── GradeForm.tsx
│   │   └── layout/              # Composants de layout
│   │       ├── DashboardNav.tsx
│   │       └── DashboardSidebar.tsx
│   │
│   ├── lib/                     # Utilitaires et configurations
│   │   ├── supabase/            # Configuration Supabase
│   │   │   ├── client.ts        # Client navigateur
│   │   │   └── server.ts        # Client serveur
│   │   ├── database/            # Repository Pattern (couche d'abstraction)
│   │   │   ├── auth.ts          # Gestion authentification
│   │   │   ├── students.ts      # CRUD élèves
│   │   │   ├── teachers.ts      # CRUD enseignants
│   │   │   ├── classes.ts       # CRUD classes
│   │   │   └── ...
│   │   └── utils/               # Fonctions utilitaires
│   │       ├── dates.ts         # Manipulation dates
│   │       └── validators.ts    # Validation données
│   │
│   └── types/                   # Types TypeScript
│       └── database.ts          # Types de la BDD
│
├── supabase/                    # Configuration Supabase
│   ├── schema.sql               # Schéma de base de données
│   └── policies.sql             # Politiques RLS
│
├── public/                      # Assets statiques
│   ├── images/
│   └── favicon.ico
│
├── .env.local                   # Variables d'environnement (ne pas commit!)
├── .env.local.example           # Exemple de variables d'env
├── package.json                 # Dépendances npm
├── tsconfig.json                # Config TypeScript
├── tailwind.config.ts           # Config Tailwind CSS
├── next.config.js               # Config Next.js
└── README.md                    # Documentation
```

## 🔑 Concepts clés

### 1. Repository Pattern

Le Repository Pattern est une couche d'abstraction entre votre application et la base de données. Tous les accès aux données passent par ces "repositories".

**Avantages :**
- ✅ Migration facile vers une autre BDD si nécessaire
- ✅ Code réutilisable et testable
- ✅ Un seul endroit à modifier pour changer la logique d'accès
- ✅ Séparation claire des responsabilités

**Exemple d'utilisation :**

```typescript
// ❌ MAUVAIS : Accès direct à Supabase dans le composant
function StudentsList() {
  const supabase = createClient()
  const { data } = await supabase.from('students').select('*')
  // ...
}

// ✅ BON : Utilisation du repository
function StudentsList() {
  const students = await studentRepository.getAll()
  // ...
}
```

### 2. Server Components vs Client Components

**Server Components** (par défaut) :
- Exécutés côté serveur
- Accès direct aux données (BDD, API)
- Pas d'état React (useState, useEffect)
- Meilleure performance, moins de JavaScript envoyé au client

```typescript
// app/dashboard/students/page.tsx
export default async function StudentsPage() {
  const students = await studentRepository.getAll() // ✅ Serveur
  return <StudentsList students={students} />
}
```

**Client Components** :
- Exécutés dans le navigateur
- Nécessitent `'use client'` en première ligne
- Permettent l'interactivité (onClick, useState, etc.)
- Utilisés pour les formulaires, boutons, modales

```typescript
'use client' // ← Obligatoire

export default function StudentForm() {
  const [name, setName] = useState('') // ✅ Client
  const handleSubmit = async () => { ... }
  return <form onSubmit={handleSubmit}>...</form>
}
```

### 3. Authentification et protection des routes

**Middleware** (`src/middleware.ts`) :
- Vérifie l'authentification sur chaque requête
- Redirige vers `/login` si non authentifié
- Rafraîchit automatiquement la session

**Protection par rôle** :
- Les politiques RLS empêchent l'accès non autorisé aux données
- Même si un utilisateur devine une URL, il ne verra que ce qu'il a le droit de voir

### 4. Row Level Security (RLS)

RLS est le système de sécurité de PostgreSQL qui filtre automatiquement les données selon l'utilisateur.

**Exemple :** Un parent ne voit que les données de ses propres enfants, même s'il fait une requête `SELECT * FROM students`.

Les politiques sont définies dans `supabase/policies.sql`.

## 🎨 Conventions de code

### Nommage

```typescript
// Fichiers
StudentForm.tsx        // Composants : PascalCase
students.ts           // Utilitaires : kebab-case
database.ts           // Types : kebab-case

// Variables et fonctions
const studentName = ''           // camelCase
function getStudentById() {}     // camelCase

// Composants et types
type Student = {}                // PascalCase
interface StudentProps {}        // PascalCase
function StudentCard() {}        // PascalCase

// Constantes
const API_URL = ''              // UPPERCASE
```

### Organisation des imports

```typescript
// 1. Imports React/Next
import { useState } from 'react'
import Link from 'next/link'

// 2. Imports bibliothèques tierces
import { clsx } from 'clsx'

// 3. Imports locaux
import { studentRepository } from '@/lib/database/students'
import type { Student } from '@/types/database'
import StudentCard from '@/components/StudentCard'
```

### Commentaires

```typescript
/**
 * Récupère tous les élèves actifs
 * @returns Liste des élèves
 */
async function getActiveStudents(): Promise<Student[]> {
  // Logique...
}
```

## 🔄 Flux de données

### Affichage d'une liste (Server Component)

```
1. Page (/dashboard/students/page.tsx)
   └─> Appelle studentRepository.getAll()
       └─> Repository appelle Supabase
           └─> RLS filtre selon l'utilisateur
               └─> Données retournées
                   └─> Page affiche les données
```

### Création d'un élève (Client Component)

```
1. Formulaire (StudentForm.tsx)
   └─> Utilisateur remplit le formulaire
       └─> onClick sur "Enregistrer"
           └─> Appelle studentRepository.create()
               └─> Repository appelle Supabase
                   └─> RLS vérifie les permissions
                       └─> Données insérées
                           └─> Router.refresh() pour recharger
```

## 🛠️ Bonnes pratiques

### 1. Toujours utiliser les repositories

```typescript
// ❌ MAUVAIS
const { data } = await supabase.from('students').select('*')

// ✅ BON
const students = await studentRepository.getAll()
```

### 2. Gérer les erreurs

```typescript
try {
  const student = await studentRepository.create(newStudent)
  // Succès
} catch (error) {
  console.error('Erreur:', error)
  // Afficher un message à l'utilisateur
}
```

### 3. Typer tout avec TypeScript

```typescript
// ❌ MAUVAIS
function createStudent(data: any) { ... }

// ✅ BON
function createStudent(data: Omit<Student, 'id' | 'created_at'>) { ... }
```

### 4. Composants petits et réutilisables

```typescript
// ❌ MAUVAIS : Un gros composant qui fait tout
function StudentPage() {
  return (
    <div>
      {/* 500 lignes de code */}
    </div>
  )
}

// ✅ BON : Plusieurs petits composants
function StudentPage() {
  return (
    <>
      <StudentHeader />
      <StudentsList />
      <StudentStats />
    </>
  )
}
```

### 5. Utiliser les types de Supabase

```typescript
// Les types dans /types/database.ts correspondent exactement
// au schéma SQL. Ne pas les modifier manuellement.
// Si vous changez la BDD, regénérez les types.
```

## 📝 Développement d'une nouvelle fonctionnalité

### Exemple : Ajouter la gestion des absences

1. **Créer le repository** (`src/lib/database/absences.ts`)
   ```typescript
   export const absenceRepository = {
     getAll: async () => { ... },
     create: async (absence) => { ... },
     // ...
   }
   ```

2. **Créer la page** (`src/app/dashboard/absences/page.tsx`)
   ```typescript
   export default async function AbsencesPage() {
     const absences = await absenceRepository.getAll()
     return <AbsencesList absences={absences} />
   }
   ```

3. **Créer les composants** (`src/components/absences/...`)
   - `AbsencesList.tsx` (Server Component)
   - `AbsenceForm.tsx` (Client Component)

4. **Tester**
   - Créer quelques absences
   - Vérifier que les RLS fonctionnent
   - Tester avec différents rôles

## 🚀 Commandes utiles

```bash
# Développement
npm run dev              # Lancer le serveur de dev

# Production
npm run build            # Compiler pour production
npm run start            # Lancer en production

# Qualité de code
npm run lint             # Vérifier le code
npm run type-check       # Vérifier les types TypeScript
```

## 📚 Ressources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

Cette architecture est conçue pour évoluer avec votre projet. Vous pouvez ajouter de nouvelles fonctionnalités facilement en suivant les mêmes patterns ! 🎉
