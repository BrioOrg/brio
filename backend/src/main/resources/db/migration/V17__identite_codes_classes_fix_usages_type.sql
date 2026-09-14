-- Correct SMALLINT → INTEGER to match the Java int mapping on CodeClasse (#61)
ALTER TABLE identite.codes_classes
    ALTER COLUMN usages_max TYPE INTEGER,
    ALTER COLUMN usages     TYPE INTEGER;
