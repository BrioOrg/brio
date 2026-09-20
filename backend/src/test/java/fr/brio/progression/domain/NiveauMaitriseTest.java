package fr.brio.progression.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.OptionalInt;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class NiveauMaitriseTest {

    // sommeSignal / sommePoids gives the weighted rate; echantillon is the (unweighted) row count.
    @ParameterizedTest(name = "taux {0}/{1} → niveau {3}")
    @CsvSource({
            "0, 5, 5, 0",   // 0.0
            "1, 5, 5, 1",   // 0.2
            "2, 5, 5, 2",   // 0.4
            "3, 5, 5, 3",   // 0.6
            "4, 5, 5, 4",   // 0.8 lands on 4
            "5, 5, 5, 4",   // 1.0 clamped to 4
            "8, 10, 10, 4", // 0.8
            "7, 10, 10, 3", // 0.7
    })
    void niveauDeriveDuTauxPondere(double sommeSignal, double sommePoids, int echantillon, int niveauAttendu) {
        assertThat(NiveauMaitrise.pour(sommeSignal, sommePoids, echantillon)).hasValue(niveauAttendu);
    }

    @ParameterizedTest(name = "échantillon {0} < seuil → aucun niveau")
    @CsvSource({"0", "1", "2"})
    void echantillonTropFaibleNeReporteAucunNiveau(int echantillon) {
        // One or two good answers must not read "maîtrisé" (ADR 0022 §6).
        assertThat(NiveauMaitrise.pour(echantillon, echantillon, echantillon)).isEmpty();
    }

    @Test
    void auSeuilExactUnNiveauEstReporte() {
        assertThat(NiveauMaitrise.pour(3, NiveauMaitrise.SEUIL_ECHANTILLON, NiveauMaitrise.SEUIL_ECHANTILLON))
                .isEqualTo(OptionalInt.of(4));
    }

    @Test
    void unSommePoidsNulNeDivisePasParZero() {
        // Degenerate but guarded: no weight at all reads as rate 0, not NaN.
        assertThat(NiveauMaitrise.pour(0, 0, NiveauMaitrise.SEUIL_ECHANTILLON))
                .isEqualTo(OptionalInt.of(0));
    }

    @ParameterizedTest(name = "difficulté {0} → poids {1}")
    @CsvSource({
            "introduction, 1.0",
            "standard, 2.0",
            "approfondissement, 3.0",
    })
    void poidsParBande(String difficulte, double poidsAttendu) {
        assertThat(NiveauMaitrise.poids(difficulte)).isEqualTo(poidsAttendu);
    }

    @Test
    void poidsInconnuOuNullEstTraiteCommeStandard() {
        // Open enum + legacy rows: an unknown or missing band is weighted as the median.
        assertThat(NiveauMaitrise.poids(null)).isEqualTo(2.0);
        assertThat(NiveauMaitrise.poids("expert")).isEqualTo(2.0);
    }
}
