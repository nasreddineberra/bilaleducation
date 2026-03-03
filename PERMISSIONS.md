# Matrice des permissions Bilal Education - Documentation complète

## 🎯 Vue d'ensemble

Cette matrice définit **exactement** quelles actions chaque rôle peut effectuer dans l'application.

## 👥 Les 7 rôles

### Admin (Super-admin technique)
- **Qui ?** Compte technique unique
- **Usage** : Compte de secours si problème avec les comptes Direction
- **Visibilité** : Caché du personnel, pas connu de l'école
- **Permissions** : TOUT (accès complet à toutes les fonctionnalités)

### Direction (Chef d'établissement)
- **Qui ?** Direction de l'école (peut être plusieurs personnes)
- **Usage** : Gestion quotidienne de l'école
- **Visibilité** : Supérieur de tout le personnel
- **Permissions** : Presque tout (sauf certaines fonctions super-admin)

### Comptable
- **Qui ?** Responsable financier
- **Permissions spécifiques** : Gestion complète des paiements, accès aux communications

### Responsable pédagogique
- **Qui ?** Responsable des programmes et de la pédagogie
- **Permissions spécifiques** : Gestion des Matières/UE/Modules, classes, notes, absences

### Enseignant
- **Qui ?** Professeurs
- **Permissions spécifiques** : Gestion de leurs propres classes (notes et absences de LEURS classes uniquement)

### Secrétaire
- **Qui ?** Personnel administratif
- **Permissions spécifiques** : Gestion des élèves, absences

### Parent
- **Qui ?** Parents d'élèves
- **Permissions** : Consultation uniquement (notes, absences, paiements de LEURS enfants)

## 📋 Matrice détaillée

### 1. Gestion des élèves

| Rôle | Permissions | Détails |
|------|------------|---------|
| Admin | ✅ Complète | Tout |
| Direction | ✅ Complète | Tout |
| Comptable | ❌ Aucune | - |
| Resp. Pédago | ❌ Aucune | - |
| Enseignant | 👁️ Lecture | Peut voir tous les élèves |
| Secrétaire | ✅ Complète | Créer, modifier, supprimer élèves |
| Parent | 👶 Ses enfants | Voir uniquement ses propres enfants |

### 2. Gestion des enseignants

| Rôle | Permissions | Détails |
|------|------------|---------|
| Admin | ✅ Complète | Tout |
| Direction | ✅ Complète | Créer, modifier, supprimer enseignants |
| Comptable | ❌ Aucune | - |
| Resp. Pédago | ❌ Aucune | - |
| Enseignant | ❌ Aucune | - |
| Secrétaire | ❌ Aucune | - |
| Parent | ❌ Aucune | - |

### 3. Gestion des classes

| Rôle | Permissions | Détails |
|------|------------|---------|
| Admin | ✅ Complète | Tout |
| Direction | ✅ Complète | Créer, modifier, supprimer classes |
| Comptable | ❌ Aucune | - |
| Resp. Pédago | ✅ Complète | Créer, modifier, supprimer classes |
| Enseignant | 👁️ Lecture | Voir toutes les classes |
| Secrétaire | ❌ Aucune | - |
| Parent | ❌ Aucune | - |

### 4. Gestion Matières / Unités d'Enseignement / Modules

**Structure : Matière → UE → Module**

| Rôle | Permissions | Détails |
|------|------------|---------|
| Admin | ✅ Complète | Gérer les 3 niveaux |
| Direction | ✅ Complète | Gérer les 3 niveaux |
| Comptable | ❌ Aucune | - |
| Resp. Pédago | ✅ Complète | Gérer les 3 niveaux (responsable des programmes) |
| Enseignant | 👁️ Lecture | Voir la structure complète |
| Secrétaire | ❌ Aucune | - |
| Parent | ❌ Aucune | - |

### 5. Notes (Évaluations et notes)

| Rôle | Permissions | Détails |
|------|------------|---------|
| Admin | ✅ Complète | Tout |
| Direction | ✅ Complète | Tout |
| Comptable | ❌ Aucune | - |
| Resp. Pédago | ✅ Complète | Tout |
| Enseignant | 📝 Ses classes | Créer évaluations et saisir notes UNIQUEMENT pour ses classes |
| Secrétaire | ❌ Aucune | - |
| Parent | 👶 Ses enfants | Voir notes de ses enfants uniquement |

**Détails Enseignant :**
- Peut créer des évaluations pour ses classes
- Peut saisir/modifier/supprimer des notes pour ses classes
- Peut voir toutes les notes (mais modifier uniquement ses classes)

### 6. Absences et retards

| Rôle | Permissions | Détails |
|------|------------|---------|
| Admin | ✅ Complète | Tout |
| Direction | ✅ Complète | Tout |
| Comptable | ❌ Aucune | - |
| Resp. Pédago | ✅ Complète | Tout |
| Enseignant | 📝 Ses classes | Marquer absences UNIQUEMENT pour ses classes |
| Secrétaire | ✅ Complète | Gérer toutes les absences |
| Parent | 👶 Ses enfants | Voir absences de ses enfants + justifier |

