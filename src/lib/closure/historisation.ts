// Libelles des manques rendus par `verifier_historisation` (le SQL n'ecrit pas
// d'accents) : un code = une phrase affichee sur la carte de purge.

const LIBELLES: Record<string, string> = {
  archive:             'Année non archivée',
  eleves:              'Élèves sans historique',
  adultes:             'Adultes sans historique',
  bulletins:           'Bulletins d’élèves non archivés',
  bulletins_adultes:   'Bulletins d’adultes non archivés',
  foyers:              'Foyers soldés absents de l’historique financier',
  classes:             'Classes sans historique',
  bilan:               'Bilan financier non établi',
  finance_modifiee:    'Données financières modifiées depuis l’archivage',
  presences_modifiees: 'Temps de présence modifié depuis l’archivage',
  cahier_modifie:      'Cahier de texte modifié depuis l’archivage',
  decisions_modifiees: 'Décisions d’absence modifiées depuis l’archivage',
}

// Cles de `releve_historisation` : un ecart = un ajout ou une suppression depuis l'archivage.
const RELEVE: Record<string, string> = {
  dossiers: 'dossiers de règlement', paiements: 'paiements', ajustements: 'ajustements',
  depenses: 'dépenses', revenus: 'autres revenus', presences: 'saisies de Temps de présence',
  seances: 'séances du cahier de texte', devoirs: 'devoirs', decisions: 'décisions d’absence',
  notes: 'notes', notes_adultes: 'notes des adultes',
}

export function libelleManque(m: { code: string; libelle: string }): string {
  if (m.code.startsWith('releve_')) {
    const cle = m.code.slice('releve_'.length)
    return `Nombre de ${RELEVE[cle] ?? cle} changé depuis l’archivage`
  }
  return LIBELLES[m.code] ?? m.libelle
}
