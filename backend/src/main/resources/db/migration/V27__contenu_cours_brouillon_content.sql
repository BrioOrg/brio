-- F3 / ADR 0019 — Contenu du brouillon d'un cours d'enseignant.
--
-- V26 a posé cours (métadonnées) et cours_versions (versions publiées, immuables,
-- publie_at NOT NULL). Il manque un endroit où vit le contenu en cours d'édition :
-- « Enregistrer » écrit un brouillon, « Publier » le fige dans cours_versions.
-- Un brouillon ne peut pas être une ligne cours_versions (celles-ci sont publiées
-- et immuables) ; c'est une colonne sur cours — un seul brouillon courant par cours.
--
-- NULL tant que rien n'a été saisi. À la publication, ce document est validé, ses
-- exercices extraits (champs de correction retirés), puis snapshoté dans
-- cours_versions ; le brouillon peut ensuite continuer à évoluer pour la v suivante.
ALTER TABLE contenu.cours
    ADD COLUMN brouillon_content JSONB;
