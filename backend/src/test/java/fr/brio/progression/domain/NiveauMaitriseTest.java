package fr.brio.progression.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.OptionalInt;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class NiveauMaitriseTest {

    @ParameterizedTest(name = "{0}/{1} réussites → niveau {2}")
    @CsvSource({
            "0, 5, 0",   // 0.0
            "1, 5, 1",   // 0.2
            "2, 5, 2",   // 0.4
            "3, 5, 3",   // 0.6
            "4, 5, 4",   // 0.8 lands on 4
            "5, 5, 4",   // 1.0 clamped to 4
            "8, 10, 4",  // 0.8
            "7, 10, 3",  // 0.7
    })
    void niveauDerivEDuTauxDeReussite(int reussites, int echantillon, int niveauAttendu) {
        assertThat(NiveauMaitrise.pour(reussites, echantillon)).hasValue(niveauAttendu);
    }

    @ParameterizedTest(name = "échantillon {0} < seuil → aucun niveau")
    @CsvSource({"0", "1", "2"})
    void echantillonTropFaibleNeReporteAucunNiveau(int echantillon) {
        // One or two correct answers must not read "maîtrisé" (ADR 0022 §6).
        assertThat(NiveauMaitrise.pour(echantillon, echantillon)).isEmpty();
    }

    @Test
    void auSeuilExactUnNiveauEstReporte() {
        assertThat(NiveauMaitrise.pour(3, NiveauMaitrise.SEUIL_ECHANTILLON))
                .isEqualTo(OptionalInt.of(4));
    }
}
