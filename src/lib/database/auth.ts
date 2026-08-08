// Ce repository utilise le client navigateur car il est appelé
// exclusivement depuis des Client Components (login, navbar, sidebar).
import { createClient } from '@/lib/supabase/client'

/**
 * Connexion et déconnexion, côté navigateur. Rien d'autre.
 *
 * PÉRIMÈTRE VOLONTAIREMENT ÉTROIT. Ce module ne comporte que les deux gestes
 * qu'un utilisateur pose lui-même. Tout le reste de la gestion des comptes —
 * création, changement de mot de passe, envoi d'un lien de réinitialisation,
 * contrôle de rôle — vit dans des SERVER ACTIONS gardées, jamais ici :
 *
 *   · création de compte  → `utilisateurs/actions.ts`, `teachers/actions.ts`,
 *                           `superadmin/actions.ts` (client admin, rôle contrôlé) ;
 *   · mot de passe        → `mon-compte/actions.ts` et l'écran de réinitialisation ;
 *   · lien de réinit.     → `sendPasswordReset`, `envoyerLienMotDePasse` ;
 *   · contrôle de rôle    → `requireRoleServer` / `requireEditor`, et surtout la
 *                           RLS. Un contrôle de rôle écrit côté navigateur ne
 *                           protège rien : il décide de ce qui s'affiche, jamais
 *                           de ce qui est permis.
 *
 * Huit méthodes mortes ont été retirées le 8 août — dont un `createUser` qui
 * appelait `signUp` depuis le navigateur en y passant le RÔLE choisi, puis
 * insérait le profil correspondant. Elle n'était appelée nulle part, mais
 * c'était un patron d'escalade prêt à être recâblé par mégarde.
 */
export const authRepository = {
  /**
   * Connexion avec email et mot de passe
   */
  async signIn(email: string, password: string) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    if (data.user) {
      // Contrôle du statut du compte : un compte désactivé ne peut pas se connecter
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, etablissement_id, is_active')
        .eq('id', data.user.id)
        .single()

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        throw new Error('ACCOUNT_DISABLED')
      }

      // Audit log connexion (non-bloquant)
      try {
        if (profile?.etablissement_id) {
          supabase.from('audit_logs').insert({
            etablissement_id: profile.etablissement_id,
            user_id: data.user.id,
            user_email: email,
            user_name: `${profile.last_name} ${profile.first_name}`,
            entity_type: 'auth',
            action: 'LOGIN',
          }).then(() => {})
        }
      } catch {
        // ne jamais bloquer la connexion
      }
    }

    return data
  },

  /**
   * Déconnexion
   */
  async signOut() {
    const supabase = createClient()

    // Audit log deconnexion (avant le signOut car on a encore le user)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, etablissement_id')
          .eq('id', user.id)
          .single()

        if (profile?.etablissement_id) {
          await supabase.from('audit_logs').insert({
            etablissement_id: profile.etablissement_id,
            user_id: user.id,
            user_email: user.email,
            user_name: `${profile.last_name} ${profile.first_name}`,
            entity_type: 'auth',
            action: 'LOGOUT',
          })
        }
      }
    } catch {
      // ne pas bloquer la deconnexion
    }

    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },
}
