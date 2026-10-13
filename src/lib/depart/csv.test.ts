import { test } from 'node:test'
import assert from 'node:assert/strict'
import { celluleCsv, versCsv } from './csv.ts'

test('table vide : BOM seul, le fichier existe', () => {
  assert.equal(versCsv([]), '﻿')
})

test('ordre des colonnes = celui de la premiere ligne', () => {
  const csv = versCsv([{ nom: 'A', id: 1 }, { id: 2, nom: 'B' }])
  assert.equal(csv, '﻿nom;id\r\nA;1\r\nB;2\r\n')
})

test('une colonne absente de la premiere ligne est ajoutee, pas perdue', () => {
  const csv = versCsv([{ a: 1 }, { a: 2, b: 'x' }])
  assert.equal(csv, '﻿a;b\r\n1;\r\n2;x\r\n')
})

test('null et undefined donnent une cellule vide', () => {
  assert.equal(celluleCsv(null), '')
  assert.equal(celluleCsv(undefined), '')
})

test('separateur, guillemet et retour a la ligne sont proteges', () => {
  assert.equal(celluleCsv('a;b'), '"a;b"')
  assert.equal(celluleCsv('dit "oui"'), '"dit ""oui"""')
  assert.equal(celluleCsv('ligne1\nligne2'), '"ligne1\nligne2"')
})

test('objets et tableaux en JSON', () => {
  assert.equal(celluleCsv({ a: 1 }), '"{""a"":1}"')
  assert.equal(celluleCsv(['x']), '"[""x""]"')
})

test('injection de formule neutralisee, telephones et negatifs intacts', () => {
  assert.equal(celluleCsv('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"')
  assert.equal(celluleCsv('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(celluleCsv('+33612345678'), '+33612345678')
  assert.equal(celluleCsv(-12.5), '-12.5')
})

test('booleens et nombres', () => {
  assert.equal(celluleCsv(true), 'true')
  assert.equal(celluleCsv(0), '0')
})
