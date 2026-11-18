package fr.brio.identite.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class ReinitialisationAccesInfoTest {

    @Test
    void shouldCarryTheIdentifierAndProvisionalPasswordButNoIdentity() {
        // ADR 0036 §2: the teacher gets back what the student forgot — identifier AND password.
        var champs = Arrays.stream(ReinitialisationAccesInfo.class.getRecordComponents())
                .map(rc -> rc.getName().toLowerCase())
                .toList();
        assertThat(champs).containsExactly("identifiantconnexion", "motdepasseprovisoire", "expirele");
    }
}
