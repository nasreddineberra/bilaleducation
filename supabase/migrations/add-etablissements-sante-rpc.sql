-- ============================================================================
-- Vue de santé des établissements clients (console de l'éditeur)
--
-- CE QU'ELLE APPORTE. La console comptait déjà utilisateurs, élèves et classes,
-- mais avec TROIS requêtes PAR ÉCOLE, exécutées en boucle : à dix clients, ce
-- sont trente allers-retours pour afficher une liste. Cette fonction les
-- remplace par un seul appel, et en profite pour ajouter les deux signaux qui
-- manquaient vraiment.
--
--   * `last_sign_in` — un client qui ne se connecte plus est un client qui
--     décroche. C'est l'information commerciale la plus utile de l'écran, et la
--     seule qu'aucun compteur ne donne.
--   * `smtp_configured` — sans messagerie, l'école ne peut envoyer NI devoir,
--     NI relance, NI attestation. Une école active mais muette ressemble à un
--     produit qui ne marche pas ; c'est la première chose à vérifier au support.
--
-- LE SUPER-ADMIN EST EXCLU DES DEUX COMPTAGES qui le concernent, et ce n'est pas
-- un détail : rattaché à une école pendant une intervention, il gonflerait son
-- nombre d'utilisateurs — et surtout, SA propre connexion passerait pour celle
-- du client. Une école dormante paraîtrait active le jour où on la dépanne.
--
-- RÉSERVÉE AU SERVEUR. Aucune garde de rôle à l'intérieur : appelée par la
-- console, elle s'exécute en service-role, où `auth.uid()` est nul — une garde
-- fondée sur le rôle refuserait donc l'appel légitime. La protection est le
-- retrait du droit d'exécution aux rôles de l'API : personne d'autre ne peut
-- l'appeler. Elle lit `auth.users` et les données de TOUS les établissements.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_etablissements_sante()
  RETURNS TABLE (
    etablissement_id UUID,
    users_count      INTEGER,
    students_count   INTEGER,
    classes_count    INTEGER,
    last_sign_in     TIMESTAMPTZ,
    smtp_configured  BOOLEAN
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, auth, pg_temp
AS $function$
  SELECT
    e.id,
    (SELECT count(*)::int FROM profiles p
       WHERE p.etablissement_id = e.id AND p.role <> 'super_admin'),
    (SELECT count(*)::int FROM students s  WHERE s.etablissement_id = e.id),
    (SELECT count(*)::int FROM classes  c  WHERE c.etablissement_id = e.id),
    (SELECT max(u.last_sign_in_at)
       FROM auth.users u
       JOIN profiles p2 ON p2.id = u.id
      WHERE p2.etablissement_id = e.id AND p2.role <> 'super_admin'),
    EXISTS (SELECT 1 FROM etablissement_smtp sm WHERE sm.etablissement_id = e.id)
  FROM etablissements e
$function$;

COMMENT ON FUNCTION public.get_etablissements_sante() IS
  'Sante des etablissements clients pour la console de l''editeur : effectifs, derniere connexion et messagerie configuree. RESERVEE AU SERVICE-ROLE (droit d''execution retire aux roles de l''API) : elle lit auth.users et les donnees de tous les etablissements. Le super-admin est exclu des comptages, sinon ses interventions passeraient pour de l''activite du client.';

REVOKE ALL ON FUNCTION public.get_etablissements_sante() FROM anon, authenticated;

-- ── Vérification ────────────────────────────────────────────────────────────
--   SELECT * FROM get_etablissements_sante();          -- en service-role : ok
--   -- Sous l'identite d'un compte d'ecole : permission denied.
