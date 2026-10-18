-- ============================================================================
-- ORDRE DES GABARITS : CLOISONNEMENT PAR ECOLE ET PAR CLASSE (18 octobre 2026)
--
-- L'unique policy de `evaluation_order_config` (FOR ALL) ne portait que le
-- ROLE (admin, direction, resp. pedagogique, enseignant), sans l'ecole : un
-- compte de ces roles lisait et reecrivait l'ordre des gabarits de TOUTES les
-- ecoles, et un enseignant celui de toutes les classes.
--
-- La table n'a pas d'`etablissement_id` : l'ecole est celle de la CLASSE.
-- Regle alignee sur `evaluations` (meme ecran Gabarits, meme perimetre) :
--   - admin, direction, resp. pedagogique, secretaire : les classes de l'ecole ;
--   - enseignant : ses classes (`teaches_class`, fenetre de dates comprise).
-- La secretaire, qui a acces aux Gabarits et ecrit deja `evaluations`, etait
-- ABSENTE de l'ancienne policy : son enregistrement des gabarits echouait a
-- l'etape de l'ordre et ses bulletins ignoraient l'ordre defini.
--
-- Controle : supabase/controles/13-ordre-gabarits-cloisonnement.sql.
-- ============================================================================

DROP POLICY IF EXISTS "Gestion evaluation_order_config" ON public.evaluation_order_config;
DROP POLICY IF EXISTS evaluation_order_config_all ON public.evaluation_order_config;

CREATE POLICY evaluation_order_config_all ON public.evaluation_order_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes c
       WHERE c.id = evaluation_order_config.class_id
         AND c.etablissement_id = current_etablissement_id()
    )
    AND (
      coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes c
       WHERE c.id = evaluation_order_config.class_id
         AND c.etablissement_id = current_etablissement_id()
    )
    AND (
      coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('fix-evaluation-order-config-rls.sql', '8e97aaa0946f1bf86f9110f79382cc45ef7b0c984aec01136be3cc5e3ef2ca27');
