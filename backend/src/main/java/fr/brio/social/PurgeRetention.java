package fr.brio.social;

import fr.brio.social.infrastructure.MessageRepository;
import fr.brio.social.infrastructure.QuestionCommunauteRepository;
import fr.brio.social.infrastructure.ReponseCommunauteRepository;
import fr.brio.social.infrastructure.SalonMessageRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Purge de rétention de la Communauté et de l'entraide (ADR 0023 §6).
 *
 * <p>Les contenus rédigés par des élèves (messages d'entraide, messages de salon, questions et
 * réponses de la Communauté) sont conservés le temps de la fenêtre de rétention — 12 mois par
 * défaut, configurable — puis <strong>anonymisés</strong> : le texte reste (le fil garde son sens),
 * mais la donnée d'identification, à savoir le lien vers le compte de l'auteur, est coupée. C'est
 * la séparation « identification / contenu » voulue par la LCEN et l'ADR : après anonymisation un
 * message ne peut plus être rattaché à un élève.
 *
 * <p>L'anonymisation remplace l'auteur par le {@link #COMPTE_ANONYME compte anonyme} (UUID nul).
 * L'opération est idempotente : une ligne déjà portée au compte anonyme est ignorée aux passages
 * suivants.
 *
 * <p>Hors périmètre de cette tâche (voir ADR 0023 §6) : signalements, sanctions et votes. Ce sont
 * des enregistrements de modération / d'audit, pas des messages ; leur rétention propre sera
 * traitée avec le reste du socle de modération.
 */
@Service
public class PurgeRetention {

    /** Compte de remplacement d'un auteur anonymisé : l'UUID nul, qui ne désigne aucun compte. */
    public static final UUID COMPTE_ANONYME = new UUID(0L, 0L);

    private static final Logger log = LoggerFactory.getLogger(PurgeRetention.class);

    private final MessageRepository messages;
    private final SalonMessageRepository salonMessages;
    private final QuestionCommunauteRepository questions;
    private final ReponseCommunauteRepository reponses;
    private final Clock clock;
    private final int fenetreMois;

    public PurgeRetention(
            MessageRepository messages,
            SalonMessageRepository salonMessages,
            QuestionCommunauteRepository questions,
            ReponseCommunauteRepository reponses,
            Clock clock,
            @Value("${brio.social.retention.fenetre-mois:12}") int fenetreMois) {
        this.messages = messages;
        this.salonMessages = salonMessages;
        this.questions = questions;
        this.reponses = reponses;
        this.clock = clock;
        this.fenetreMois = fenetreMois;
    }

    /** Anonymise tous les contenus plus anciens que la fenêtre de rétention, et renvoie le bilan. */
    @Transactional
    public Resultat purger() {
        Instant seuil = seuil();
        Resultat resultat =
                new Resultat(
                        messages.anonymiserAvant(seuil, COMPTE_ANONYME),
                        salonMessages.anonymiserAvant(seuil, COMPTE_ANONYME),
                        questions.anonymiserAvant(seuil, COMPTE_ANONYME),
                        reponses.anonymiserAvant(seuil, COMPTE_ANONYME));
        if (resultat.total() > 0) {
            log.info(
                    "Purge de rétention social : {} contenu(s) anonymisé(s) avant {} "
                            + "(entraide={}, salons={}, questions={}, réponses={})",
                    resultat.total(),
                    seuil,
                    resultat.messagesEntraide(),
                    resultat.messagesSalon(),
                    resultat.questions(),
                    resultat.reponses());
        } else {
            log.debug("Purge de rétention social : rien à anonymiser avant {}", seuil);
        }
        return resultat;
    }

    /** Instant au-delà duquel (createdAt antérieur) un contenu doit être anonymisé. */
    Instant seuil() {
        return OffsetDateTime.now(clock).minusMonths(fenetreMois).toInstant();
    }

    /** Bilan d'une passe de purge : nombre de lignes anonymisées par table. */
    public record Resultat(int messagesEntraide, int messagesSalon, int questions, int reponses) {
        public int total() {
            return messagesEntraide + messagesSalon + questions + reponses;
        }
    }
}
