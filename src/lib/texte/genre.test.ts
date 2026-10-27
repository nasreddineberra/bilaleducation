import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accordGenre } from './genre.ts'

test('masculin et feminin', () => {
  assert.equal(accordGenre('male', 'Né le', 'Née le', 'Date de naissance'), 'Né le')
  assert.equal(accordGenre('female', 'Né le', 'Née le', 'Date de naissance'), 'Née le')
})

test('genre non specifie ou absent : la tournure neutre, jamais « (e) »', () => {
  assert.equal(accordGenre('non_specified', 'Né le', 'Née le', 'Date de naissance'), 'Date de naissance')
  assert.equal(accordGenre(null, 'Né le', 'Née le', 'Date de naissance'), 'Date de naissance')
  assert.equal(accordGenre(undefined, 'Né le', 'Née le', 'Date de naissance'), 'Date de naissance')
  assert.equal(accordGenre('', 'Né le', 'Née le', 'Date de naissance'), 'Date de naissance')
})
