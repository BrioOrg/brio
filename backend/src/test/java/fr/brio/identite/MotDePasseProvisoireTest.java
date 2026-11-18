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

    @Test
    void shouldCanonicaliseWhatTheStudentTypes() {
        assertThat(MotDePasseProvisoire.normaliser("K7M4-P9XA-3RTW")).isEqualTo("k7m4p9xa3rtw");
        assertThat(MotDePasseProvisoire.normaliser(" k7m4 p9xa 3rtw ")).isEqualTo("k7m4p9xa3rtw");
        assertThat(MotDePasseProvisoire.normaliser("k7m4p9xa3rtw")).isEqualTo("k7m4p9xa3rtw");
        // Non-breaking spaces, as a copy from a French page brings them (U+00A0, U+202F).
        assertThat(MotDePasseProvisoire.normaliser("k7m4\u00a0p9xa\u202f3rtw")).isEqualTo("k7m4p9xa3rtw");
    }

    @Test
    void shouldReadTheIdentifierWithoutSpacesNorCapitals() {
        assertThat(IdentifiantConnexion.normaliser(" K7M4 p9xa\u00a03R ")).isEqualTo("k7m4p9xa3r");
        assertThat(IdentifiantConnexion.normaliser("k7m4p9xa3r")).isEqualTo("k7m4p9xa3r");
        assertThat(IdentifiantConnexion.normaliser("   ")).isNull();
        assertThat(IdentifiantConnexion.normaliser(null)).isNull();
    }

    @Test
    void shouldToleratePresentationOnlyForAProvisionalHash() {
        var encodeur = new EncodeurMotsDePasse(
                org.springframework.security.crypto.factory.PasswordEncoderFactories.createDelegatingPasswordEncoder());
        String provisoire = MotDePasseProvisoire.hacher(encodeur, "k7m4-p9xa-3rtw");
        assertThat(provisoire).startsWith(MotDePasseProvisoire.PREFIXE + "{bcrypt}");
        assertThat(encodeur.matches("k7m4-p9xa-3rtw", provisoire)).isTrue();
        assertThat(encodeur.matches("K7M4P9XA3RTW", provisoire)).isTrue();
        assertThat(encodeur.matches("k7m4-p9xa-3rtx", provisoire)).isFalse();
        assertThat(encodeur.upgradeEncoding(provisoire)).isFalse();

        // An account's own password stays exact.
        String sien = encodeur.encode("Mon-Secret");
        assertThat(encodeur.matches("Mon-Secret", sien)).isTrue();
        assertThat(encodeur.matches("mon-secret", sien)).isFalse();
        assertThat(encodeur.matches("MonSecret", sien)).isFalse();
    }
}
