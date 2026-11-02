/**
 * QUI ECRIT LES FICHES ELEVES (matrice du 5 aout) : admin, direction, resp.
 * pedagogique et secretaire. L'enseignant LIT ses eleves sans les modifier.
 * La RLS fait foi ; ces droits servent a MASQUER ce que l'ecran ne permettra
 * jamais (une ecriture refusee par la RLS ne leve rien : elle passerait pour un
 * succes). Utilise par la liste, la fiche et la page de creation.
 */
const ROLES_ECRITURE_ELEVES = ['admin', 'direction', 'responsable_pedagogique', 'secretaire']

export function peutEcrireEleves(role: string | null | undefined): boolean {
  return !!role && ROLES_ECRITURE_ELEVES.includes(role)
}
