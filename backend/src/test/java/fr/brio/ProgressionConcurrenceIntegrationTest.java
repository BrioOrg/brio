package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;

import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.progression.ProgressionService;
import fr.brio.progression.infrastructure.EvenementXpRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Several submissions landing at once for a brand-new student must not lose XP (#344). The streak
 * and balance rows are created on the fly; before the fix a concurrent first activity made the
 * second award blow up on {@code series_pkey} and roll back its whole transaction — the submission's
 * XP vanished with no error shown to the student. Not {@code @Transactional}: the threads must each
 * commit for the race to be real.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ProgressionConcurrenceIntegrationTest {

    @Autowired ProgressionService progression;
    @Autowired CompteRepository comptes;
    @Autowired EvenementXpRepository evenements;

    @Test
    void shouldNotLoseXpWhenAStudentsFirstSubmissionsLandAtOnce() throws Exception {
        UUID eleve = nouvelEleve();
        int nb = 6; // 6 × 10 XP (premier coup), bien sous le plafond de 200/jour

        List<Throwable> echecs = new CopyOnWriteArrayList<>();
        CyclicBarrier depart = new CyclicBarrier(nb);
        ExecutorService pool = Executors.newFixedThreadPool(nb);
        try {
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < nb; i++) {
                UUID exercice = UUID.randomUUID(); // exercices distincts : isole les singletons par élève
                futures.add(pool.submit(() -> {
                    try {
                        depart.await(); // lâcher tous les threads dans l'attribution au même instant
                        progression.attribuerPourSoumission(premierCoupReussi(eleve, exercice));
                    } catch (Throwable t) {
                        echecs.add(t);
                    }
                }));
            }
            for (Future<?> f : futures) {
                f.get();
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(echecs).as("aucune attribution ne doit échouer sur une course de création").isEmpty();
        // Source de vérité : chaque attribution est enregistrée, aucune perdue dans un rollback.
        assertThat(evenements.sommePointsPourEleve(eleve)).isEqualTo(nb * 10);
        // Et le solde matérialisé, sérialisé par le verrou, les reflète toutes.
        assertThat(progression.pour(eleve).xpTotal()).isEqualTo(nb * 10);
    }

    private UUID nouvelEleve() {
        String suffixe = UUID.randomUUID().toString();
        Compte compte = Compte.creerEleve(
                "eleve.concurrence." + suffixe, "{noop}motdepasse", "parent@test.fr", "4e", "Test-" + suffixe);
        compte.activer();
        return comptes.save(compte).getId();
    }

    private static SoumissionEnregistree premierCoupReussi(UUID eleve, UUID exercice) {
        return new SoumissionEnregistree(
                eleve, exercice, UUID.randomUUID(), null, true, 1.0, true, List.of(), null, Instant.now());
    }
}
