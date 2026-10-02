// Client navigateur : ce module n'est appele que depuis un Client Component
// (`ParentsTable`), pour afficher la fratrie d'un foyer.
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/types/database'

/**
 * Ce fichier est le RELIQUAT d'un « repository pattern » abandonne.
 *
 * Il portait dix methodes ; UNE SEULE etait appelee, celle qui reste. Les quatre
 * methodes d'ecriture (`create`, `update`, `deactivate`, `delete`) et les modules
 * freres (`classes`, `parents`, `payments`, `teachers`) ont ete supprimes le
 * 2 octobre : aucun importateur, et surtout aucune garde. Ecrites AVANT le
 * chantier RLS, elles n'avaient ni controle de role, ni comptage de lignes, ni
 * trace d'audit — un modele que quelqu'un aurait recopie en croyant suivre
 * l'architecture du projet. C'est exactement ce qui avait ete trouve le 8 aout
 * dans `authRepository`, dont une methode morte appelait `signUp` depuis le
 * navigateur en choisissant son propre role.
 *
 * L'architecture retenue est : server actions pour les ecritures, requetes dans
 * les pages pour les lectures. NE PAS rouvrir ce fichier pour y remettre une
 * ecriture — elle irait dans une server action.
 */
export const studentRepository = {
  /**
   * Recuperer les enfants d'une fiche parents (fratrie incluse).
   */
  async getByParent(parentId: string, activeOnly = false): Promise<Student[]> {
    const supabase = createClient()
    const query = supabase
      .from('students')
      .select('id, student_number, last_name, first_name, date_of_birth, gender, photo_url, parent_id, is_active, enrollment_date, has_pai, exit_authorization, media_authorization, etablissement_id, created_at, updated_at')
      .eq('parent_id', parentId)
      .order('last_name')

    if (activeOnly) query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },
}
