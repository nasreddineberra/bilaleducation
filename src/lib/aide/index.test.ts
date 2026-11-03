import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  PROCEDURES, ORDRE_MODULES, concerne, couvre, procedureDeLaPage, procedureParSlug, presentationParModule,
  proceduresDuRole, rechercher, segments, texteProcedure,
} from './index.ts'

const ROLES = ['direction', 'comptable', 'secretaire', 'responsable_pedagogique', 'enseignant']

test('admin lit comme la direction ; parent et editeur sans aide', () => {
  assert.equal(concerne(['direction'], 'admin'), true)
  assert.equal(concerne(undefined, 'admin'), true)
  assert.equal(concerne(undefined, 'parent'), false)
  assert.equal(concerne(undefined, 'super_admin'), false)
  assert.equal(concerne(['comptable'], 'enseignant'), false)
})

test('adresse exacte ou prefixe', () => {
  assert.equal(couvre('/dashboard/financements/reglements', '/dashboard/financements/reglements'), true)
  assert.equal(couvre('/dashboard/financements', '/dashboard/financements/reglements'), false)
  assert.equal(couvre('/dashboard/students/*', '/dashboard/students/abc'), true)
  assert.equal(couvre('/dashboard/students/*', '/dashboard/students'), false)
})

test('procedure de la page selon le role', () => {
  assert.equal(procedureDeLaPage('/dashboard/financements/reglements', 'comptable')?.slug, 'reglements')
  assert.equal(procedureDeLaPage('/dashboard/financements/reglements', 'admin')?.slug, 'reglements')
  assert.equal(procedureDeLaPage('/dashboard/financements/reglements', 'enseignant'), null)
  assert.equal(procedureParSlug('reglements', 'secretaire'), null)
  assert.equal(procedureDeLaPage('/dashboard/inconnu', 'direction'), null)
  // Fiche d'une absence (prefixe) et taches de gestion retirees en lecture seule.
  assert.equal(procedureDeLaPage('/dashboard/absences-enseignants/abc', 'enseignant')?.slug, 'absences-enseignants')
  const lecture = procedureParSlug('absences-enseignants', 'enseignant')!
  const gestion = procedureParSlug('absences-enseignants', 'secretaire')!
  assert.ok(lecture.taches.length < gestion.taches.length)
  assert.ok(!lecture.taches.some(x => x.titre === 'Déclarer une absence'))
})

test('mise en route en tete, presentation complete', () => {
  assert.equal(proceduresDuRole('direction')[0].slug, 'mise-en-route')
  assert.equal(proceduresDuRole('enseignant').some(p => p.slug === 'mise-en-route'), false)
  // Sans option, la presentation ne cite pas les procedures d'une option payante.
  const n = presentationParModule().reduce((t, m) => t + m.fonctionnalites.length, 0)
  assert.equal(n, PROCEDURES.filter(p => !p.option).length - 1)
  const nAvec = presentationParModule({ espaceFamille: true }).reduce((t, m) => t + m.fonctionnalites.length, 0)
  assert.equal(nAvec, PROCEDURES.length - 1)
  // La fiche d'un message est couverte par « Messages envoyes », pas l'ecriture.
  assert.equal(procedureDeLaPage('/dashboard/communications/new', 'direction')?.slug, 'message-parents')
  assert.equal(procedureDeLaPage('/dashboard/communications/abc', 'direction')?.slug, 'messages-envoyes')
})

