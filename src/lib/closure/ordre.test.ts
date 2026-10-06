import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { ordonnerAnomalies, ITEMS_CAP, type AuditItem } from './ordre.ts'

/**
 * L'ORDRE DES ANOMALIES EST UNE REGLE DE PRESENTATION PARTAGEE PAR SIX AUDITS.
 *
 * Elle ne vit qu'a un endroit (`ordonnerAnomalies`), et ses deux subtilites
 * derivent en silence si personne ne les tient : rien ne LEVE quand un tri
 * cesse d'etre stable, ou quand le plafond passe devant le tri. L'ecran
 * afficherait simplement autre chose que ce qu'on croit.
 */

const it = (label: string, detail?: string): AuditItem => ({ label, detail })

describe('ordonnerAnomalies', () => {
  test('ordre alphabetique, et non l ordre des octets', () => {
    // Avec `<`, « Élodie » (U+00C9 = 201) passerait APRES « Zoe » (Z = 90), et
    // « Ecole » avant « Éa ». C'est tout l'objet de `localeCompare('fr')`.
    const rendu = ordonnerAnomalies([it('Zoe'), it('Élodie'), it('Ecole'), it('Éa')])
      .map(i => i.label)
    assert.deepEqual(rendu, ['Éa', 'Ecole', 'Élodie', 'Zoe'])
  })

  test('NOM Prenom : c est le NOM qui ordonne', () => {
    // Les libelles du projet s'ecrivent toujours « NOM Prenom » — trier sur le
    // libelle revient donc a trier sur le nom de famille, sans rien de special.
    const rendu = ordonnerAnomalies([
      it('YAHIAOUI Slimane'), it('ABBASSI Yacine'), it('BERRA Nasr Eddine'), it('BELKACEM Hind'),
    ]).map(i => i.label)
    assert.deepEqual(rendu, ['ABBASSI Yacine', 'BELKACEM Hind', 'BERRA Nasr Eddine', 'YAHIAOUI Slimane'])
  })

  test('LE TRI EST STABLE : a libelle egal, l ordre interne de l audit survit', () => {
    // C'est ce qui sauve « Evaluations & notes », dont le libelle est un nom de
    // CLASSE repete une fois par periode : les periodes doivent rester dans
    // l'ordre de l'annee a l'interieur d'une meme classe.
    const rendu = ordonnerAnomalies([
      it('MAT-SM-BD1', 'S1'), it('ADUL-DA-BL1', 'S1'), it('MAT-SM-BD1', 'S2'), it('ADUL-DA-BL1', 'S2'),
    ]).map(i => `${i.label}/${i.detail}`)
    assert.deepEqual(rendu, ['ADUL-DA-BL1/S1', 'ADUL-DA-BL1/S2', 'MAT-SM-BD1/S1', 'MAT-SM-BD1/S2'])
  })

  test('LE TRI PRECEDE LE PLAFOND', () => {
    // Plafonner d'abord garderait un sous-ensemble ARBITRAIRE avant de
    // l'ordonner joliment. On veut les N premieres DE LA LISTE AFFICHEE.
    //
    // On fabrique une entree volontairement a contre-sens : « AAA » est en
    // DERNIERE position a l'entree, donc hors plafond si l'on coupe avant de
    // trier. Elle doit ressortir en tete.
    const entree = [
      ...Array.from({ length: ITEMS_CAP + 50 }, (_, i) => it(`Z${String(i).padStart(4, '0')}`)),
      it('AAA'),
    ]
    const rendu = ordonnerAnomalies(entree)
    assert.equal(rendu.length, ITEMS_CAP)
    assert.equal(rendu[0].label, 'AAA', 'le plafond a ete applique AVANT le tri')
  })

  test('n altere pas le tableau recu', () => {
    // Les audits reutilisent parfois leur liste (compteurs, resume) : un tri en
    // place les ferait travailler sur un ordre different de celui qu'ils ont
    // construit.
    const entree = [it('B'), it('A')]
    ordonnerAnomalies(entree)
    assert.deepEqual(entree.map(i => i.label), ['B', 'A'])
  })
})
