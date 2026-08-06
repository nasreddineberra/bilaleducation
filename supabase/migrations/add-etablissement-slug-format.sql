-- ============================================================================
-- Format du slug d'établissement
--
-- Le slug DEVIENT le sous-domaine et n'est pas modifiable après création :
-- le changer casserait les favoris, les liens des emails déjà envoyés et les
-- raccourcis posés sur les téléphones. Une valeur invalide produirait donc une
-- école **définitivement injoignable**.
--
-- Les règles viennent du DNS, pas d'une préférence : une étiquette ne contient
-- que lettres minuscules, chiffres et tirets, et ne peut ni commencer ni finir
-- par un tiret.
--
-- CE QUE CETTE CONTRAINTE NE FAIT PAS : la liste des sous-domaines RÉSERVÉS
-- (`www`, `superadmin`, `mail`, `autodiscover`…) vit dans l'application
-- (`src/lib/tenant/slug.ts`) et non ici. C'est une décision produit, appelée à
-- évoluer ; la figer en base imposerait une migration à chaque ajout. La base
-- garde ce qui est objectif et stable — la forme.
--
-- Conséquence assumée : un INSERT en SQL direct pourrait encore créer une école
-- nommée `www`. Seul l'éditeur a cet accès, et il le saurait.
--
-- Idempotent.
-- ============================================================================

-- Contrôle préalable — doit renvoyer 0 ligne :
--   select id, nom, slug from etablissements
--   where slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
--      or char_length(slug) not between 2 and 30;

ALTER TABLE public.etablissements DROP CONSTRAINT IF EXISTS etablissements_slug_format;

ALTER TABLE public.etablissements
  ADD CONSTRAINT etablissements_slug_format
  CHECK (
    char_length(slug) BETWEEN 2 AND 30
    -- Commence et finit par une lettre ou un chiffre ; tirets autorisés entre.
    AND slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
  );

-- NB : 30 caractères et non les 63 permis par le DNS. Un sous-domaine se tape
-- et se dicte au téléphone ; au-delà, il devient impraticable bien avant d'être
-- techniquement invalide.
