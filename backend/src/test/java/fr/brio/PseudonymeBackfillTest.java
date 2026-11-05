package fr.brio;

import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** V40 on accounts that pre-date it, in a database of its own stopped at V39 (#325). */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class PseudonymeBackfillTest {

    @Autowired HikariDataSource dataSource;

    @Test
    void shouldFillEveryExistingStudentWithAUniquePseudonymAndLeaveAdultsAlone() {
        new JdbcTemplate(dataSource).execute("CREATE DATABASE backfill_pseudonyme");
        String url = dataSource.getJdbcUrl().replaceFirst("/[^/?]+(\\?|$)", "/backfill_pseudonyme$1");
        var cible = new DriverManagerDataSource(url, dataSource.getUsername(), dataSource.getPassword());
        var jdbc = new JdbcTemplate(cible);

        Flyway.configure().dataSource(cible).target("39").load().migrate();
        for (int i = 0; i < 1000; i++) { // more than the 800 pairs: suffixes are forced
            jdbc.update("""
                    INSERT INTO identite.comptes
                        (role, identifiant_connexion, mot_de_passe_hash, email_titulaire_legal, base_legale)
                    VALUES ('eleve', ?, 'h', 'parent@test.fr', 'consentement')""", "eleve" + i);
        }
        jdbc.update("""
                INSERT INTO identite.comptes (role, identifiant_connexion, mot_de_passe_hash, nom, email, statut)
                VALUES ('enseignant', 'prof', 'h', 'Mme Durand', 'prof@test.fr', 'actif')""");

        Flyway.configure().dataSource(cible).target("40").load().migrate();

        List<String> pseudonymes = jdbc.queryForList(
                "SELECT pseudonyme FROM identite.comptes WHERE role = 'eleve'", String.class);
        assertThat(pseudonymes).hasSize(1000).doesNotContainNull().doesNotHaveDuplicates()
                .allMatch(p -> p.matches("[^-]+-[^-]+(-\\d+)?"));
        assertThat(pseudonymes).anyMatch(p -> p.matches("[^-]+-[^-]+-\\d+"));
        assertThat(jdbc.queryForObject(
                "SELECT pseudonyme FROM identite.comptes WHERE role = 'enseignant'", String.class)).isNull();
    }
}
