package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;

import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.api.EleveInscritInfo;
import fr.brio.social.MessagerieService;
import fr.brio.social.NouveauSalon;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * A salon report never stays open on a message already hidden (#402), whichever of the report
 * and the hide comes first: both read the message under a row lock, so the second one waits
 * for the first to commit. Each test holds one transaction open while the other runs; remove
 * the lock ({@code SalonMessageRepository.verrouiller}) and both fail. Not
 * {@code @Transactional}: each side must commit for the race to be real.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class SalonSignalementConcurrenceIntegrationTest {

    private static final String MOT_DE_PASSE = "motdepasse123";

    @Autowired ClasseService classeService;
    @Autowired CompteService compteService;
    @Autowired MessagerieService messagerie;
    @Autowired TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;

    private record Salon(UUID prof, UUID eleve, UUID message) {}

    /** A class with its teacher and a student, a salon, and one message of another student. */
    private Salon salonAvecMessage() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        UUID etab = classeService.creerEtablissement(
                "Collège Salon " + suffix, null, "college", LocalDate.now().minusYears(1), "CONV-" + suffix).id();
        UUID prof = compteService.creerEnseignant(
                MOT_DE_PASSE, "Prof " + suffix, "prof-" + suffix + "@example.fr", etab).id();
        UUID classe = classeService.creerClassePourEnseignant(prof, etab, "5e", "5e S").id();
        EleveInscritInfo signaleur = classeService.rejoindreParCode(
                classeService.genererCodePourEnseignant(classe, prof).code(), MOT_DE_PASSE, "Inès");
        EleveInscritInfo auteur = classeService.rejoindreParCode(
                classeService.genererCodePourEnseignant(classe, prof).code(), MOT_DE_PASSE, "Hugo");
        UUID salon = messagerie.creerSalon(prof, new NouveauSalon(classe, "Salon"));
        UUID message = messagerie.publier(salon, auteur.id(), "un message déplacé");
        return new Salon(prof, signaleur.id(), message);
    }

    private int signalementsOuverts(UUID message) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM social.salon_signalements WHERE message_id = ? AND statut = 'ouvert'",
                Integer.class,
                message);
    }

    private static void attendre(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Test
    void givenAHideInProgressWhenAStudentReportsTheMessageThenNoReportStaysOpen() throws Exception {
        Salon s = salonAvecMessage();
        CountDownLatch masque = new CountDownLatch(1);
        CountDownLatch peutValider = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            // The teacher hides the message: written, not yet committed.
            Future<?> masquage = pool.submit(() -> transactions.executeWithoutResult(t -> {
                messagerie.masquer(s.prof(), s.message());
                masque.countDown();
                attendre(peutValider);
            }));
            assertThat(masque.await(10, TimeUnit.SECONDS)).isTrue();

            // Meanwhile the student, whose salon was not reloaded, reports it. Read without a
            // lock, the message would still look published and the report would be recorded.
            Future<?> signalement = pool.submit(() -> messagerie.signaler(s.message(), s.eleve(), "méchant"));
            Thread.sleep(500); // the report reaches the message's row while the hide holds it
            peutValider.countDown();
            masquage.get(10, TimeUnit.SECONDS);
            signalement.get(10, TimeUnit.SECONDS);

            assertThat(signalementsOuverts(s.message())).isZero();
            assertThat(messagerie.fileSignalements(s.prof())).isEmpty();
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void givenAReportInProgressWhenTheTeacherHidesTheMessageThenTheReportIsClosed() throws Exception {
        Salon s = salonAvecMessage();
        CountDownLatch signale = new CountDownLatch(1);
        CountDownLatch peutValider = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            // The student's report: recorded, not yet committed.
            Future<?> signalement = pool.submit(() -> transactions.executeWithoutResult(t -> {
                messagerie.signaler(s.message(), s.eleve(), "méchant");
                signale.countDown();
                attendre(peutValider);
            }));
            assertThat(signale.await(10, TimeUnit.SECONDS)).isTrue();

            // Meanwhile the teacher hides the message. Without the lock, the hide would not see
            // the uncommitted report and would leave it open once the report commits.
            Future<?> masquage = pool.submit(() -> messagerie.masquer(s.prof(), s.message()));
            Thread.sleep(500); // the hide reaches the message's row while the report holds it
            peutValider.countDown();
            signalement.get(10, TimeUnit.SECONDS);
            masquage.get(10, TimeUnit.SECONDS);

            assertThat(signalementsOuverts(s.message())).isZero();
        } finally {
            pool.shutdownNow();
        }
    }
}
