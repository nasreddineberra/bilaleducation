-- ============================================================================
-- Longueurs maximales du nom et de l'adresse d'établissement
--
-- Les limites viennent d'une MESURE de l'en-tête des PDF (bulletin, feuille
-- d'appel, attestation), qui est la contrainte la plus serrée de l'application :
--
--   * le NOM est écrit en 12 points gras et partage sa ligne avec le titre du
--     document, aligné à droite : c'est la longueur du TITRE qui commande.
--     Depuis l'homogénéisation des en-têtes à
--     12 points (nom ET titre), 30 caractères n'occupent plus que 76 mm sur les
--     91 laissés par le titre le plus long, « ATTESTATION DE PAIEMENT ».
--     Contrainte ASSUMÉE (décision utilisateur) : elle oblige à l'essentiel,
--     « Al-Firdaws Villeurbanne » plutôt que « Institut Al-Firdaws de
--     Villeurbanne ». Le nom est un choix éditorial, il se raccourcit.
--
--   * l'ADRESSE est en 8 points et dispose de 134 mm. 80 caractères en occupent
--     110 ; le débordement ne commence qu'au-delà de 90. La limite est large À
--     DESSEIN : une adresse postale abrégée devient FAUSSE. 60 avait été
--     envisagé puis écarté — l'adresse réelle en base en fait déjà 64, le nom
--     de la commune étant long à lui seul.
--
-- Ces contraintes DOUBLENT la validation du formulaire, qui écrit directement
-- depuis le navigateur : sans elles, la limite se contourne par un appel direct
-- à l'API REST.
--
-- Idempotent.
-- ============================================================================

-- Contrôle préalable — doit renvoyer 0 ligne :
--   select id, nom, char_length(nom) as n, char_length(coalesce(adresse,'')) as a
--   from etablissements
--   where char_length(nom) > 30 or char_length(coalesce(adresse,'')) > 80;

ALTER TABLE public.etablissements DROP CONSTRAINT IF EXISTS etablissements_nom_longueur;
ALTER TABLE public.etablissements DROP CONSTRAINT IF EXISTS etablissements_adresse_longueur;

-- Le minimum de 2 reprend la règle déjà appliquée par le formulaire.
ALTER TABLE public.etablissements
  ADD CONSTRAINT etablissements_nom_longueur
  CHECK (char_length(btrim(nom)) BETWEEN 2 AND 30);

-- `adresse` est nullable : la contrainte ne mord que sur une valeur présente.
ALTER TABLE public.etablissements
  ADD CONSTRAINT etablissements_adresse_longueur
  CHECK (adresse IS NULL OR char_length(btrim(adresse)) <= 80);

-- NB : `char_length` compte les CARACTÈRES, pas les octets — « É » vaut 1.
-- C'est bien ce qu'on veut : la largeur d'impression dépend des caractères.
