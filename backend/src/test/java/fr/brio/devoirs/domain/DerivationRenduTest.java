package fr.brio.devoirs.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

class DerivationRenduTest {

    @Test
    void aucune_soumission_donne_non_commence_sans_score() {
        DerivationRendu.Resultat r = DerivationRendu.deriver(List.of(), 3);

        assertEquals(DerivationRendu.NON_COMMENCE, r.statut());
        assertNull(r.score());
    }

    @Test
    void une_soumission_sur_trois_donne_en_cours() {
        DerivationRendu.Resultat r = DerivationRendu.deriver(List.of(1.0), 3);

        assertEquals(DerivationRendu.EN_COURS, r.statut());
        assertEquals(1.0, r.score(), 1e-9);
    }

    @Test
    void tous_les_exercices_soumis_donne_rendu_avec_la_moyenne() {
        DerivationRendu.Resultat r = DerivationRendu.deriver(List.of(1.0, 0.0, 0.5), 3);

        assertEquals(DerivationRendu.RENDU, r.statut());
        assertEquals(0.5, r.score(), 1e-9);
    }
}
