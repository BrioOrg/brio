-- F2 / ADR 0022 §6 (#103) — Pondération de la maîtrise par la difficulté.
-- La difficulté existe dans le contenu (course-content.schema.json, énum ouvert) mais
-- aucune couche back ne la portait : l'ingesteur la laissait tomber. On l'ajoute ici,
-- côté contenu, d'où elle remonte vers ExerciceDefinition → SoumissionEnregistree → progression.
-- Nullable : le schéma ne rend pas la difficulté obligatoire sur un bloc exercice, et les
-- exercices sans difficulté restent valides (pondérés « standard » côté progression).
ALTER TABLE contenu.exercices ADD COLUMN difficulte VARCHAR(64);
