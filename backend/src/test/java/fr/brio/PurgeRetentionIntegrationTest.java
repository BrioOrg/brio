package fr.brio;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import fr.brio.social.CommunauteService;
import fr.brio.social.MessageInvalideException;
import fr.brio.social.PurgeRetention;
import fr.brio.social.api.ReponseUtileValidee;
import fr.brio.social.domain.SalonMessage;
import fr.brio.social.infrastructure.FilRepository;
import fr.brio.social.infrastructure.MessageRepository;
import fr.brio.social.infrastructure.QuestionCommunauteRepository;
import fr.brio.social.infrastructure.ReponseCommunauteRepository;
import fr.brio.social.infrastructure.SalonMessageRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The retention purge (ADR 0023 §6) against a real Postgres. Acceptance criterion: past the
 * 12-month window, <em>no</em> join gives a student back from one of their contents — not on the
 * content row, not through the thread, not through the XP the content earned — while the text
 * stays and recent contents keep their author. Rows are written in SQL to control {@code
 * created_at}.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class PurgeRetentionIntegrationTest {

    private static final UUID AUTEUR = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID AUTEUR_FIL = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID ANONYME = PurgeRetention.COMPTE_ANONYME;

    private static final UUID FIL = UUID.fromString("f11a0000-0000-0000-0000-000000000001");
    private static final UUID SALON = UUID.fromString("5a100000-0000-0000-0000-000000000001");

    private static final UUID MSG_VIEUX = UUID.fromString("a0000000-0000-0000-0000-00000000000a");
    private static final UUID MSG_RECENT = UUID.fromString("a0000000-0000-0000-0000-00000000000b");
    private static final UUID MSG_VIEUX_NON_UTILE = UUID.fromString("a0000000-0000-0000-0000-00000000000c");
    private static final UUID SALON_MSG_VIEUX = UUID.fromString("b0000000-0000-0000-0000-00000000000a");
    private static final UUID SALON_MSG_RECENT = UUID.fromString("b0000000-0000-0000-0000-00000000000b");
    private static final UUID Q_VIEUX = UUID.fromString("c0000000-0000-0000-0000-00000000000a");
    private static final UUID Q_RECENT = UUID.fromString("c0000000-0000-0000-0000-00000000000b");
    private static final UUID REP_VIEUX = UUID.fromString("d0000000-0000-0000-0000-00000000000a");
    private static final UUID REP_RECENT = UUID.fromString("d0000000-0000-0000-0000-00000000000b");

    @Autowired PurgeRetention purgeRetention;
    @Autowired CommunauteService communaute;
    @Autowired FilRepository fils;
    @Autowired MessageRepository messages;
    @Autowired SalonMessageRepository salonMessages;
    @Autowired QuestionCommunauteRepository questions;
    @Autowired ReponseCommunauteRepository reponses;
    @Autowired ApplicationEventPublisher evenements;
    @Autowired PlatformTransactionManager transactions;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void poserDesContenus() {
        jdbc.update("DELETE FROM social.communaute_reponses");
        jdbc.update("DELETE FROM social.communaute_questions");
        jdbc.update("DELETE FROM social.salon_messages");
        jdbc.update("DELETE FROM social.salons");
        jdbc.update("DELETE FROM social.messages");
        jdbc.update("DELETE FROM social.fils");
        jdbc.update("DELETE FROM progression.evenements_xp WHERE eleve_id IN (?, ?, ?)", AUTEUR, AUTEUR_FIL, ANONYME);
        jdbc.update("DELETE FROM progression.soldes WHERE eleve_id IN (?, ?, ?)", AUTEUR, AUTEUR_FIL, ANONYME);

        jdbc.update(
                "INSERT INTO social.fils (id, portee, portee_ref, classe_id, titre, auteur_id, created_at) "
                        + "VALUES (?, 'chapitre', 'ch-1', gen_random_uuid(), 'Fil', ?, now() - interval '13 months')",
                FIL, AUTEUR_FIL);
        jdbc.update(
                "INSERT INTO social.messages (id, fil_id, auteur_id, corps, marque_utile_at, marque_utile_par, created_at) "
                        + "VALUES (?, ?, ?, 'ancien message', now() - interval '13 months', ?, now() - interval '13 months')",
                MSG_VIEUX, FIL, AUTEUR, AUTEUR_FIL);
        jdbc.update(
                "INSERT INTO social.messages (id, fil_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, 'ancien non retenu', now() - interval '13 months')",
                MSG_VIEUX_NON_UTILE, FIL, AUTEUR);
        jdbc.update(
                "INSERT INTO social.messages (id, fil_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, 'message recent', now() - interval '1 month')",
                MSG_RECENT, FIL, AUTEUR);

        jdbc.update(
                "INSERT INTO social.salons (id, classe_id, titre, cree_par, created_at) "
                        + "VALUES (?, gen_random_uuid(), 'Salon', ?, now() - interval '13 months')",
                SALON, AUTEUR_FIL);
        jdbc.update(
                "INSERT INTO social.salon_messages (id, salon_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, 'ancien salon', now() - interval '13 months')",
                SALON_MSG_VIEUX, SALON, AUTEUR);
        jdbc.update(
                "INSERT INTO social.salon_messages (id, salon_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, 'salon recent', now() - interval '1 month')",
                SALON_MSG_RECENT, SALON, AUTEUR);

        jdbc.update(
                "INSERT INTO social.communaute_questions (id, auteur_id, titre, corps, matiere, created_at) "
                        + "VALUES (?, ?, 'ancienne question', '[\"q\"]'::jsonb, 'maths', now() - interval '13 months')",
                Q_VIEUX, AUTEUR);
        jdbc.update(
                "INSERT INTO social.communaute_questions (id, auteur_id, titre, corps, matiere, created_at) "
                        + "VALUES (?, ?, 'question recente', '[]'::jsonb, 'maths', now() - interval '1 month')",
                Q_RECENT, AUTEUR_FIL);
        jdbc.update(
                "INSERT INTO social.communaute_reponses (id, question_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, '[\"r\"]'::jsonb, now() - interval '13 months')",
                REP_VIEUX, Q_VIEUX, AUTEUR);
        jdbc.update(
                "INSERT INTO social.communaute_reponses (id, question_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, '[]'::jsonb, now() - interval '1 month')",
                REP_RECENT, Q_RECENT, AUTEUR);
    }

    private UUID auteurDe(String table, UUID id) {
        return jdbc.queryForObject("SELECT auteur_id FROM social." + table + " WHERE id = ?", UUID.class, id);
    }

    private String texte(String colonne, String table, UUID id) {
        return jdbc.queryForObject(
                "SELECT " + colonne + "::text FROM social." + table + " WHERE id = ?", String.class, id);
    }

    private UUID marqueUtilePar(UUID messageId) {
        return jdbc.queryForObject(
                "SELECT marque_utile_par FROM social.messages WHERE id = ?", UUID.class, messageId);
    }

    /** The purge as the job runs it, but at a chosen "now". */
    private PurgeRetention.Resultat purgerA(Instant maintenant) {
        PurgeRetention purge = new PurgeRetention(
                fils, messages, salonMessages, questions, reponses, evenements,
                Clock.fixed(maintenant, ZoneOffset.UTC), 12);
        return new TransactionTemplate(transactions).execute(s -> purge.purger());
    }

    @Test
    void shouldCutEveryAuthorLinkPastTheWindowAndKeepRecentOnes() {
        PurgeRetention.Resultat resultat = purgeRetention.purger();

        assertThat(resultat).isEqualTo(new PurgeRetention.Resultat(1, 2, 1, 1, 1));

        assertThat(auteurDe("fils", FIL)).isEqualTo(ANONYME);
        assertThat(auteurDe("messages", MSG_VIEUX)).isEqualTo(ANONYME);
        assertThat(auteurDe("messages", MSG_VIEUX_NON_UTILE)).isEqualTo(ANONYME);
        assertThat(auteurDe("salon_messages", SALON_MSG_VIEUX)).isEqualTo(ANONYME);
        assertThat(auteurDe("communaute_questions", Q_VIEUX)).isEqualTo(ANONYME);
        assertThat(auteurDe("communaute_reponses", REP_VIEUX)).isEqualTo(ANONYME);
        assertThat(marqueUtilePar(MSG_VIEUX)).isEqualTo(ANONYME);
        // A message never marked useful keeps an empty "marked useful by", not the nil account.
        assertThat(marqueUtilePar(MSG_VIEUX_NON_UTILE)).isNull();

        assertThat(auteurDe("messages", MSG_RECENT)).isEqualTo(AUTEUR);
        assertThat(auteurDe("salon_messages", SALON_MSG_RECENT)).isEqualTo(AUTEUR);
        assertThat(auteurDe("communaute_questions", Q_RECENT)).isEqualTo(AUTEUR_FIL);
        assertThat(auteurDe("communaute_reponses", REP_RECENT)).isEqualTo(AUTEUR);

        // No row left anywhere in social linking a past-window content to a student.
        assertThat(jdbc.queryForObject(
                        """
                        SELECT count(*) FROM (
                          SELECT auteur_id a FROM social.fils WHERE created_at < now() - interval '12 months'
                          UNION ALL SELECT auteur_id FROM social.messages WHERE created_at < now() - interval '12 months'
                          UNION ALL SELECT marque_utile_par FROM social.messages
                                     WHERE created_at < now() - interval '12 months' AND marque_utile_par IS NOT NULL
                          UNION ALL SELECT auteur_id FROM social.salon_messages WHERE created_at < now() - interval '12 months'
                          UNION ALL SELECT auteur_id FROM social.communaute_questions WHERE created_at < now() - interval '12 months'
                          UNION ALL SELECT auteur_id FROM social.communaute_reponses WHERE created_at < now() - interval '12 months'
                        ) t WHERE a <> ?
                        """,
                        Long.class, ANONYME))
                .isZero();
    }

    @Test
    void shouldKeepTheTextOfEveryAnonymisedContent() {
        purgeRetention.purger();

        assertThat(texte("titre", "fils", FIL)).isEqualTo("Fil");
        assertThat(texte("corps", "messages", MSG_VIEUX)).isEqualTo("ancien message");
        assertThat(texte("corps", "salon_messages", SALON_MSG_VIEUX)).isEqualTo("ancien salon");
        assertThat(texte("titre", "communaute_questions", Q_VIEUX)).isEqualTo("ancienne question");
        assertThat(texte("corps", "communaute_questions", Q_VIEUX)).isEqualTo("[\"q\"]");
        assertThat(texte("corps", "communaute_reponses", REP_VIEUX)).isEqualTo("[\"r\"]");
    }

    @Test
    void shouldBeIdempotent() {
        assertThat(purgeRetention.purger().total()).isEqualTo(6);

        assertThat(purgeRetention.purger().total()).isZero();
        assertThat(auteurDe("messages", MSG_RECENT)).isEqualTo(AUTEUR);
        assertThat(auteurDe("messages", MSG_VIEUX)).isEqualTo(ANONYME);
    }

    @Test
    void shouldDoNothingOnAnEmptyDatabase() {
        jdbc.update("DELETE FROM social.communaute_reponses");
        jdbc.update("DELETE FROM social.communaute_questions");
        jdbc.update("DELETE FROM social.salon_messages");
        jdbc.update("DELETE FROM social.messages");

        PurgeRetention.Resultat resultat = purgeRetention.purger();

        // Only the thread and the room themselves remain; the room has no author column to cut.
        assertThat(resultat).isEqualTo(new PurgeRetention.Resultat(1, 0, 0, 0, 0));
        assertThat(purgeRetention.purger().total()).isZero();
    }

    @Test
    void shouldKeepAContentCreatedExactlyAtTheThresholdAndCutOneMicrosecondBefore() {
        Instant maintenant = Instant.parse("2026-06-15T01:30:00Z");
        OffsetDateTime seuil = OffsetDateTime.parse("2025-06-15T01:30:00Z");
        UUID avant = poserMessageSalon(seuil.minus(1, ChronoUnit.MICROS));
        UUID pile = poserMessageSalon(seuil);
        UUID apres = poserMessageSalon(seuil.plus(1, ChronoUnit.MICROS));

        purgerA(maintenant);

        assertThat(auteurDe("salon_messages", avant)).isEqualTo(ANONYME);
        assertThat(auteurDe("salon_messages", pile)).as("strict < : at the threshold is kept").isEqualTo(AUTEUR);
        assertThat(auteurDe("salon_messages", apres)).isEqualTo(AUTEUR);

        // A sub-microsecond threshold Postgres cannot store must never pull a later row in.
        purgerA(maintenant.plusNanos(600));
        assertThat(auteurDe("salon_messages", apres)).isEqualTo(AUTEUR);
    }

    @Test
    void shouldNotLetAnEntityLoadedBeforeThePurgeWriteTheAuthorBack() {
        TransactionTemplate purgeConcurrente = new TransactionTemplate(transactions);
        purgeConcurrente.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        // A teacher's moderation loads the message, the nightly purge commits in between, then
        // the moderation flushes.
        new TransactionTemplate(transactions).executeWithoutResult(s -> {
            SalonMessage message = salonMessages.findById(SALON_MSG_VIEUX).orElseThrow();
            purgeConcurrente.executeWithoutResult(s2 -> purgeRetention.purger());
            message.masquer();
        });

        assertThat(auteurDe("salon_messages", SALON_MSG_VIEUX)).isEqualTo(ANONYME);
        assertThat(texte("statut", "salon_messages", SALON_MSG_VIEUX)).isEqualTo("masque");
    }

    @Test
    void shouldCleanAMarkedUsefulByWrittenAfterTheAuthorWasAnonymised() {
        // A concurrent marquerUtile that loaded the row before the purge writes the thread
        // author back into marque_utile_par after it.
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO social.messages (id, fil_id, auteur_id, corps, marque_utile_at, marque_utile_par, created_at) "
                        + "VALUES (?, ?, ?, 'vieux', now(), ?, now() - interval '13 months')",
                id, FIL, ANONYME, AUTEUR_FIL);

        purgeRetention.purger();

        assertThat(marqueUtilePar(id)).isEqualTo(ANONYME);
    }

    @Test
    void shouldAnonymiseEachRowOnceWhenTwoInstancesRunTogether() throws Exception {
        for (int i = 0; i < 200; i++) {
            poserMessageSalon(OffsetDateTime.now(ZoneOffset.UTC).minusMonths(13));
        }
        CyclicBarrier depart = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> passe = () -> {
                depart.await();
                return purgeRetention.purger().messagesSalon();
            };
            Future<Integer> a = pool.submit(passe);
            Future<Integer> b = pool.submit(passe);
            // 200 posted here + SALON_MSG_VIEUX.
            assertThat(a.get(30, SECONDS) + b.get(30, SECONDS)).isEqualTo(201);
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM social.salon_messages WHERE auteur_id = ?", Long.class, AUTEUR))
                .isEqualTo(1L); // SALON_MSG_RECENT only
    }

    @Test
    void shouldCutTheXpReferenceThatWouldGiveTheAuthorOfAUsefulAnswerBack() {
        // The XP progression granted when MSG_VIEUX was marked useful (the real event path).
        new TransactionTemplate(transactions).executeWithoutResult(s ->
                evenements.publishEvent(new ReponseUtileValidee(AUTEUR, MSG_VIEUX, Instant.now())));
        await().atMost(Duration.ofSeconds(10)).until(() -> xpReferencant(MSG_VIEUX) == 1);
        int pointsAvant = pointsDe(AUTEUR);

        purgeRetention.purger();

        await().atMost(Duration.ofSeconds(10)).until(() -> xpReferencant(MSG_VIEUX) == 0);
        // The XP stays — the student's balance does not move — but nothing points at the content.
        assertThat(pointsDe(AUTEUR)).isEqualTo(pointsAvant).isPositive();
        assertThat(jdbc.queryForList(
                        "SELECT source_ref FROM progression.evenements_xp WHERE eleve_id = ?", String.class, AUTEUR))
                .singleElement()
                .asString()
                .startsWith("anonymise:");
    }

    @Test
    void shouldRefuseToResolveAQuestionWithAnAnonymisedAnswer() {
        jdbc.update("UPDATE social.communaute_reponses SET auteur_id = ? WHERE id = ?", ANONYME, REP_RECENT);

        assertThatThrownBy(() -> communaute.resoudre(Q_RECENT, REP_RECENT, AUTEUR_FIL))
                .isInstanceOf(MessageInvalideException.class);
        assertThat(jdbc.queryForObject(
                        "SELECT reponse_resolue_id FROM social.communaute_questions WHERE id = ?", UUID.class, Q_RECENT))
                .isNull();
    }

    private UUID poserMessageSalon(OffsetDateTime createdAt) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO social.salon_messages (id, salon_id, auteur_id, corps, created_at) VALUES (?, ?, ?, 'x', ?)",
                id, SALON, AUTEUR, createdAt);
        return id;
    }

    private int xpReferencant(UUID contenuId) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM progression.evenements_xp WHERE source_type = 'entraide' AND source_ref = ?",
                Integer.class, contenuId.toString());
    }

    private int pointsDe(UUID eleve) {
        List<Integer> points = jdbc.queryForList(
                "SELECT coalesce(sum(points), 0)::int FROM progression.evenements_xp WHERE eleve_id = ?",
                Integer.class, eleve);
        return points.getFirst();
    }
}
