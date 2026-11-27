package fr.brio.exercices.rediges;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.brio.contenu.api.ChapitreContentApi;
import fr.brio.contenu.api.CoursAccesApi;
import org.springframework.context.ApplicationEventPublisher;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class ExercicesRedigesServiceTest {
    @Test
    void earlyClosureRemainsImmediateWhenPostgresRoundsTimestamps() {
        var now = Instant.parse("2026-11-27T09:00:00.123456789Z");
        var id = UUID.randomUUID();
        var courseId = UUID.randomUUID();
        var authorId = UUID.randomUUID();
        var deadline = now.plusSeconds(3_600);
        var courses = mock(CoursAccesApi.class);
        var repository = mock(ExercicesRedigesRepository.class);
        var persistedClosure = new AtomicReference<Instant>();

        when(courses.estAuteur(courseId, authorId)).thenReturn(true);
        when(repository.verrouiller(id)).thenReturn(Optional.of(new ExerciceRedige(id, 1, courseId, authorId,
                null, null, null, "Dérivée", "Calcule la dérivée.", "2x", "La dérivée vaut $2x$.",
                ExerciceRedige.ModeCorrection.automatique, false, null, deadline, now.minusSeconds(60), null, null)));
        doAnswer(invocation -> {
            Instant written = invocation.getArgument(1);
            persistedClosure.set(written.plusNanos(500).truncatedTo(ChronoUnit.MICROS));
            return null;
        }).when(repository).cloturer(eq(id), any(Instant.class));
        when(repository.trouver(id)).thenAnswer(invocation -> Optional.of(new ExerciceRedige(id, 1, courseId, authorId,
                null, null, null, "Dérivée", "Calcule la dérivée.", "2x", "La dérivée vaut $2x$.",
                ExerciceRedige.ModeCorrection.automatique, false, null, deadline, now.minusSeconds(60),
                persistedClosure.get(), null)));
        var service = new ExercicesRedigesService(courses, mock(ChapitreContentApi.class),
                mock(CatalogueExercicesRediges.class), repository, Clock.fixed(now, ZoneOffset.UTC),
                mock(RetourExerciceApi.class), mock(ApplicationEventPublisher.class));

        var result = service.cloturer(id, authorId);

        assertThat(result.cloture()).isTrue();
        assertThat(result.echeance()).isEqualTo(now.truncatedTo(ChronoUnit.MICROS));
    }
}
