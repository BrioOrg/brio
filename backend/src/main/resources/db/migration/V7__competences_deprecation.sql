-- Deprecation support for competency referential (ADR 0009, issue #28).
-- deprecated_since: BO reference of the text that superseded the entry; NULL = active.
-- remplace_par: codes of successor entries. NULL = mapping not established; '{}' = no successor.
ALTER TABLE contenu.competences
    ADD COLUMN deprecated_since VARCHAR(256),
    ADD COLUMN remplace_par     TEXT[];
