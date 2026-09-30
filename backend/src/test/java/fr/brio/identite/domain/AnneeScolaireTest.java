package fr.brio.identite.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class AnneeScolaireTest {

    @Test
    void shouldStartANewYearOnTheFirstOfAugust() {
        assertThat(AnneeScolaire.du(LocalDate.of(2026, 7, 31))).isEqualTo("2025-2026");
        assertThat(AnneeScolaire.du(LocalDate.of(2026, 8, 1))).isEqualTo("2026-2027");
    }

    @Test
    void shouldKeepTheYearAcrossTheNewYear() {
        assertThat(AnneeScolaire.du(LocalDate.of(2026, 12, 31))).isEqualTo("2026-2027");
        assertThat(AnneeScolaire.du(LocalDate.of(2027, 1, 1))).isEqualTo("2026-2027");
    }
}
