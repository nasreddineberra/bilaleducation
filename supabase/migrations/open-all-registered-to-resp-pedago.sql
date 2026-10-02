-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Le responsable pedagogique lit aussi les messages « tous les contacts »  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- CE QUE LE CONTROLE 04 A MONTRE (02/10). `announcements_select` accordait au
-- responsable pedagogique `class`, `selected` et `all_active` — mais PAS
-- `all_registered`, que l'enseignant, lui, voit. Un enseignant lisait donc un
-- message « tous les contacts » que son responsable ne lisait pas.
--
-- Ce n'etait pas un trou de securite : personne ne voyait ce qu'il ne devait pas.
-- C'etait une INVERSION DE HIERARCHIE, et elle venait de ce que les deux regles
-- du 01/10 sont justes PRISES ISOLEMENT : « resp. pedagogique : tout ce qu'il
-- peut ENVOYER » (et l'insert lui refuse bien `all_registered`, reserve a
-- admin/direction/secretaire) ET « enseignant : sa classe et les messages
-- adresses a toutes les familles » — ce que `all_registered` est. Elles se
-- croisaient sans que personne ne l'ait voulu.
--
-- DECISION UTILISATEUR DU 03/10 : il le voit. La lecture cesse donc d'etre
-- calquee sur le droit d'ENVOI pour ce type — un responsable pedagogique doit
-- pouvoir lire ce qui part aux familles, meme ce qu'il n'emet pas lui-meme.
-- L'ECRITURE est INCHANGEE : il ne peut toujours pas emettre un `all_registered`.
--
-- La condition ci-dessous est REPRISE TELLE QUELLE de `pg_policies` (controle 04
-- du 02/10), a un mot pres. On ne reecrit pas une policy de memoire : le depot a
-- deja menti sur la RLS le 5 aout, seule la base fait foi.

-- Garde : la policy doit exister et porter la forme attendue, sinon on
-- remplacerait autre chose que ce qu'on croit.
DO $garde$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'announcements'
       AND policyname = 'announcements_select'
       AND qual LIKE '%responsable_pedagogique%'
  ) THEN
    RAISE EXCEPTION
      'announcements_select introuvable ou de forme inattendue : ne pas appliquer a l aveugle.';
  END IF;
END
$garde$;

DROP POLICY IF EXISTS announcements_select ON announcements;

CREATE POLICY announcements_select ON announcements
FOR SELECT
USING (
  etablissement_id = current_etablissement_id()
  AND (
    COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction'])
    OR published_by = auth.uid()
    OR est_destinataire_annonce(id)
    OR (
      announcement_type <> 'staff'
      AND (
        get_user_role() = 'secretaire'
        -- `all_registered` AJOUTE ici (03/10) : seule modification du fichier.
        OR (get_user_role() = 'responsable_pedagogique'
            AND announcement_type = ANY (ARRAY['class', 'selected', 'all_active', 'all_registered']))
        OR (get_user_role() = 'enseignant'
            AND (
              (announcement_type = 'class' AND teaches_class(target_class_id))
              OR announcement_type = ANY (ARRAY['all_active', 'all_registered'])
            ))
      )
    )
  )
);

-- Verification : la policy est en place et cite bien `all_registered` dans la
-- branche du responsable pedagogique.
DO $verif$
DECLARE
  cond text;
BEGIN
  SELECT qual INTO cond
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'announcements'
     AND policyname = 'announcements_select';

  IF cond IS NULL THEN
    RAISE EXCEPTION 'announcements_select absente apres recreation.';
  END IF;
  IF cond NOT LIKE '%responsable_pedagogique%all_registered%' THEN
    RAISE EXCEPTION 'La branche du responsable pedagogique ne cite pas all_registered.';
  END IF;

  RAISE NOTICE 'OK : le responsable pedagogique lit desormais all_registered.';
END
$verif$;
