# Conception · Planning, absences et présence

Validée par l'utilisateur le 27/10/2026. Référence du chantier : toute évolution de ces écrans s'y conforme,
et toute entorse se décide ici d'abord.

## Pourquoi

« Qui fait cours, quand, sur quoi » s'écrivait à cinq endroits : planning de la fiche classe, titulaire et
remplaçant de la fiche classe (recopiés sur chaque créneau), emploi du temps (série entière, séance, glisser),
Temps de présence (absences et remplaçants), et le créneau lui-même. Quatre façons de dire qui enseigne,
recollées par chaque écran : des copies périmées (ex. l'ancien titulaire encore proposé sur un créneau
« Prof non affecté »). Au 27/10 l'école réelle n'a aucun créneau ni saisie de temps : changer de modèle
ne coûte presque rien maintenant.

## 1. Principe : une information, un seul écran qui l'écrit

| Information | Écrite dans | Lue dans |
|---|---|---|
| Créneaux récurrents (jour, horaires, dates d'effet, cours / activité, matière / nom) | **Fiche classe** | EDT, tableaux de bord |
| Titulaire (arrivée, départ, historique) | **Fiche classe** | EDT, Absences enseignants |
| Absence d'un enseignant (courte ou longue) et décision par séance | **Absences enseignants** (Gestion) | EDT, fiche classe, fiche enseignant, Temps de présence |
| Séance ponctuelle : ajoutée, annulée, salle changée | **EDT** | tableaux de bord, Temps de présence |
| Présence validée | **EDT** | Temps de présence |
| Heures et coûts | calculés | **Temps de présence** |

## 2. Qui assure une séance : une règle, un fichier

L'enseignant n'est plus RECOPIÉ sur le créneau, il est DÉDUIT pour chaque date :

1. séance **annulée** : elle n'a pas lieu (personne, aucune heure) ;
2. sinon, **remplaçant** désigné pour cette séance (page Absences enseignants) ;
3. sinon, **titulaire en poste** ce jour-là (fiche classe, dates d'affectation) ;
4. sinon, **« Prof non affecté »** : la séance a lieu, sans enseignant désigné.

« Annulée » et « Prof non affecté » sont DEUX états distincts, jamais confondus.
Une séance d'un enseignant absent sans décision est **« Enseignant absent · à décider »**.

## 3. Absences enseignants (nouvelle page, menu Gestion, encadrement)

- Seul chemin pour les absences d'enseignant et pour les remplacements.
- Déclarer : enseignant, du / au, **par demi-journées**, motif.
- Les créneaux touchés s'affichent aussitôt, **groupés par créneau de la semaine** (« CE1 · mercredi
  15:00-16:00 · 3 séances »), détaillables **séance par séance**. Pour chacun, trois choix explicites :
  **Remplacé par…**, **Annulé**, **À décider** (défaut : un oubli n'annule jamais un cours).
  « Même décision pour tous » couvre une longue absence. Un enseignant peut remplacer un seul créneau,
  voire une seule séance.
- Modifier ou supprimer une absence met à jour ses séances.
- Séance annulée : proposition de **prévenir les familles** de la classe (case cochée par défaut, un email
  par foyer).
- L'**enseignant voit ses propres absences**, en lecture seule.

## 4. Fiche classe

- Gère : créneaux de la semaine, titulaire, salle.
- **Salle** : « Même salle pour tous les créneaux » (salle de la classe) OU salle choisie créneau par créneau.
  Salle d'une séance DÉDUITE (`salleDeSeance`) : changée pour cette séance, sinon séance ponctuelle (la
  sienne), sinon salle de la classe, sinon salle du créneau. Jamais recopiée.
- Ne gère plus aucun remplacement ; encadré **« Remplacements »** en LECTURE (créneaux remplacés ou
  annulés, en cours et à venir), lien vers l'absence.

## 5. Emploi du temps : lecture et actions ponctuelles

- **Garde** : consulter, valider la présence, **ajouter une séance ponctuelle**, **annuler une séance**
  (encadrement seulement), **changer la salle** d'une séance, **régler une absence** (même décision que la
  page Absences).
- **Retire** : modifier / supprimer la série, changer l'horaire ou l'enseignant d'une séance, glisser-déposer,
  créer un créneau récurrent. Un cours décalé = annuler la séance + ajouter une séance ponctuelle.
- **Séance annulée : jamais effacée de l'écran.** Toutes ses informations restent, fond gris, gros tampon
  « ANNULÉ » rouge au centre ; **réactivable** (une
  annulation par erreur se rattrape). Une séance VALIDÉE ne s'annule pas sans retirer d'abord la validation.
- **Double confirmation** pour annuler ou supprimer une séance : récapitulatif complet (classe, date,
  horaire, intitulé, enseignant, salle) et saisie de « ANNULATION » / « SUPPRESSION ».
- **Menu « ⋯ »** (encadrement), une action absente quand elle ne s'applique pas :
  séance de la fiche classe : Annuler · Changer la salle · Ouvrir la fiche classe ;
  séance ponctuelle : Annuler · Changer la salle · Supprimer · Ouvrir la fiche classe ;
  séance annulée : Réactiver · (Supprimer si ponctuelle) · Ouvrir la fiche classe.
  La validation reste sur le bouton ✓ de la séance. L'enseignant n'a pas de menu.

## 6. Temps de présence

- Heures de cours = séances validées ; une séance annulée ne compte pour personne.
- Absences d'enseignant : plus saisies ici, lues depuis Absences enseignants.
- Autres membres du personnel : inchangé (saisie ici).

## 7. Lots

1. **Règle unique « qui assure la séance »** (FAIT 27/10), branchée en lecture sur l'EDT et les tableaux de bord.
2. **EDT simplifié** (FAIT 27/10) : retrait des modifications de série, d'horaire, d'enseignant ; ajout
   ponctuel, annulation (visible, réactivable), salle conservés.
3. **Absences enseignants** : page, table des absences, décision par séance, emails aux familles.
4. **Temps de présence** branché sur les absences et les annulations ; fiche classe (encadré Remplacements)
   et fiche enseignant (absences) en lecture.
5. **Nettoyage** : enseignant plus stocké sur le créneau, plus de report titulaire -> créneaux, plus de
   remplaçant dans `class_teachers`, plus de modification d'horaire ponctuelle ; contrôles en base.
