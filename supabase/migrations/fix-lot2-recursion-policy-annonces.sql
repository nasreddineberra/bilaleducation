-- ============================================================================
-- BILAL EDUCATION — LOT 2 : casser la RECURSION entre deux policies
-- ----------------------------------------------------------------------------
-- Constate immediatement apres la pose du lot 2 (1er octobre), par le controle
-- sous identite reelle : toute lecture de `announcements` echouait en
--
--     42P17 : infinite recursion detected in policy for relation "announcements"
--
-- ── LE CYCLE ───────────────────────────────────────────────────────────────
--
--   announcements_select          lit `announcement_staff_recipients`
--                                 (« suis-je destinataire de ce message ? »)
--   ann_staff_recipients_select   lit `announcements`
--                                 (cloisonnement : la table n'a pas de colonne
--                                  `etablissement_id`, elle le tient de l'annonce)
--
-- Chacune declenche l'autre. PostgreSQL detecte la boucle et refuse — il ne
-- renvoie pas zero ligne, il leve. C'est une bonne nouvelle : le defaut etait
-- FRANC et non silencieux. Une policy trop stricte, elle, aurait vide la cloche
-- sans un mot.
--
-- ── LA PARADE, DEJA EMPLOYEE DANS CE PROJET ────────────────────────────────
--
-- Une fonction `SECURITY DEFINER` : elle s'execute avec les droits de son
-- proprietaire, donc **sans subir la RLS** de la table qu'elle interroge, ce qui
-- rompt le cycle. C'est exactement ce qui avait ete fait le 5 aout pour
-- `teaches_class` / `teaches_student` / `teaches_parent` — « sans l'elevation,
-- la policy de `students` s'appellerait elle-meme ». Le piege etait documente ;
-- je ne l'ai pas vu en ecrivant le lot 2.
--
-- UNE SEULE fonction suffit a casser le cycle : il n'y a qu'un sens a couper.
-- Une fois `announcements_select` affranchie de la RLS de
-- `announcement_staff_recipients`, les trois autres tables peuvent continuer de
-- lire `announcements` en subissant sa policy — ce qui reste VOULU : leur
-- perimetre ne peut alors jamais diverger de celui du message.
--
-- `search_path` fixe : regle du 5 aout, c'est le vecteur classique d'elevation
-- sur un SECURITY DEFINER.
--
-- ── CE QUE LA FONCTION N'ELARGIT PAS ───────────────────────────────────────
--
-- Elle ne repond qu'a une question fermee, sur l'appelant LUI-MEME : « cette
-- annonce m'est-elle adressee ? ». Elle ne rend aucune ligne, ne prend aucun
-- identifiant d'autrui, et `auth.uid()` y est lu a l'interieur — on ne peut donc
-- pas l'interroger sur le compte d'un collegue.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.est_destinataire_annonce(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.announcement_staff_recipients r
     WHERE r.announcement_id = p_announcement_id
       AND r.profile_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.est_destinataire_annonce(uuid) IS
  'Suis-je destinataire de cette annonce ? SECURITY DEFINER pour rompre la recursion entre announcements_select et ann_staff_recipients_select (42P17, 01/10/2026).';

-- La policy de lecture, a l''identique, SAUF la sous-requete devenue appel de
-- fonction. Tout le reste du perimetre arrete le 1er octobre est inchange.
DROP POLICY IF EXISTS announcements_select ON public.announcements;

CREATE POLICY announcements_select ON public.announcements FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      -- admin / direction : tout
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])

      -- l'auteur lit ce qu'il a ecrit, quel qu'en soit le type
      OR published_by = auth.uid()

      -- destinataire d'un message a l'equipe : INDISPENSABLE a la cloche, qui
      -- joint `announcements` en `!inner`. Passe par la fonction DEFINER, sans
      -- quoi cette ligne et `ann_staff_recipients_select` s'appellent l'une
      -- l'autre sans fin.
      OR est_destinataire_annonce(id)

      -- messages aux FAMILLES : perimetre par role et par ciblage
      OR (
        announcement_type <> 'staff'
        AND (
          -- la secretaire peut les envoyer tous, elle les lit tous
          get_user_role() = 'secretaire'

          -- le responsable pedagogique lit ce qu'il peut envoyer
          OR (get_user_role() = 'responsable_pedagogique'
              AND announcement_type = ANY (ARRAY['class','selected','all_active']))

          -- l'enseignant : SA classe, et ce qui s'adresse a toutes les familles.
          -- `selected` EXCLU a dessein : la fiche message affiche la liste
          -- NOMINATIVE des destinataires, et un message cible a quelques
          -- familles l'est toujours pour une raison particuliere.
          OR (get_user_role() = 'enseignant'
              AND (
                (announcement_type = 'class' AND teaches_class(target_class_id))
                OR announcement_type = ANY (ARRAY['all_active','all_registered'])
              ))
        )
      )
    )
  );

SELECT 'Recursion rompue : announcements_select passe par est_destinataire_annonce (SECURITY DEFINER).' AS status;