**Détails Enseignant :**
- Peut marquer absents les élèves de ses classes
- Peut voir toutes les absences (mais modifier uniquement ses classes)

### 7. Communications aux parents

**Types :** Générale, Par classe, Multi-parents sélectionnés

| Rôle | Permissions | Détails |
|------|------------|---------|
| Admin | ✅ Complète | Créer, publier, gérer toutes communications |
| Direction | ✅ Complète | Créer, publier, gérer toutes communications |
| Comptable | ✅ Complète | Créer, publier, gérer communications |
| Resp. Pédago | ✅ Complète | Créer, publier, gérer communications |
| Enseignant | ✅ Complète | Créer, publier communications |
| Secrétaire | ✅ Complète | Créer, publier communications |
| Parent | 👁️ Lecture | Voir communications qui le concernent |

**Détails :**
- Tout le personnel peut créer et envoyer des communications aux parents
- Parents voient : annonces générales + annonces de classe de leurs enfants + annonces qui leur sont spécifiquement adressées
- Parents peuvent marquer comme "lu"

### 8. Communications internes (personnel)

**Pour :** Messages entre membres du personnel

| Rôle | Permissions | Détails |
|------|------------|---------|
| Admin | ✅ Complète | Créer, envoyer à qui il veut |
| Direction | ✅ Complète | Créer, envoyer à qui il veut |
| Comptable | ✅ Complète | Créer, envoyer à qui il veut |
| Resp. Pédago | ✅ Complète | Créer, envoyer à qui il veut |
| Enseignant | ✅ Complète | Créer, envoyer à qui il veut |
| Secrétaire | ✅ Complète | Créer, envoyer à qui il veut |
| Parent | ❌ Aucune | N'a pas accès aux communications internes |

**Exemples d'usage :**
- Direction → Tous les enseignants : "Réunion pédagogique vendredi"
- Admin → Comptable + Secrétaire : "Clôture comptable"
- Responsable pédagogique → Enseignants niveau 1 : "Nouveaux supports"

### 9. Paiements (Inscriptions, frais de scolarité)

| Rôle | Permissions | Détails |
|------|------------|---------|
| Admin | ✅ Complète | Tout |
| Direction | ✅ Complète | Tout |
| Comptable | ✅ Complète | Créer, modifier, gérer tous les paiements |
| Resp. Pédago | ❌ Aucune | - |
| Enseignant | ❌ Aucune | - |
| Secrétaire | ❌ Aucune | - |
| Parent | 👶 Ses enfants | Voir paiements de ses enfants uniquement |

## 🔐 Politiques de sécurité (RLS)

Toutes ces permissions sont **automatiquement appliquées** au niveau de la base de données grâce aux politiques RLS (Row Level Security) de PostgreSQL.

**Cela signifie :**
- Un enseignant ne peut PAS voir les notes d'une autre classe, même s'il essaie de contourner l'interface
- Un parent ne peut PAS voir les infos des enfants d'un autre parent
- Les données sont **vraiment sécurisées** au niveau base de données, pas juste cachées dans l'interface

## 📝 Exemples concrets

### Exemple 1 : Enseignant marque une absence

**Enseignant Ahmed (enseigne Niveau 1A) :**
- ✅ Peut marquer absent un élève de sa classe Niveau 1A
- ❌ Ne peut PAS marquer absent un élève de Niveau 2A (pas sa classe)

### Exemple 2 : Parent consulte les notes

**Parent Mme Amrani (a 1 enfant : Youssef en Niveau 1A) :**
- ✅ Peut voir les notes de Youssef
- ❌ Ne peut PAS voir les notes des autres élèves de Niveau 1A

### Exemple 3 : Secrétaire gère les élèves

**Secrétaire Fatima :**
- ✅ Peut ajouter un nouvel élève
- ✅ Peut modifier les infos d'un élève
- ❌ Ne peut PAS créer d'évaluations ou saisir de notes

### Exemple 4 : Direction envoie une communication interne

**Direction Hassan :**
- ✅ Peut créer une annonce interne
- ✅ Peut sélectionner destinataires : tous les enseignants
- ✅ Peut voir qui a lu le message

### Exemple 5 : Comptable gère les paiements

**Comptable Fatima :**
- ✅ Peut créer une facture d'inscription
- ✅ Peut marquer un paiement comme reçu
- ✅ Peut voir tous les paiements en retard
- ❌ Ne peut PAS créer d'élèves ou de classes

## ✅ Validation des permissions

Après installation, vous pouvez tester que les permissions fonctionnent :

1. Créer un compte de chaque type
2. Se connecter avec chaque compte
3. Vérifier qu'on voit bien uniquement ce qu'on doit voir

Les politiques RLS garantissent que même en tentant d'accéder directement à la base de données, les permissions sont respectées.
