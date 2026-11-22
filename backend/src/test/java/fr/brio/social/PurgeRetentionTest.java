package fr.brio.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import fr.brio.social.api.ContenusAnonymises;
import fr.brio.social.infrastructure.FilRepository;
import fr.brio.social.infrastructure.MessageRepository;
import fr.brio.social.infrastructure.QuestionCommunauteRepository;
import fr.brio.social.infrastructure.ReponseCommunauteRepository;
import fr.brio.social.infrastructure.SalonMessageRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.ApplicationEventPublisher;

class PurgeRetentionTest {

    // Frozen clock: 2026-06-15T10:00:00Z.
    private static final Clock HORLOGE =
            Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneOffset.UTC);
    private static final Instant SEUIL_12_MOIS = Instant.parse("2025-06-15T10:00:00Z");
    private static final Instant RATTRAPAGE = Instant.parse("2025-06-08T10:00:00Z");
    private static final UUID ANONYME = PurgeRetention.COMPTE_ANONYME;

    private FilRepository fils;
    private MessageRepository messages;
    private SalonMessageRepository salonMessages;
    private QuestionCommunauteRepository questions;
    private ReponseCommunauteRepository reponses;
    private ApplicationEventPublisher evenements;

    @BeforeEach
    void setUp() {
        fils = mock(FilRepository.class);
        messages = mock(MessageRepository.class);
        salonMessages = mock(SalonMessageRepository.class);
        questions = mock(QuestionCommunauteRepository.class);
        reponses = mock(ReponseCommunauteRepository.class);
        evenements = mock(ApplicationEventPublisher.class);
    }

    private PurgeRetention service(int fenetreMois) {
        return new PurgeRetention(
                fils, messages, salonMessages, questions, reponses, evenements, HORLOGE, fenetreMois);
    }

    @Test
    void shouldPlaceTheThresholdTwelveCalendarMonthsBackInUtc() {
        assertThat(service(12).seuil()).isEqualTo(SEUIL_12_MOIS);
    }

    @Test
    void shouldHonourALongerConfiguredWindow() {
        assertThat(service(24).seuil()).isEqualTo(Instant.parse("2024-06-15T10:00:00Z"));
    }

    @Test
    void shouldClampTheEndOfMonthRatherThanSkipADay() {
        // 2028-02-29 minus 12 months is 2027-02-28: a day kept longer, never a day less.
        Clock bissextile = Clock.fixed(Instant.parse("2028-02-29T02:30:00Z"), ZoneOffset.UTC);
        PurgeRetention purge = new PurgeRetention(
                fils, messages, salonMessages, questions, reponses, evenements, bissextile, 12);

        assertThat(purge.seuil()).isEqualTo(Instant.parse("2027-02-28T02:30:00Z"));
    }

    @ParameterizedTest
    @ValueSource(ints = {Integer.MIN_VALUE, -1, 0, 1, 11})
    void shouldRefuseToStartWithAWindowShorterThanOneYear(int fenetreMois) {
        assertThatThrownBy(() -> service(fenetreMois))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fenetre-mois");
    }

    @Test
    void shouldAnonymiseEveryTableWithTheThresholdAndTheAnonymousAccount() {
        when(fils.anonymiserAvant(SEUIL_12_MOIS, ANONYME)).thenReturn(1);
        when(messages.anonymiserAvant(SEUIL_12_MOIS, ANONYME)).thenReturn(3);
        when(salonMessages.anonymiserAvant(SEUIL_12_MOIS, ANONYME)).thenReturn(2);
        when(questions.anonymiserAvant(SEUIL_12_MOIS, ANONYME)).thenReturn(5);
        when(reponses.anonymiserAvant(SEUIL_12_MOIS, ANONYME)).thenReturn(7);

        PurgeRetention.Resultat resultat = service(12).purger();

        verify(fils).anonymiserAvant(SEUIL_12_MOIS, ANONYME);
        verify(messages).utilesAAnonymiser(SEUIL_12_MOIS, RATTRAPAGE, ANONYME);
        verify(messages).anonymiserAvant(SEUIL_12_MOIS, ANONYME);
        verify(salonMessages).anonymiserAvant(SEUIL_12_MOIS, ANONYME);
        verify(questions).anonymiserAvant(SEUIL_12_MOIS, ANONYME);
        verify(reponses).utilesAAnonymiser(SEUIL_12_MOIS, RATTRAPAGE, ANONYME);
        verify(reponses).anonymiserAvant(SEUIL_12_MOIS, ANONYME);
        verifyNoMoreInteractions(fils, messages, salonMessages, questions, reponses);

        assertThat(resultat)
                .isEqualTo(new PurgeRetention.Resultat(1, 3, 2, 5, 7));
        assertThat(resultat.total()).isEqualTo(18);
    }

    @Test
    void shouldPublishTheIdsOfAnonymisedUsefulContentsSoTheirXpReferenceIsCut() {
        UUID message = UUID.randomUUID();
        UUID reponse = UUID.randomUUID();
        when(messages.utilesAAnonymiser(SEUIL_12_MOIS, RATTRAPAGE, ANONYME)).thenReturn(List.of(message));
        when(reponses.utilesAAnonymiser(SEUIL_12_MOIS, RATTRAPAGE, ANONYME)).thenReturn(List.of(reponse));

        service(12).purger();

        verify(evenements).publishEvent(new ContenusAnonymises(List.of(message, reponse), SEUIL_12_MOIS));
    }

    @Test
    void shouldAnnounceTheThresholdEvenWhenNothingIsAnonymisedSoProgressionCanSweep() {
        assertThat(service(12).purger().total()).isZero();

        verify(evenements).publishEvent(new ContenusAnonymises(List.of(), SEUIL_12_MOIS));
    }

    @Test
    void shouldAnonymiseQuestionsBeforeSelectingTheAnswersThatResolvedThem() {
        // resoudre() locks the question row: updating questions first waits for an in-flight
        // resolution, so the answer selection that follows sees it.
        service(12).purger();

        org.mockito.InOrder ordre = org.mockito.Mockito.inOrder(questions, reponses);
        ordre.verify(questions).anonymiserAvant(SEUIL_12_MOIS, ANONYME);
        ordre.verify(reponses).utilesAAnonymiser(SEUIL_12_MOIS, RATTRAPAGE, ANONYME);
        ordre.verify(reponses).anonymiserAvant(SEUIL_12_MOIS, ANONYME);
    }

    @Test
    void anonymousAccountIsTheNilUuid() {
        assertThat(ANONYME).hasToString("00000000-0000-0000-0000-000000000000");
    }

    @Test
    void shouldScheduleThePurgeByDefaultAndDropTheJobWhenSwitchedOff() {
        PurgeRetention purge = mock(PurgeRetention.class);
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withBean(PurgeRetention.class, () -> purge)
                .withUserConfiguration(PurgeRetentionJob.class);

        runner.run(contexte -> {
            assertThat(contexte).hasSingleBean(PurgeRetentionJob.class);
            contexte.getBean(PurgeRetentionJob.class).purgeProgrammee();
            verify(purge).purger();
        });
        runner.withPropertyValues("brio.social.retention.active=false")
                .run(contexte -> assertThat(contexte).doesNotHaveBean(PurgeRetentionJob.class));
    }
}
