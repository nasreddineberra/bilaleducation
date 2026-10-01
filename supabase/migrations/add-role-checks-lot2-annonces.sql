-- ============================================================================
-- BILAL EDUCATION — CHANTIER RLS, LOT 2 : les ANNONCES (dernier lot)
-- ----------------------------------------------------------------------------
-- Le lot le plus delicat des trois, pour deux raisons : il porte le seul
-- arbitrage METIER du chantier, et deux durcissements de juillet y sont
-- INOPERANTS depuis leur ecriture.
--
-- ── 1. POURQUOI JUILLET N'A JAMAIS PRIS EFFET ──────────────────────────────
--
-- `announcements` porte DEUX policies : `announcements_insert_scoped`
-- (15 juillet, controle du type par role) et `announcements_tenant`, une
-- `FOR ALL` dont l'unique condition est l'etablissement. **Les policies
-- permissives s'ADDITIONNENT (OR)** : la seconde annule la premiere. Idem sur
-- `announcement_staff_recipients`, dont le journal du 16 juillet affirme
-- qu'elle « remplace la policy FOR ALL » — le remplacement n'a jamais eu lieu.
--
-- Consequence reelle : tout compte authentifie de l'ecole pouvait lire, par un
-- appel direct a l'API REST, le CORPS de tous les messages envoyes aux
-- familles et la LISTE NOMINATIVE de leurs destinataires. L'ecran etait ferme
-- a l'enseignant depuis le 24 septembre ; la base, elle, ne l'etait pas.
--
-- ── 2. LE PIEGE QUI COMMANDE TOUTE LA MATRICE DE LECTURE ───────────────────
--
-- La cloche lit `announcement_staff_recipients` avec une **jointure `!inner`
-- sur `announcements`** (dashboard/layout.tsx, notifications/page.tsx). Fermer
-- `announcements` a l'enseignant ne lui retirerait pas seulement un ecran :
-- **sa cloche se viderait**, et il ne pourrait plus ouvrir les messages
-- internes qu'on lui adresse. La lecture doit donc suivre le DESTINATAIRE, pas
-- le role. C'est le point 2 de la regle arretee avec l'utilisateur.
--
-- ── 3. LA REGLE (arbitrage utilisateur, 1er octobre) ───────────────────────
--
-- Un PERIMETRE, et non une liste de roles — meme esprit que `teaches_class` :
--   . j'ecris le message        -> je le lis ;
--   . j'en suis destinataire    -> je le lis ;
--   . admin / direction         -> tout ;
--   . responsable pedagogique   -> tout ce qu'il peut ENVOYER (class, selected,
--     all_active). Lui ouvrir moins en lecture qu'en ecriture serait incoherent ;
--   . secretaire                -> les messages aux familles (elle peut les
--     envoyer tous, `all_registered` compris) ;
--   . enseignant                -> le message de SA classe, et les messages
--     adresses a toutes les familles.
--
-- ── 4. LE CAS `selected` EST EXCLU, ET C'EST LE POINT DE SECURITE ──────────
--
-- La regle « un destinataire de ma classe suffit » aurait ouvert a l'enseignant
-- les messages `selected` — ceux qu'on adresse a quelques familles choisies une
-- par une. Or la fiche message affiche la liste NOMINATIVE des destinataires :
-- il aurait vu les autres familles ciblees, qu'il n'enseigne pas.
--
-- **La liste des destinataires est plus sensible que le message.** C'est elle
-- qui transforme « l'ecole a ecrit » en « ces familles-la ont un probleme » —
-- impaye, convocation, comportement. Un `selected` est sensible PAR
-- CONSTRUCTION : on ne cible quelques familles que pour une raison
-- particuliere. Si l'ecole veut que l'enseignant sache, elle le met en
-- destinataire d'un message a l'equipe : le canal existe et il est trace.
--
-- Corollaire sur les messages a TOUTES les familles (`all_active`,
-- `all_registered`) : l'enseignant lit **le message** (il est concerne comme
-- toute l'ecole) mais **pas la liste** des destinataires — des centaines de
-- noms sans interet pour lui, et la liste des non-inscrits est une donnee
-- commerciale. D'ou deux policies distinctes : `announcements` lui est ouverte,
-- `announcement_recipients` ne l'est pas.
--
-- ── 5. CE QU'IL NE FAUT SURTOUT PAS OUBLIER ────────────────────────────────
--
-- `staff_recipients_write_scoped` porte un controle de role mais **AUCUN
-- cloisonnement par ecole** (`T=NON` au releve du 29/09). Supprimer la vieille
-- `*_tenant` qui la masque, sans la corriger, aurait ouvert les destinataires
-- de TOUTES les ecoles. Un durcissement partiel aurait ete pire que pas de
-- durcissement du tout.
--
-- Et le marquage « lu » est un UPDATE fait par le DESTINATAIRE depuis le
-- navigateur (`NotificationsClient`). Sans policy pour lui, **la cloche ne se
-- viderait jamais**. PostgreSQL ne sait pas restreindre une policy a une
-- COLONNE : le destinataire peut donc techniquement toucher aussi
-- `email_status` de sa propre ligne. Cout accepte — c'est une donnee de suivi,
-- et l'alternative serait une RPC pour un simple « marquer comme lu ».
--
-- ── 6. LES COMPTES PARENTS ─────────────────────────────────────────────────
--
-- `parent` reste EXCLU, comme depuis le 5 aout : les comptes sont suspendus en
-- V1. Le code de marquage « lu » de `announcement_recipients` existe pourtant
-- (`NotificationsClient`) : le jour de leur reactivation, il faudra une policy
-- UPDATE sur `parent_id`, sinon leur cloche ne se videra pas. C'est ecrit ici
-- pour que ce ne soit pas redecouvert a ce moment-la.
--
-- Idempotent.
-- ============================================================================

