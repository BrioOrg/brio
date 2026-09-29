-- F4 (ADR 0020 §5) — tableau de bord « par compétence ». L'événement SoumissionEnregistree porte déjà
-- les codes de compétence de l'exercice ; on les stocke dans la projection pour agréger la réussite
-- par compétence sur toute la classe, sans rappeler le module contenu.
CREATE TABLE devoirs.rendu_exercice_competences (
    rendu_exercice_id  UUID NOT NULL REFERENCES devoirs.rendu_exercices (id) ON DELETE CASCADE,
    code               TEXT NOT NULL,
    PRIMARY KEY (rendu_exercice_id, code)
);
