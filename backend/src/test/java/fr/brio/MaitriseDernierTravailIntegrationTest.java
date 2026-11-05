package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;

import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.progression.ProgressionService;
import fr.brio.progression.api.MaitriseInfo;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** The mastery read says when a competence was last worked on, retries included (#324). */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class MaitriseDernierTravailIntegrationTest {

    private static final String COMPETENCE = "c4.geo.pythagore.calculer";

    @Autowired ProgressionService progression;
    @Autowired CompteRepository comptes;

    @Test
    void shouldGiveTheDateOfTheLatestSubmissionOnACompetence() {
        String suffixe = UUID.randomUUID().toString();
        Compte compte = Compte.creerEleve(
                "eleve.maitrise." + suffixe, "{noop}motdepasse", "parent@test.fr", "3e", "Test-" + suffixe);
        compte.activer();
        UUID eleve = comptes.save(compte).getId();
        UUID exercice = UUID.randomUUID();
        Instant premiere = Instant.now().minus(10, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        Instant reprise = premiere.plus(5, ChronoUnit.DAYS);

        progression.attribuerPourSoumission(soumission(eleve, exercice, false, true, premiere));
        progression.attribuerPourSoumission(soumission(eleve, exercice, true, false, reprise));

        List<MaitriseInfo> maitrises = progression.maitrise(eleve);
        assertThat(maitrises).extracting(MaitriseInfo::competenceCode).containsExactly(COMPETENCE);
        assertThat(maitrises.get(0).dernierTravail()).isEqualTo(reprise);
    }

    private static SoumissionEnregistree soumission(
            UUID eleve, UUID exercice, boolean correct, boolean premiereTentative, Instant quand) {
        return new SoumissionEnregistree(
                eleve, exercice, UUID.randomUUID(), null, correct, correct ? 1.0 : 0.0,
                premiereTentative, List.of(COMPETENCE), null, quand);
    }
}
