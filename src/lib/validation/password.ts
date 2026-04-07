export type PasswordRule = {
  key:   string
  label: string
  test:  (pwd: string, firstName?: string, lastName?: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    key:   'length',
    label: '10 caractères minimum',
    test:  (p) => p.length >= 10,
  },
  {
    key:   'upper',
    label: 'Une majuscule (A-Z)',
    test:  (p) => /[A-Z]/.test(p),
  },
  {
    key:   'lower',
    label: 'Une minuscule (a-z)',
    test:  (p) => /[a-z]/.test(p),
  },
  {
    key:   'digit',
    label: 'Un chiffre (0-9)',
    test:  (p) => /\d/.test(p),
  },
  {
    key:   'special',
    label: 'Un caractère spécial (!@#$%…)',
    test:  (p) => /[^a-zA-Z0-9]/.test(p),
  },
  {
    key:   'noFirst',
    label: 'Ne contient pas votre prénom',
    test:  (p, f) => !f || f.trim().length < 3 || !p.toLowerCase().includes(f.trim().toLowerCase()),
  },
  {
    key:   'noLast',
    label: 'Ne contient pas votre nom',
    test:  (p, _, l) => !l || l.trim().length < 3 || !p.toLowerCase().includes(l.trim().toLowerCase()),
  },
]

export const isPasswordValid = (
  pwd: string,
  firstName?: string,
  lastName?: string,
): boolean => PASSWORD_RULES.every(r => r.test(pwd, firstName, lastName))

/**
 * Valide un mot de passe côté serveur et retourne un message d'erreur détaillé
 * si une règle n'est pas respectée. Retourne `null` si le mot de passe est valide.
 */
export function validatePasswordServer(
  pwd: string,
  firstName?: string,
  lastName?: string,
): string | null {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(pwd, firstName, lastName)) {
      return rule.label
    }
  }
  return null
}
