-- Mode contrôle (ADR 0025) : le type de devoir accepte désormais 'controle' en plus de
-- 'devoir_maison'. On remplace la contrainte CHECK posée en V28 (auto-nommée devoirs_type_check).
ALTER TABLE devoirs.devoirs DROP CONSTRAINT devoirs_type_check;
ALTER TABLE devoirs.devoirs
    ADD CONSTRAINT devoirs_type_check CHECK (type IN ('devoir_maison', 'controle'));