test('option espace famille : rien sans l’option, tout avec', () => {
  const avec = { espaceFamille: true }
  // Secretaire : l'onglet Parents seul, donc la procedure dediee.
  assert.equal(procedureDeLaPage('/dashboard/utilisateurs', 'secretaire'), null)
  assert.equal(procedureDeLaPage('/dashboard/utilisateurs', 'secretaire', avec)?.slug, 'comptes-parents')
  // Direction : « Utilisateurs » d'abord ; sa tache « Comptes parents » suit l'option.
  const sans = procedureDeLaPage('/dashboard/utilisateurs', 'direction')!
  const option = procedureDeLaPage('/dashboard/utilisateurs', 'direction', avec)!
  assert.equal(sans.slug, 'utilisateurs')
  assert.ok(!sans.taches.some(t => t.option))
  assert.ok(option.taches.some(t => t.option === 'espace_famille'))
  assert.equal(proceduresDuRole('direction').some(p => p.slug === 'comptes-parents'), false)
  assert.equal(proceduresDuRole('direction', avec).some(p => p.slug === 'comptes-parents'), true)
  assert.equal(procedureParSlug('comptes-parents', 'responsable_pedagogique'), null)
  // Regles de la fiche parents : la regle d'option n'apparait qu'avec elle.
  const regles = (o?: { espaceFamille: boolean }) => procedureParSlug('parents', 'secretaire', o)?.regles?.length ?? 0
  assert.ok(regles(avec) > regles())
  // « Desactiver » reste a la direction.
  const tachesSec = procedureParSlug('comptes-parents', 'secretaire', avec)!.taches.map(t => t.titre)
  assert.ok(!tachesSec.some(t => t.startsWith('Désactiver')))
})

test('recherche sans accents, tous les mots', () => {
  const toutes = proceduresDuRole('direction')
  assert.equal(rechercher(toutes, 'cheque attestation').length, 1)
  assert.equal(rechercher(toutes, 'xyzzy').length, 0)
  assert.equal(rechercher(toutes, 'a').length, toutes.length)
})

test('segments : noms entre guillemets mis en valeur', () => {
  assert.deepEqual(segments('Cliquez sur « Ajouter ».'), [
    { texte: 'Cliquez sur ', fort: false }, { texte: '« Ajouter »', fort: true }, { texte: '.', fort: false },
  ])
})

// Controles du contenu : ce qu'un relecteur laisserait passer.
test('chaque procedure est bien formee', () => {
  const slugs = new Set<string>()
  for (const p of PROCEDURES) {
    assert.ok(!slugs.has(p.slug), `slug en double : ${p.slug}`)
    slugs.add(p.slug)
    assert.match(p.slug, /^[a-z0-9-]+$/)
    assert.ok((ORDRE_MODULES as readonly string[]).includes(p.module), `${p.slug} : module inconnu ${p.module}`)
    assert.ok(p.roles.length > 0 && p.roles.every(r => ROLES.includes(r)), `${p.slug} : roles`)
    assert.ok(p.taches.length > 0, `${p.slug} : aucune tache`)
    for (const l of [...(p.taches), ...(p.regles ?? []), ...(p.grise ?? []), ...(p.faq ?? [])]) {
      for (const r of l.roles ?? []) assert.ok(p.roles.includes(r), `${p.slug} : role ${r} hors procedure`)
    }
    for (const s of p.voirAussi ?? []) assert.ok(PROCEDURES.some(x => x.slug === s), `${p.slug} : voir aussi ${s} inconnu`)
    const texte = texteProcedure(p)
    assert.ok(!/[—–]/.test(texte), `${p.slug} : tiret long`)
    assert.ok(!/\((s|e|es|x)\)/.test(texte), `${p.slug} : « (s) » ou « (e) »`)
    assert.equal((texte.match(/«/g) ?? []).length, (texte.match(/»/g) ?? []).length, `${p.slug} : guillemets desequilibres`)
  }
})

// Un ecran se partage avec une procedure COMPLEMENTAIRE, dependant d'une option
// (onglet propre a l'option, lu par des roles qui n'ont que lui) : la premiere
// lisible l'emporte (`procedureDeLaPage`).
test('chaque ecran couvert existe et n est couvert qu une fois (hors complement d une option)', () => {
  const vus = new Set<string>()
  for (const p of PROCEDURES) {
    for (const e of p.ecrans) {
      assert.ok(!vus.has(e) || !!p.option, `ecran couvert deux fois : ${e}`)
      vus.add(e)
      const dossier = path.join('src', 'app', ...e.replace(/\/\*$/, '').split('/').filter(Boolean))
      const page = e.endsWith('/*')
        ? fs.readdirSync(dossier, { withFileTypes: true }).some(d => d.isDirectory() && d.name.startsWith('['))
        : fs.existsSync(path.join(dossier, 'page.tsx'))
      assert.ok(page, `${p.slug} : aucune page pour ${e}`)
    }
  }
})
