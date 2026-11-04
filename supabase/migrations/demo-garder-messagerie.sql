-- ============================================================================
-- Ecole de demonstration : la messagerie survit a la remise a zero (04/11)
--
-- `fn_demo_vider` effacait toutes les tables « effacees au depart » de l'ecole,
-- dont `etablissement_smtp` : une messagerie de demonstration configuree pour les
-- essais d'emails etait perdue a chaque « Reinitialiser ». Elle est desormais
-- conservee, comme les comptes. Les adresses fictives de la demonstration ne
-- recoivent jamais rien (`estAdresseFictive`, `lib/email.ts`).
--
-- Le depart d'une ecole (`effacer_etablissement`) n'est pas touche : il efface
-- toujours la messagerie.
--
-- Additif pour le code en place : migration d'abord.
-- ============================================================================

DO $patch$
DECLARE
  v_def text := pg_get_functiondef('public.fn_demo_vider(uuid)'::regprocedure);
  v_ancre text := $a$nom <> 'profiles'$a$;
  v_remplacement text := $a$nom NOT IN ('profiles', 'etablissement_smtp')$a$;
BEGIN
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position(v_remplacement IN v_def) > 0 THEN
    RETURN;   -- deja rapiecee (rejeu)
  END IF;
  -- Deux occurrences attendues : le vidage et la verification « plus rien ».
  IF (length(v_def) - length(replace(v_def, v_ancre, ''))) / length(v_ancre) <> 2 THEN
    RAISE EXCEPTION 'fn_demo_vider : ancrage attendu 2 fois, la fonction a change.';
  END IF;
  EXECUTE replace(v_def, v_ancre, v_remplacement);
END
$patch$;
SELECT enregistrer_migration('demo-garder-messagerie.sql', '0d064c19873228012bfd1b0579a3b9286d13a05f6179e6d6619b6c1e82b632f1');
