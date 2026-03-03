import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types/database'

/**
 * Repository Pattern pour l'authentification
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
    return data
  },

  /**
   * Déconnexion
   */
  async signOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  /**
   * Récupérer l'utilisateur actuel
   */
  async getCurrentUser() {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) throw error
    return user
  },

  /**
   * Récupérer le profil complet de l'utilisateur actuel
   */
  async getCurrentProfile(): Promise<Profile | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  },

  /**
   * Créer un nouvel utilisateur (admin uniquement)
   */
  async createUser(
    email: string,
    password: string,
    profile: {
      role: UserRole
      first_name: string
      last_name: string
      phone?: string
    }
  ) {
    const supabase = createClient()
    
    // Créer l'utilisateur dans auth.users
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: profile.role,
          first_name: profile.first_name,
          last_name: profile.last_name,
        }
      }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Failed to create user')

    // Créer le profil
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        ...profile,
      })
      .select()
      .single()

    if (profileError) throw profileError

    return { user: authData.user, profile: profileData }
  },

  /**
   * Mettre à jour le mot de passe
   */
  async updatePassword(newPassword: string) {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error
  },

  /**
   * Réinitialiser le mot de passe (envoie un email)
   */
  async resetPassword(email: string) {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) throw error
  },

  /**
   * Vérifier si l'utilisateur est connecté
   */
  async isAuthenticated(): Promise<boolean> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return !!session
  },

  /**
   * Vérifier le rôle de l'utilisateur
   */
  async hasRole(role: UserRole): Promise<boolean> {
    const profile = await this.getCurrentProfile()
    return profile?.role === role
  },

  /**
   * Vérifier si l'utilisateur est admin
   */
  async isAdmin(): Promise<boolean> {
    return this.hasRole('admin')
  },
}