-- Garde : chemin de cloisonnement REEL de chaque table. Le 29 septembre, le lot 3
-- s'est interrompu ici — `class_teachers` n'avait pas la colonne et se cloisonne
-- par `classes`. Mieux vaut un echec franc et nomme qu'une policy posee sur une
-- colonne absente.
DO $$
DECLARE manquantes text := ''; t text;
BEGIN
  -- SEULE `announcements` porte la colonne. Les trois autres se cloisonnent PAR
  -- JOINTURE vers elle (`announcement_id IN (SELECT id FROM announcements
  -- WHERE etablissement_id = ...)`) — c'est la garde qui l'a etabli, le
  -- 1er octobre, apres l'avoir deja etabli pour `class_teachers` le 29/09.
  -- Deuxieme fois : le releve par `pg_policies` ne distingue pas une colonne
  -- propre d'une jointure, seule cette garde le fait.
  FOREACH t IN ARRAY ARRAY['announcements']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=t
                      AND column_name='etablissement_id') THEN
      manquantes := manquantes || ' ' || t;
    END IF;
  END LOOP;
  IF manquantes <> '' THEN
    RAISE EXCEPTION 'Colonne etablissement_id absente sur :%. Migration interrompue.', manquantes;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  1. `announcements` — le message lui-meme
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS announcements_tenant        ON public.announcements;
DROP POLICY IF EXISTS announcements_insert_scoped ON public.announcements;
DROP POLICY IF EXISTS announcements_select        ON public.announcements;
DROP POLICY IF EXISTS announcements_insert        ON public.announcements;

CREATE POLICY announcements_select ON public.announcements FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      -- admin / direction : tout
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])

      -- l'auteur lit ce qu'il a ecrit, quel qu'en soit le type
      OR published_by = auth.uid()

      -- destinataire d'un message a l'equipe : INDISPENSABLE a la cloche,
      -- qui joint `announcements` en `!inner`.
      OR EXISTS (SELECT 1 FROM public.announcement_staff_recipients r
                  WHERE r.announcement_id = announcements.id
                    AND r.profile_id = auth.uid())

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
          -- `selected` EXCLU a dessein (voir en-tete, point 4).
          OR (get_user_role() = 'enseignant'
              AND (
                (announcement_type = 'class' AND teaches_class(target_class_id))
                OR announcement_type = ANY (ARRAY['all_active','all_registered'])
              ))
        )
      )
    )
  );

