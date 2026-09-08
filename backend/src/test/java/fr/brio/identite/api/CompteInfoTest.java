package fr.brio.identite.api;

import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class CompteInfoTest {

    @Test
    void identifiantConnexionMustNotBeExposedInCompteInfo() {
        // ADR 0016 §4: identifiant_connexion is a credential, never a display value.
        // This test fails the build if someone adds the field to CompteInfo.
        var fieldNames = Arrays.stream(CompteInfo.class.getRecordComponents())
                .map(rc -> rc.getName().toLowerCase())
                .toList();

        assertThat(fieldNames)
                .as("identifiantConnexion must not appear in CompteInfo (ADR 0016 §4)")
                .doesNotContain("identifiantconnexion", "identifiant_connexion", "login", "username");
    }
}
