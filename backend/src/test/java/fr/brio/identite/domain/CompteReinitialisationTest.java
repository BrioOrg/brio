package fr.brio.identite.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CompteReinitialisationTest {

    private final Instant maintenant = Instant.parse("2026-11-16T10:00:00Z");

    private Compte eleve() {
        return Compte.creerEleveMissionEtablissement("abcdefghjk", "{noop}ancien", UUID.randomUUID(), "Renard-Indigo");
    }

    @Test
    void shouldReplaceThePasswordAndRequireAChange() {
        Compte c = eleve();
        c.reinitialiserAcces("{noop}provisoire", maintenant.plus(Duration.ofDays(7)), maintenant, "enseignant");
        assertThat(c.getMotDePasseHash()).isEqualTo("{noop}provisoire");
        assertThat(c.isDoitChangerMotDePasse()).isTrue();
        assertThat(c.provisoireInutilisable(maintenant)).isFalse();
    }

    @Test
    void shouldExpireTheProvisionalPassword() {
        Compte c = eleve();
        c.reinitialiserAcces("{noop}provisoire", maintenant.plus(Duration.ofDays(7)), maintenant, "enseignant");
        assertThat(c.provisoireInutilisable(maintenant.plus(Duration.ofDays(7)).minusSeconds(1))).isFalse();
        assertThat(c.provisoireInutilisable(maintenant.plus(Duration.ofDays(7)))).isTrue();
    }

    @Test
    void shouldLiftEverythingOnceTheStudentChoosesTheirPassword() {
        Compte c = eleve();
        c.reinitialiserAcces("{noop}provisoire", maintenant.plus(Duration.ofDays(7)), maintenant, "enseignant");
        c.changerMotDePasse("{noop}le-mien");
        assertThat(c.isDoitChangerMotDePasse()).isFalse();
        assertThat(c.getMotDePasseProvisoireExpireLe()).isNull();
        assertThat(c.provisoireInutilisable(maintenant.plus(Duration.ofDays(30)))).isFalse();
        // The student is still told about the reset after the change (ADR 0036 §8).
        assertThat(c.getAccesReinitialiseLe()).isEqualTo(maintenant);
        assertThat(c.getAccesReinitialisePar()).isEqualTo("enseignant");
    }
}
