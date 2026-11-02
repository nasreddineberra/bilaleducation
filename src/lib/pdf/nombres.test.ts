import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eurosPdf, nombrePdf } from './nombres.ts'

test('aucune espace insecable dans un montant de PDF (Helvetica de jsPDF ne les dessine pas)', () => {
  for (const s of [eurosPdf(17160), eurosPdf(-1234567.891), nombrePdf(12345.678)]) {
    assert.doesNotMatch(s, /[  ]/)
  }
  assert.equal(eurosPdf(7990), '7 990,00 €')
  assert.equal(nombrePdf(1234.5), '1 234,5')
})
