package fr.brio.identite;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class MotDePasseProvisoireTest {

    @Test
    void shouldBeThreeGroupsOfFourWithoutAmbiguousCharacters() {
        for (int i = 0; i < 200; i++) {
            String mdp = MotDePasseProvisoire.generer();
            assertThat(mdp).matches("^[23456789abcdefghjkmnpqrstuvwxyz]{4}(-[23456789abcdefghjkmnpqrstuvwxyz]{4}){2}$");
            // ADR 0036 §2: nothing a child confuses — 0/O, 1/l/I.
            assertThat(mdp).doesNotContain("0", "o", "O", "1", "l", "i", "I");
            assertThat(mdp.length()).isGreaterThanOrEqualTo(8);
        }
    }

    @Test
    void shouldNotRepeatItself() {
        Set<String> vus = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            vus.add(MotDePasseProvisoire.generer());
        }
        assertThat(vus).hasSize(1000);
    }
}
