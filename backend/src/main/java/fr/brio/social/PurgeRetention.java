package fr.brio.social;

import fr.brio.social.api.ContenusAnonymises;
import fr.brio.social.infrastructure.FilRepository;
import fr.brio.social.infrastructure.MessageRepository;
import fr.brio.social.infrastructure.QuestionCommunauteRepository;
import fr.brio.social.infrastructure.ReponseCommunauteRepository;
import fr.brio.social.infrastructure.SalonMessageRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Retention purge of the entraide, class rooms and Communauté (ADR 0023 §6).
 *
 * <p>Contents written by students — entraide threads and messages, class-room messages,
 * Communauté questions and answers — are kept for the retention window (12 months by default,
 * configurable) and then <strong>anonymised</strong>: the text stays (the thread keeps its
 * meaning) but every link to a person is cut. On the content rows that is {@code auteur_id}
 * (and {@code marque_utile_par} on an entraide message), set to the {@link #COMPTE_ANONYME
 * anonymous account} (the nil UUID). Across modules, the XP that {@code progression} keeps for
 * an answer marked useful references that answer by id next to the student: the purge publishes
 * {@link ContenusAnonymises} so that reference is cut too.
 *
 * <p>Idempotent: a row already carried to the anonymous account is skipped on later runs.
 *
 * <p>Out of scope (ADR 0023 §6): reports, sanctions and votes — moderation / audit records, not
 * messages, whose own retention is set with the moderation groundwork.
 */
@Service
public class PurgeRetention {

    /** Compte de remplacement d'un auteur anonymisé : l'UUID nul, qui ne désigne aucun compte. */
    public static final UUID COMPTE_ANONYME = new UUID(0L, 0L);

    /** Shortest window accepted: one year, the LCEN retention of identification data. */
    static final int FENETRE_MINIMALE_MOIS = 12;

    private static final Logger log = LoggerFactory.getLogger(PurgeRetention.class);

    private final FilRepository fils;
    private final MessageRepository messages;
    private final SalonMessageRepository salonMessages;
    private final QuestionCommunauteRepository questions;
    private final ReponseCommunauteRepository reponses;
    private final ApplicationEventPublisher evenements;
    private final Clock clock;
    private final int fenetreMois;

    public PurgeRetention(
            FilRepository fils,
            MessageRepository messages,
            SalonMessageRepository salonMessages,
            QuestionCommunauteRepository questions,
            ReponseCommunauteRepository reponses,
            ApplicationEventPublisher evenements,
            Clock clock,
            @Value("${brio.social.retention.fenetre-mois:12}") int fenetreMois) {
        if (fenetreMois < FENETRE_MINIMALE_MOIS) {
            // A short window would cut, irreversibly, author links moderation still needs — and
            // the LCEN requires identification data to be kept one year. 0 or less would
            // anonymise everything, today's messages included. Fail at startup instead.
            throw new IllegalArgumentException(
                    "brio.social.retention.fenetre-mois doit valoir au moins "
                            + FENETRE_MINIMALE_MOIS + ", reçu " + fenetreMois);
        }
        this.fils = fils;
        this.messages = messages;
        this.salonMessages = salonMessages;
        this.questions = questions;
        this.reponses = reponses;
        this.evenements = evenements;
        this.clock = clock;
        this.fenetreMois = fenetreMois;
    }

    /** Anonymises every content older than the retention window and returns the tally. */
    @Transactional
    public Resultat purger() {
        Instant seuil = seuil();
        // Ids first: the update below changes the very predicate that selects them.
        List<UUID> utiles = new ArrayList<>(messages.utilesAAnonymiser(seuil, COMPTE_ANONYME));
        utiles.addAll(reponses.utilesAAnonymiser(seuil, COMPTE_ANONYME));

        Resultat resultat =
                new Resultat(
                        fils.anonymiserAvant(seuil, COMPTE_ANONYME),
                        messages.anonymiserAvant(seuil, COMPTE_ANONYME),
                        salonMessages.anonymiserAvant(seuil, COMPTE_ANONYME),
                        questions.anonymiserAvant(seuil, COMPTE_ANONYME),
                        reponses.anonymiserAvant(seuil, COMPTE_ANONYME));
        if (!utiles.isEmpty()) {
            evenements.publishEvent(new ContenusAnonymises(utiles));
        }
        if (resultat.total() > 0) {
            log.info(
                    "Purge de rétention social : {} contenu(s) anonymisé(s) avant {} "
                            + "(fils={}, entraide={}, salons={}, questions={}, réponses={}, xp={})",
                    resultat.total(),
                    seuil,
                    resultat.fils(),
                    resultat.messagesEntraide(),
                    resultat.messagesSalon(),
                    resultat.questions(),
                    resultat.reponses(),
                    utiles.size());
        } else {
            log.debug("Purge de rétention social : rien à anonymiser avant {}", seuil);
        }
        return resultat;
    }

    /** A content created strictly before this instant is anonymised (12 calendar months, UTC). */
    Instant seuil() {
        return OffsetDateTime.now(clock).minusMonths(fenetreMois).toInstant();
    }

    /** Tally of one purge run: rows anonymised per table. */
    public record Resultat(
            int fils, int messagesEntraide, int messagesSalon, int questions, int reponses) {
        public int total() {
            return fils + messagesEntraide + messagesSalon + questions + reponses;
        }
    }
}
