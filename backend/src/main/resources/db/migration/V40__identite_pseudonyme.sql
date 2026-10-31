-- #325 — Hors de sa classe, l'élève apparaît sous un pseudonyme attribué par Brio (ADR 0016 §2).
-- Pas de donnée nominative : motif Animal-Couleur, suffixe numérique en cas de collision.
-- La liste vit aussi dans PseudonymeGenerator ; ce backfill en est une copie figée.
ALTER TABLE identite.comptes
    ADD COLUMN pseudonyme VARCHAR(64);

DO $$
DECLARE
    animaux TEXT[] := ARRAY[
        'Renard', 'Loup', 'Lynx', 'Ours', 'Cerf', 'Chamois', 'Bouquetin', 'Écureuil',
        'Hérisson', 'Loutre', 'Hermine', 'Marmotte', 'Fennec', 'Suricate', 'Panda', 'Koala',
        'Tigre', 'Lion', 'Léopard', 'Guépard', 'Jaguar', 'Puma', 'Bison', 'Dauphin',
        'Orque', 'Otarie', 'Faucon', 'Aigle', 'Hibou', 'Chouette', 'Héron', 'Cygne',
        'Colibri', 'Mésange', 'Pinson', 'Albatros', 'Libellule', 'Coccinelle', 'Papillon', 'Salamandre'];
    couleurs TEXT[] := ARRAY[
        'Turquoise', 'Indigo', 'Émeraude', 'Ambre', 'Corail', 'Saphir', 'Azur', 'Cobalt',
        'Ocre', 'Lilas', 'Menthe', 'Citron', 'Cerise', 'Prune', 'Pervenche', 'Safran',
        'Orange', 'Sable', 'Olive', 'Cuivre'];
    eleve    RECORD;
    base     TEXT;
    candidat TEXT;
    suffixe  INTEGER;
BEGIN
    FOR eleve IN SELECT id FROM identite.comptes WHERE role = 'eleve' ORDER BY created_at LOOP
        base := animaux[1 + floor(random() * array_length(animaux, 1))::INTEGER]
                || '-' || couleurs[1 + floor(random() * array_length(couleurs, 1))::INTEGER];
        candidat := base;
        suffixe := 1;
        WHILE EXISTS (SELECT 1 FROM identite.comptes WHERE pseudonyme = candidat) LOOP
            suffixe := suffixe + 1;
            candidat := base || '-' || suffixe;
        END LOOP;
        UPDATE identite.comptes SET pseudonyme = candidat WHERE id = eleve.id;
    END LOOP;
END $$;

ALTER TABLE identite.comptes
    ADD CONSTRAINT uq_comptes_pseudonyme UNIQUE (pseudonyme),
    ADD CONSTRAINT pseudonyme_eleve_seulement CHECK ((role = 'eleve') = (pseudonyme IS NOT NULL));
