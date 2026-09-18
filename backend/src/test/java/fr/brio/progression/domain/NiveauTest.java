package fr.brio.progression.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class NiveauTest {

    @ParameterizedTest(name = "{0} XP → niveau {1}")
    @CsvSource({
            "0, 0",
            "99, 0",
            "100, 1",
            "399, 1",
            "400, 2",
            "900, 3",
            "1600, 4",
            "2499, 4",
            "2500, 5",
    })
    void seuilsQuadratiques(int xp, int niveauAttendu) {
        assertThat(Niveau.pour(xp)).isEqualTo((short) niveauAttendu);
    }

    @Test
    void xpNegatifDonneNiveauZero() {
        assertThat(Niveau.pour(-50)).isEqualTo((short) 0);
    }
}