-- INSERT : le type decide du perimetre (matrice du 15 juillet), et l'annonce ne
-- peut s'ecrire qu'AU NOM DE SON AUTEUR — verifie : les deux actions posent
-- bien `published_by: user.id`.
CREATE POLICY announcements_insert ON public.announcements FOR INSERT
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND published_by = auth.uid()
    AND (
      -- message a l'equipe : l'encadrement, soit tout le personnel SAUF
      -- l'enseignant (decision du 16 juillet ; le comptable ecrit : paie,
      -- sujets comptables).
      (announcement_type = 'staff'
       AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                      'secretaire','responsable_pedagogique']))

      -- messages aux familles : la voix de l'etablissement
      OR (announcement_type = ANY (ARRAY['class','selected','all_active'])
          AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction',
                                                         'secretaire','responsable_pedagogique']))

      -- « tous les contacts » atteint les familles NON INSCRITES : plus
      -- restreint encore (15 juillet).
      OR (announcement_type = 'all_registered'
          AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire']))
    )
  );

-- Ni UPDATE ni DELETE : aucun chemin d'ecriture n'existe dans le code (verifie),
-- et la RLS refuse par defaut ce qu'aucune policy n'autorise. Une annonce
-- envoyee est un fait, elle ne se retouche pas.

-- ═══════════════════════════════════════════════════════════════════════════
--  2. `announcement_recipients` — QUI a recu (familles)
--     C'est la table SENSIBLE : elle nomme les familles.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS ann_recipients_tenant ON public.announcement_recipients;
DROP POLICY IF EXISTS ann_recipients_select ON public.announcement_recipients;
DROP POLICY IF EXISTS ann_recipients_write  ON public.announcement_recipients;

CREATE POLICY ann_recipients_select ON public.announcement_recipients FOR SELECT
  USING (
    -- UNE seule sous-requete porte le cloisonnement ET le perimetre : la table
    -- n'a pas de colonne `etablissement_id`, elle le tient de son annonce.
    EXISTS (
      SELECT 1 FROM public.announcements a
       WHERE a.id = announcement_recipients.announcement_id
         AND a.etablissement_id = current_etablissement_id()
         AND (
           coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire'])
           OR a.published_by = auth.uid()
           OR (get_user_role() = 'responsable_pedagogique'
               AND a.announcement_type = ANY (ARRAY['class','selected','all_active']))
           -- L'enseignant ne voit la liste QUE pour SA classe : il connait deja
           -- ces familles. Sur un message a toutes les familles il lit le
           -- message, jamais la liste (des centaines de noms, dont les
           -- non-inscrits).
           OR (get_user_role() = 'enseignant'
               AND a.announcement_type = 'class'
               AND teaches_class(a.target_class_id))
         )
    )
  );

-- ECRITURE : l'emetteur inscrit ses destinataires puis met a jour leur statut
-- d'envoi (`email_status`, `sent_at`). Borne a SON annonce.
CREATE POLICY ann_recipients_write ON public.announcement_recipients FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.announcements a
             WHERE a.id = announcement_recipients.announcement_id
               AND a.etablissement_id = current_etablissement_id()
               AND (a.published_by = auth.uid()
                    OR coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.announcements a
             WHERE a.id = announcement_recipients.announcement_id
               AND a.etablissement_id = current_etablissement_id()
               AND (a.published_by = auth.uid()
                    OR coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])))
  );

-- ═══════════════════════════════════════════════════════════════════════════
--  3. `announcement_staff_recipients` — QUI a recu (equipe)
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS ann_staff_recipients_tenant   ON public.announcement_staff_recipients;
DROP POLICY IF EXISTS staff_recipients_write_scoped ON public.announcement_staff_recipients;
DROP POLICY IF EXISTS ann_staff_recipients_select   ON public.announcement_staff_recipients;
DROP POLICY IF EXISTS ann_staff_recipients_write    ON public.announcement_staff_recipients;
DROP POLICY IF EXISTS ann_staff_recipients_read_own ON public.announcement_staff_recipients;

