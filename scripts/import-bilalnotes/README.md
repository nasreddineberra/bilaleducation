# Conversion des exports de l'ancien logiciel (BilalNotes) vers le gabarit d'import

```bash
python scripts/import-bilalnotes/convertir.py
```

Aucune dépendance : un `.xlsx` est un zip de XML, le lecteur et l'écrivain sont ici.

## Ce qu'il attend, ce qu'il produit

Les deux exports, **à la racine du dépôt** (ils sont ignorés par git, voir plus bas) :

- `Export_Parents_Administratif_BilalNotes_*.xlsx`
- `Export_Enfants_Pedagogique_BilalNotes_*.xlsx`

Ils se lient par la colonne **`ID PARENTS`**. Il en sort :

| Fichier | Contenu |
|---|---|
| `Import_Bilal-Neuville.xlsx` | le fichier à déposer dans **Vie scolaire → Importation** |
| `Import_Bilal-Neuville_COMPLEMENT.xlsx` | 5 feuilles : informations médicales · à vérifier · cours adultes · enfants recollés · foyers fusionnés · écarté |

Le fichier d'import est un **clone du gabarit officiel** (`public/gabarit-import-apprenants.xlsx`)
dont seules les lignes sont remplacées : cellules `inlineStr`, listes déroulantes et colonnes
en format texte sont donc exactement celles que l'application distribue. **Si le gabarit change,
relancer `scripts/generer-gabarit-import.mts` avant ce script** — le clone suivra tout seul.

## Les décisions qu'il encode

Elles viennent de cas réels rencontrés le 3 octobre 2026, pas de précautions théoriques.

**Foyers en double.** L'ancien logiciel créait un second foyer à chaque réinscription :
13 personnes y figuraient deux fois, et le déclencheur `guard-parents-unique-tutor` les
aurait refusées une par une. Fusion par identité de tuteur, champs repris du foyer le plus
fourni, enfants réunis.

**Quasi-doublons d'enfants.** Sept lignes pour trois enfants chez MEHADHBI, avec **deux fautes
cumulées** : la date décalée d'un jour *et* le prénom transposé (`Zakariya` / `Zakaryia`).
L'égalité stricte ne les rapproche pas, et les gardes en base ne le feraient pas davantage.
Le rapprochement est donc flou — prénom équivalent (identique, anagramme ou 85 % de
ressemblance) et dates à 7 jours près — mais **borné au foyer** : deux cousins homonymes nés à
deux jours d'écart existent, deux enfants du même foyer presque homonymes, non.

**L'arbitre est la colonne `Classe(s)`.** Elle n'est pas importée — la direction reconstruit ses
classes — mais la ligne qui en porte une est celle que l'école a réellement utilisée pour
inscrire l'enfant : c'est le meilleur juge disponible sur la date *et* sur l'orthographe. À
défaut : le plus petit `ID ENFANT`, les exemplaires étant des réinscriptions.

**Ce qui n'est pas tranché l'est à voix haute.** Deux enfants du même foyer, prénoms
ressemblants **et même date exacte**, c'est aussi à quoi ressemblent des jumeaux : ils sont
laissés **séparés** et listés dans la feuille « À vérifier ». Deux fiches en trop se suppriment,
un enfant fondu dans un autre est perdu sans qu'on le voie.

**Tuteur 1 = celui qui porte NOM + Prénom + Email.** L'email du tuteur 1 est `NOT NULL` en base :
le père reste prioritaire, mais on permute plutôt que de perdre la famille.

**Adresse.** Le code postal valait `0` dans 95 cas sur 118, et la voie contenait souvent le code
postal *et* la ville. Ils en sont extraits — ce qui compte double, `import_foyer` recopiant
adresse, ville, code postal et contact d'urgence du tuteur 1 **sur chaque fiche enfant**.

**Notes médicales.** Reprises de la colonne « Commentaire », dont les 47 « Non / RAS / Aucun »
sont écartés (ils ne disent rien) ainsi que « COURS ADO », qui n'est pas médical. Le commentaire
est repris sur **n'importe quel exemplaire** d'un groupe de doublons, sinon réunir les doublons
ferait disparaître l'allergie que l'un d'eux portait.

**Corrections d'identité, uniquement sur signal vérifiable.** Inversion NOM/prénom quand le
prénom du tuteur est le nom de **ses propres** enfants ; nom sans aucune lettre retiré ; mention
d'alliance (`ÉPOUSE`, `VEUVE`, `NÉE`) retirée. Les 38 mères sous leur nom de jeune fille ne sont
**pas** touchées : ne pas porter le nom de l'enfant est le cas normal.

## Hors de portée de cet écran

- **Les foyers sans aucun enfant** (172 dans l'export de septembre 2026) : l'import crée un foyer
  *avec* ses apprenants, il ne sait pas faire autrement.
- **Les adultes** (≥ 18 ans) : neuf fois sur dix le parent lui-même, inscrit en cours adultes.
  Dans l'application un adulte est un tuteur de `parent_class_enrollments`, jamais une ligne
  `students`. Ils sont listés dans le complément, à traiter par la case *cours adultes*.
- **Classes, séances, enseignants** : la direction les reconstruit.

## Données personnelles

Ces classeurs portent les noms, emails, téléphones, adresses et **données de santé** de familles
réelles. `/*.xlsx` à la racine est dans `.gitignore` : l'historique git ne s'efface pas. Les
notes médicales relèvent de l'article 9 du RGPD — à couvrir par le contrat de sous-traitance.

## Vérifier le fichier produit

Le contrôle qui compte est de le faire lire par **le lecteur de l'application**, pas par un
lecteur écrit pour l'occasion : si l'app refuse une valeur, elle la refusera à l'écran.

```ts
// scripts/verif-tmp.mts — jetable
import readXlsxFile from 'read-excel-file/node'
import { analyserLignes } from '../src/lib/import/lire-fichier'
import { rapprocher } from '../src/lib/import/rapprocher'
const brut = (await readXlsxFile('Import_Bilal-Neuville.xlsx', { getSheets: false } as never)) as unknown
const rows = (Array.isArray(brut) && brut.length && (brut[0] as { data?: unknown }).data
  ? (brut as { data: unknown[][] }[])[0].data : brut) as unknown[][]
const lu = analyserLignes(rows)
const f = rapprocher(lu.lignes, [], [])
console.log(lu.lignes.length + ' lignes | '
  + lu.lignes.filter(l => l.erreurs.length > 0).length + ' anomalies | '
  + f.length + ' foyers')
```

```bash
npx --yes tsx scripts/verif-tmp.mts   # puis le supprimer
```

Attendu : **0 anomalie, 0 foyer bloqué**. Vérifier aussi, hors de portée du lecteur, qu'aucune
collision ne heurtera les deux gardes en base — une personne n'est tuteur qu'une fois par
établissement, un apprenant est unique par (nom, prénom, date de naissance).
