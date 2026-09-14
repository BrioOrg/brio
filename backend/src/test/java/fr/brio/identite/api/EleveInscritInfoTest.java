package fr.brio.identite.api;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class EleveInscritInfoTest {

    @Test
    void identifiantConnexionMustBePresentForOneTimeDisclosure() {
        // ADR 0018 §5: EleveInscritInfo is the single exception to ADR 0016 §4.
        // It includes identifiantConnexion exactly once so the student can note it.
        // This test ensures the field was not accidentally removed.
        var fieldNames = Arrays.stream(EleveInscritInfo.class.getRecordComponents())
                .map(rc -> rc.getName().toLowerCase())
                .toList();

        assertThat(fieldNames)
                .as("identifiantConnexion must be present in EleveInscritInfo (ADR 0018 §5 — one-time disclosure)")
                .contains("identifiantconnexion");
    }

    @Test
    void eleveInscritInfoMustNotExposeNomOrEmail() {
        // Students have no name on their account (ADR 0016 §2).
        // The class-scoped nomAffiche is the only identity surface.
        List<String> fieldNames = Arrays.stream(EleveInscritInfo.class.getRecordComponents())
                .map(rc -> rc.getName().toLowerCase())
                .toList();

        assertThat(fieldNames).doesNotContain("nom", "email", "emailtitulairelagal");
    }
}
