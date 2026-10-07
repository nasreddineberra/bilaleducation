-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  LIMITE D'INSCRITS : la base refuse-t-elle VRAIMENT de la depasser ?     ║
-- ║  Tout est ANNULE : exception volontaire en sortie unique du bloc.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- A rejouer apres `guard-limite-inscrits.sql`.
--
-- On place l'ecole PILE a sa limite (max_students = base facturable actuelle),
-- puis on tente chaque geste. La limite d'origine est restauree par l'annulation.
--
-- CHAQUE CAS DANS SON PROPRE BLOC D'EXCEPTION (regle du 16/09), et chaque refus
-- est verifie sur son REPERE (`hint = limite_inscrits`), pas seulement sur le
-- fait qu'il echoue : un CHECK sans rapport ferait passer un echec pour un
-- succes (piege du 16 aout).

DO $ctl$
DECLARE
  r        text := E'\n';
  etab     uuid;
  base0    int;
  base1    int;
  inactif1 uuid;
  inactif2 uuid;
  actif1   uuid;
  actif2   uuid;
  foyer    uuid;
  v_hint   text;
  v_code   text;
  v_msg    text;
BEGIN
  SELECT s.etablissement_id INTO etab
    FROM students s GROUP BY s.etablissement_id
   ORDER BY count(*) DESC LIMIT 1;

  SELECT b.eleves_actifs + b.adultes_inscrits INTO base0 FROM fn_base_facturable(etab) b;
  r := r || format('Ecole %s · base facturable actuelle = %s%s', etab, base0, E'\n');

  SELECT id INTO inactif1 FROM students WHERE etablissement_id = etab AND NOT is_active ORDER BY id LIMIT 1;
  SELECT id INTO inactif2 FROM students WHERE etablissement_id = etab AND NOT is_active ORDER BY id OFFSET 1 LIMIT 1;
  SELECT id INTO actif1   FROM students WHERE etablissement_id = etab AND is_active ORDER BY id LIMIT 1;
  SELECT id INTO actif2   FROM students WHERE etablissement_id = etab AND is_active ORDER BY id OFFSET 1 LIMIT 1;
  SELECT id INTO foyer    FROM parents  WHERE etablissement_id = etab AND NOT tutor1_adult_courses ORDER BY id LIMIT 1;
  IF inactif1 IS NULL OR inactif2 IS NULL OR actif1 IS NULL OR actif2 IS NULL OR foyer IS NULL THEN
    RAISE EXCEPTION 'Jeu de donnees insuffisant (2 inactifs, 2 actifs, 1 foyer sans cours adultes requis).';
  END IF;

  -- L'ecole est placee PILE a sa limite.
  UPDATE etablissements SET max_students = base0 WHERE id = etab;

  -- 1. Reactiver un eleve : REFUSE.
  BEGIN
    UPDATE students SET is_active = true WHERE id = inactif1;
    r := r || '1. reactiver un eleve a la limite      : ACCEPTE  <-- ANOMALIE' || E'\n';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE, v_hint = PG_EXCEPTION_HINT, v_msg = MESSAGE_TEXT;
    r := r || format('1. reactiver un eleve a la limite      : refuse  %s%s', CASE WHEN v_hint = 'limite_inscrits' THEN 'OK' ELSE '<-- MAUVAISE CAUSE ' || v_code || ' ' || v_msg END, E'\n');
  END;

  -- 2. Cocher « cours adultes » sur un tuteur : REFUSE.
  BEGIN
    UPDATE parents SET tutor1_adult_courses = true WHERE id = foyer;
    r := r || '2. cocher un adulte a la limite        : ACCEPTE  <-- ANOMALIE' || E'\n';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE, v_hint = PG_EXCEPTION_HINT, v_msg = MESSAGE_TEXT;
    r := r || format('2. cocher un adulte a la limite        : refuse  %s%s', CASE WHEN v_hint = 'limite_inscrits' THEN 'OK' ELSE '<-- MAUVAISE CAUSE ' || v_code || ' ' || v_msg END, E'\n');
  END;

  -- 3. Lot NET +1 (2 activations, 1 desactivation) en UNE instruction :
  --    REFUSE en entier, rien n'est applique.
  BEGIN
    UPDATE students SET is_active = NOT is_active WHERE id IN (inactif1, inactif2, actif1);
    r := r || '3. lot net +1                          : ACCEPTE  <-- ANOMALIE' || E'\n';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT;
    SELECT b.eleves_actifs + b.adultes_inscrits INTO base1 FROM fn_base_facturable(etab) b;
    r := r || format('3. lot net +1                          : refuse  %s · base apres = %s (%s)%s',
      CASE WHEN v_hint = 'limite_inscrits' THEN 'OK' ELSE '<-- MAUVAISE CAUSE' END, base1,
      CASE WHEN base1 = base0 THEN 'rien applique, OK' ELSE 'LOT APPLIQUE A MOITIE <-- ANOMALIE' END, E'\n');
  END;

  -- 4. Lot NET 0 (1 activation, 1 desactivation) en UNE instruction : ACCEPTE.
  BEGIN
    UPDATE students SET is_active = NOT is_active WHERE id IN (inactif1, actif1);
    r := r || '4. lot net 0                           : accepte OK' || E'\n';
    UPDATE students SET is_active = NOT is_active WHERE id IN (inactif1, actif1);  -- retour
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    r := r || '4. lot net 0                           : REFUSE  <-- ANOMALIE ' || v_msg || E'\n';
  END;

  -- 5. Desactiver puis reactiver (une place liberee) : ACCEPTE.
  BEGIN
    UPDATE students SET is_active = false WHERE id = actif2;
    UPDATE students SET is_active = true  WHERE id = inactif2;
    r := r || '5. liberer une place puis l occuper    : accepte OK' || E'\n';
    UPDATE students SET is_active = false WHERE id = inactif2;
    UPDATE students SET is_active = true  WHERE id = actif2;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    r := r || '5. liberer une place puis l occuper    : REFUSE  <-- ANOMALIE ' || v_msg || E'\n';
  END;

  -- 6. Limite ABAISSEE sous la base : diminuer reste permis.
  BEGIN
    UPDATE etablissements SET max_students = greatest(base0 - 5, 1) WHERE id = etab;
    UPDATE students SET is_active = false WHERE id = actif2;
    r := r || '6. desactiver au-dessus de la limite   : accepte OK' || E'\n';
    UPDATE etablissements SET max_students = base0 WHERE id = etab;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    r := r || '6. desactiver au-dessus de la limite   : REFUSE  <-- ANOMALIE ' || v_msg || E'\n';
  END;

  -- 7. Sans limite : tout est permis.
  BEGIN
    UPDATE etablissements SET max_students = NULL WHERE id = etab;
    UPDATE students SET is_active = true WHERE id = inactif1;
    r := r || '7. reactiver sans limite               : accepte OK' || E'\n';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    r := r || '7. reactiver sans limite               : REFUSE  <-- ANOMALIE ' || v_msg || E'\n';
  END;

  RAISE EXCEPTION '%', r || E'\n(Tout est annule : la limite et les statuts reprennent leur valeur.)';
END;
$ctl$;
