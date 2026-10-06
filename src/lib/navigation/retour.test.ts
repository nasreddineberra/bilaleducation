import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { hrefRetour, suffixeFiche, suffixeLateral } from './retour.ts'

/**
 * LE RETOUR DEPUIS UNE FICHE : ORIGINE **PUIS** ETAT DE LISTE.
 *
 * Deux regles se superposent ici, et aucune ne LEVE quand elle casse — l'ecran
 * ramene simplement au mauvais endroit, ou au bon endroit defiltre :
 *
 *  1. l'ORIGINE (06/10) : « Corriger » depuis un audit doit ramener a l'audit,
 *     pas a la liste. C'est ce qui a ete verifie a l'ecran ce jour-la, et c'est
 *     precisement ce que l'ajout de l'etat de liste pouvait casser ;
 *  2. l'ETAT (06/10, le soir) : filtre, recherche et page de la liste qu'on a
 *     quittee doivent etre rendus.
 *
 * Le premier bloc de tests est donc une NON-REGRESSION : il fige le
 * comportement de l'origine, etat present ou absent.
 */

describe('hrefRetour — l origine, qui ne doit pas casser', () => {

  test('sans origine : la liste de rattachement, comme avant', () => {
    assert.equal(hrefRetour(undefined, '/dashboard/students'), '/dashboard/students')
    assert.equal(hrefRetour(null,      '/dashboard/students'), '/dashboard/students')
    assert.equal(hrefRetour('',        '/dashboard/students'), '/dashboard/students')
  })

  test('from=audit ramene a l audit, PAS a la liste', () => {
    assert.equal(hrefRetour('audit', '/dashboard/students'), '/dashboard/passage-annee')
    assert.equal(hrefRetour('audit', '/dashboard/parents'),  '/dashboard/passage-annee')
  })

  test('from=audit resiste a l ajout de l etat de liste', () => {
    // Les liens d'audit sont batis cote serveur SANS ces cles : il n'y a donc
    // rien a apposer. Ce test fige que meme si l'une arrivait, elle ne
    // detournerait pas la destination.
    assert.equal(hrefRetour('audit', '/dashboard/students', {}), '/dashboard/passage-annee')
    assert.equal(
      hrefRetour('audit', '/dashboard/students', { lf: 'unassigned' }),
      '/dashboard/passage-annee?filter=unassigned',
    )
  })

  test('une origine INCONNUE retombe sur la liste — fail-open', () => {
    // On ne redirige jamais vers une valeur recue : seules les destinations
    // ecrites dans le module existent (pas de redirection ouverte).
    assert.equal(hrefRetour('/ailleurs.example', '/dashboard/students'), '/dashboard/students')
    assert.equal(hrefRetour('bidon',             '/dashboard/students'), '/dashboard/students')
  })
})

describe('hrefRetour — l etat de la liste', () => {

  test('les trois cles reprennent leur nom de liste', () => {
    assert.equal(
      hrefRetour(undefined, '/dashboard/students', { lq: 'ber', lf: 'active', lp: '3' }),
      '/dashboard/students?q=ber&filter=active&page=3',
    )
  })

  test('une seule cle suffit, les autres ne laissent pas de trace', () => {
    assert.equal(
      hrefRetour(undefined, '/dashboard/students', { lf: 'discipline' }),
      '/dashboard/students?filter=discipline',
    )
  })

  test('aucun etat : l adresse reste nue, sans « ? » orphelin', () => {
    assert.equal(hrefRetour(undefined, '/dashboard/students', {}), '/dashboard/students')
    assert.equal(
      hrefRetour(undefined, '/dashboard/students', { lq: '', lf: '', lp: '' }),
      '/dashboard/students',
    )
  })

  test('from=parents ramene a la liste des foyers AVEC son etat', () => {
    // Cas trouve en relisant les liens : `from=parents` designe une LISTE. Une
    // regle « l'origine gagne, l'etat est ignore » aurait ramene cette liste
    // defiltree — soit le defaut qu'on corrige, par un autre chemin.
    assert.equal(
      hrefRetour('parents', '/dashboard/students', { lq: 'mehadhbi', lf: 'unassigned' }),
      '/dashboard/parents?q=mehadhbi&filter=unassigned',
    )
  })

  test('les cles INCONNUES ne passent pas', () => {
    // On ne reconstruit que des cles connues, jamais une chaine de requete
    // recue telle quelle.
    assert.equal(
      hrefRetour(undefined, '/dashboard/students', { tab: 'documents', bidon: 'x' }),
      '/dashboard/students',
    )
  })

  test('une cle en double (tableau) prend la premiere valeur', () => {
    assert.equal(
      hrefRetour(undefined, '/dashboard/students', { lf: ['active', 'unassigned'] }),
      '/dashboard/students?filter=active',
    )
  })
})

describe('suffixeFiche — ce que la liste pose sur son lien', () => {

  test('l etat de la liste part sous le prefixe reserve', () => {
    const sp = new URLSearchParams({ q: 'ber', filter: 'active', page: '2' })
    assert.equal(suffixeFiche(sp), '?lq=ber&lf=active&lp=2')
  })

  test('une liste non filtree ne pose RIEN', () => {
    assert.equal(suffixeFiche(new URLSearchParams()), '')
    assert.equal(suffixeFiche(undefined), '')
  })

  test('les parametres etrangers a la liste ne sont pas emportes', () => {
    const sp = new URLSearchParams({ filter: 'active', tab: 'documents', from: 'audit' })
    assert.equal(suffixeFiche(sp), '?lf=active')
  })

  test('l origine declaree voyage avec l etat', () => {
    const sp = new URLSearchParams({ filter: 'adult_courses' })
    assert.equal(suffixeFiche(sp, 'parents'), '?from=parents&lf=adult_courses')
  })

  test('l aller-retour est fidele : ce que la liste pose, la fiche le rend', () => {
    // C'est l'invariant qui compte vraiment — les deux moities du mecanisme
    // vivent dans le meme module et doivent se repondre.
    const listeAvant = '?q=ber&filter=active&page=3'
    const suffixe = suffixeFiche(new URLSearchParams(listeAvant))
    const recus = Object.fromEntries(new URLSearchParams(suffixe))
    assert.equal(hrefRetour(undefined, '/dashboard/students', recus), `/dashboard/students${listeAvant}`)
  })
})

describe('suffixeLateral — le saut vers un frere ou une soeur', () => {

  test('l origine ET l etat sont repasses', () => {
    const sp = new URLSearchParams({ from: 'audit', lq: 'ber', lf: 'active', lp: '2' })
    assert.equal(suffixeLateral(sp), '?from=audit&lq=ber&lf=active&lp=2')
  })

  test('l onglet courant de la fiche ne suit PAS', () => {
    // Ouvrir la fiche d'un frere sur l'onglet « Documents » parce qu'on y etait
    // serait une surprise : le saut repart sur l'onglet par defaut.
    const sp = new URLSearchParams({ lf: 'active', tab: 'documents' })
    assert.equal(suffixeLateral(sp), '?lf=active')
  })

  test('une fiche atteinte sans etat ne fabrique rien', () => {
    assert.equal(suffixeLateral(new URLSearchParams()), '')
    assert.equal(suffixeLateral(undefined), '')
  })
})
