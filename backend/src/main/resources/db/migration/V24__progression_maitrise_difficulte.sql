-- F2 / ADR 0022 §6 (#103) — Pondération de la maîtrise par la difficulté.
-- La projection recalculable garde sa propre copie de la difficulté de l'exercice, portée
-- par l'événement SoumissionEnregistree, pour que le recalcul reste possible sans appel à
-- contenu (§3). Nullable : les soumissions enregistrées avant #103 n'en portent pas — elles
-- sont pondérées « standard » (poids médian) au recalcul, sans backfill.
ALTER TABLE progression.soumissions_competences ADD COLUMN difficulte VARCHAR(64);
