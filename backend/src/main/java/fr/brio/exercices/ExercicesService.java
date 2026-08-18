package fr.brio.exercices;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.ExerciceContentApi;
import fr.brio.contenu.api.ExerciceDefinition;
import fr.brio.exercices.domain.EvaluationResult;
import fr.brio.exercices.domain.Soumission;
import fr.brio.exercices.infrastructure.EvaluatorDispatcher;
import fr.brio.exercices.infrastructure.SoumissionRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExercicesService {

    private final ExerciceContentApi exerciceContentApi;
    private final EvaluatorDispatcher dispatcher;
    private final SoumissionRepository soumissionRepository;
    private final ObjectMapper objectMapper;

    ExercicesService(
            ExerciceContentApi exerciceContentApi,
            EvaluatorDispatcher dispatcher,
            SoumissionRepository soumissionRepository,
            ObjectMapper objectMapper) {
        this.exerciceContentApi = exerciceContentApi;
        this.dispatcher = dispatcher;
        this.soumissionRepository = soumissionRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public SoumissionResult soumettre(UUID exerciceId, JsonNode answer) {
        String studentRef = resolveStudentRef();

        ExerciceDefinition definition = exerciceContentApi.findById(exerciceId)
                .orElseThrow(() -> new ExerciceNotFoundException(exerciceId));

        EvaluationResult result = dispatcher.dispatch(definition.type(), definition.evaluationJson(), answer);

        Soumission soumission = persist(exerciceId, studentRef, answer, result, definition);

        return new SoumissionResult(soumission.getId(), result);
    }

    private String resolveStudentRef() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() == null) {
            throw new NotAuthenticatedException();
        }
        return auth.getName();
    }

    private Soumission persist(
            UUID exerciceId,
            String studentRef,
            JsonNode answer,
            EvaluationResult result,
            ExerciceDefinition definition) {
        try {
            String answerJson = objectMapper.writeValueAsString(answer);
            String feedbackJson = objectMapper.writeValueAsString(result);
            return soumissionRepository.save(new Soumission(
                    exerciceId,
                    studentRef,
                    answerJson,
                    result.correct(),
                    result.score(),
                    feedbackJson,
                    definition.competencies(),
                    Instant.now()));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to persist submission for exercise " + exerciceId, e);
        }
    }

    public Optional<Soumission> findById(UUID id) {
        return soumissionRepository.findById(id);
    }
}
