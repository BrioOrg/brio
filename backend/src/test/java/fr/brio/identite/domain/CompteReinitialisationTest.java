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
        c.reinitialiserAcces("{noop}provisoire", maintenant.plus(Duration.ofDays(7)));
        assertThat(c.getMotDePasseHash()).isEqualTo("{noop}provisoire");
        assertThat(c.isDoitChangerMotDePasse()).isTrue();
        assertThat(c.provisoireInutilisable(maintenant)).isFalse();
    }

    @Test
    void shouldExpireTheProvisionalPassword() {
        Compte c = eleve();
        c.reinitialiserAcces("{noop}provisoire", maintenant.plus(Duration.ofDays(7)));
        assertThat(c.provisoireInutilisable(maintenant.plus(Duration.ofDays(7)).minusSeconds(1))).isFalse();
        assertThat(c.provisoireInutilisable(maintenant.plus(Duration.ofDays(7)))).isTrue();
    }

    @Test
    void shouldAllowTheProvisionalPasswordOnce() {
        Compte c = eleve();
        c.reinitialiserAcces("{noop}provisoire", maintenant.plus(Duration.ofDays(7)));
        c.marquerProvisoireUtilise(maintenant);
        assertThat(c.provisoireInutilisable(maintenant)).isTrue();
    }

    @Test
    void shouldLiftEverythingOnceTheStudentChoosesTheirPassword() {
        Compte c = eleve();
        c.reinitialiserAcces("{noop}provisoire", maintenant.plus(Duration.ofDays(7)));
        c.marquerProvisoireUtilise(maintenant);
        c.changerMotDePasse("{noop}le-mien");
        assertThat(c.isDoitChangerMotDePasse()).isFalse();
        assertThat(c.getMotDePasseProvisoireExpireLe()).isNull();
        assertThat(c.provisoireInutilisable(maintenant.plus(Duration.ofDays(30)))).isFalse();
        // A normal login must not mark anything once no change is pending.
        c.marquerProvisoireUtilise(maintenant);
        assertThat(c.provisoireInutilisable(maintenant)).isFalse();
    }
}
