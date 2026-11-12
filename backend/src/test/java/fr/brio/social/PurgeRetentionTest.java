package fr.brio.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import fr.brio.social.infrastructure.MessageRepository;
import fr.brio.social.infrastructure.QuestionCommunauteRepository;
import fr.brio.social.infrastructure.ReponseCommunauteRepository;
import fr.brio.social.infrastructure.SalonMessageRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PurgeRetentionTest {

    // Horloge figée : 2026-06-15T10:00:00Z.
    private static final Clock HORLOGE =
            Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneOffset.UTC);

    private MessageRepository messages;
    private SalonMessageRepository salonMessages;
    private QuestionCommunauteRepository questions;
    private ReponseCommunauteRepository reponses;

    @BeforeEach
    void setUp() {
        messages = mock(MessageRepository.class);
        salonMessages = mock(SalonMessageRepository.class);
        questions = mock(QuestionCommunauteRepository.class);
        reponses = mock(ReponseCommunauteRepository.class);
    }

    private PurgeRetention service(int fenetreMois) {
        return new PurgeRetention(messages, salonMessages, questions, reponses, HORLOGE, fenetreMois);
    }

    @Test
    void seuilEstMaintenantMoinsLaFenetreEnMois() {
        Instant attendu = OffsetDateTime.parse("2025-06-15T10:00:00Z").toInstant();

        assertThat(service(12).seuil()).isEqualTo(attendu);
    }

    @Test
    void fenetreConfigurableChangeLeSeuil() {
        // 6 mois au lieu de 12.
        assertThat(service(6).seuil())
                .isEqualTo(OffsetDateTime.parse("2025-12-15T10:00:00Z").toInstant());
    }

    @Test
    void anonymiseChaqueTableAvecLeSeuilEtLeCompteAnonyme() {
        Instant seuil = OffsetDateTime.parse("2025-06-15T10:00:00Z").toInstant();
        when(messages.anonymiserAvant(seuil, PurgeRetention.COMPTE_ANONYME)).thenReturn(3);
        when(salonMessages.anonymiserAvant(seuil, PurgeRetention.COMPTE_ANONYME)).thenReturn(2);
        when(questions.anonymiserAvant(seuil, PurgeRetention.COMPTE_ANONYME)).thenReturn(5);
        when(reponses.anonymiserAvant(seuil, PurgeRetention.COMPTE_ANONYME)).thenReturn(7);

        PurgeRetention.Resultat resultat = service(12).purger();

        verify(messages).anonymiserAvant(seuil, PurgeRetention.COMPTE_ANONYME);
        verify(salonMessages).anonymiserAvant(seuil, PurgeRetention.COMPTE_ANONYME);
        verify(questions).anonymiserAvant(seuil, PurgeRetention.COMPTE_ANONYME);
        verify(reponses).anonymiserAvant(seuil, PurgeRetention.COMPTE_ANONYME);
        verifyNoMoreInteractions(messages, salonMessages, questions, reponses);

        assertThat(resultat.messagesEntraide()).isEqualTo(3);
        assertThat(resultat.messagesSalon()).isEqualTo(2);
        assertThat(resultat.questions()).isEqualTo(5);
        assertThat(resultat.reponses()).isEqualTo(7);
        assertThat(resultat.total()).isEqualTo(17);
    }

    @Test
    void compteAnonymeEstLUuidNul() {
        assertThat(PurgeRetention.COMPTE_ANONYME).hasToString("00000000-0000-0000-0000-000000000000");
    }

    @Test
    void sansRienAPurgerLeTotalEstZero() {
        when(messages.anonymiserAvant(HORLOGE.instant(), PurgeRetention.COMPTE_ANONYME)).thenReturn(0);
        // Les mocks renvoient 0 par défaut.

        assertThat(service(12).purger().total()).isZero();
    }
}