CREATE POLICY ann_staff_recipients_select ON public.announcement_staff_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.announcements a
       WHERE a.id = announcement_staff_recipients.announcement_id
         AND a.etablissement_id = current_etablissement_id()
         AND (
           -- MA ligne : c'est ce qui alimente ma cloche
           announcement_staff_recipients.profile_id = auth.uid()
           OR coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])
           OR a.published_by = auth.uid()
         )
    )
  );

-- ECRITURE par l'emetteur : inscription des destinataires + statut d'envoi.
-- **Le cloisonnement manquait a l'ancienne `staff_recipients_write_scoped`** :
-- elle ne portait QUE le role (verifie le 01/10 dans `pg_policies`, `qual` ne
-- contenait pas un mot d'etablissement). Supprimer la `*_tenant` qui la masquait
-- sans la corriger aurait ouvert les destinataires de TOUTES les ecoles.
CREATE POLICY ann_staff_recipients_write ON public.announcement_staff_recipients FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.announcements a
             WHERE a.id = announcement_staff_recipients.announcement_id
               AND a.etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                   'secretaire','responsable_pedagogique'])
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.announcements a
             WHERE a.id = announcement_staff_recipients.announcement_id
               AND a.etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                   'secretaire','responsable_pedagogique'])
  );

-- MARQUER COMME LU : fait par le DESTINATAIRE, depuis le navigateur. Sans cette
-- policy, la cloche ne se viderait jamais — y compris pour l'enseignant, qui
-- n'est dans aucune liste d'ecriture ci-dessus.
CREATE POLICY ann_staff_recipients_read_own ON public.announcement_staff_recipients FOR UPDATE
  USING (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.announcements a
                 WHERE a.id = announcement_staff_recipients.announcement_id
                   AND a.etablissement_id = current_etablissement_id())
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.announcements a
                 WHERE a.id = announcement_staff_recipients.announcement_id
                   AND a.etablissement_id = current_etablissement_id())
  );

-- ═══════════════════════════════════════════════════════════════════════════
--  4. `announcement_attachments` — les pieces jointes suivent leur message
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS ann_attachments_tenant ON public.announcement_attachments;
DROP POLICY IF EXISTS ann_attachments_select ON public.announcement_attachments;
DROP POLICY IF EXISTS ann_attachments_write  ON public.announcement_attachments;

-- Le perimetre est celui du MESSAGE : une PJ n'a pas de regle propre. On
-- s'appuie donc sur la policy de `announcements`, qui s'applique a la
-- sous-requete — ce qui garantit que les deux ne pourront jamais diverger.
CREATE POLICY ann_attachments_select ON public.announcement_attachments FOR SELECT
  USING (
    -- Le perimetre est celui du MESSAGE : une PJ n'a pas de regle propre. La
    -- sous-requete sur `announcements` subit la policy de cette table, donc les
    -- deux ne pourront jamais diverger. Le cloisonnement vient de la meme
    -- jointure, la table n'ayant pas de colonne `etablissement_id`.
    EXISTS (SELECT 1 FROM public.announcements a
             WHERE a.id = announcement_attachments.announcement_id
               AND a.etablissement_id = current_etablissement_id())
  );

CREATE POLICY ann_attachments_write ON public.announcement_attachments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.announcements a
             WHERE a.id = announcement_attachments.announcement_id
               AND a.etablissement_id = current_etablissement_id()
               AND (a.published_by = auth.uid()
                    OR coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.announcements a
             WHERE a.id = announcement_attachments.announcement_id
               AND a.etablissement_id = current_etablissement_id()
               AND (a.published_by = auth.uid()
                    OR coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])))
  );

SELECT 'Lot 2 : annonces cloisonnees par PERIMETRE ; selected ferme a l enseignant ; cloche preservee.' AS status;
