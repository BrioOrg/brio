package fr.brio.ia.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.ChapitreContentApi;
import fr.brio.contenu.api.ChapitreDocument;
import fr.brio.contenu.api.ExerciceContentApi;
import fr.brio.contenu.api.ExerciceDefinition;
import fr.brio.contenu.api.ExerciseBlock;
import fr.brio.ia.infrastructure.AnthropicClient;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class TuteurService {

    public static final String REFUSAL_MESSAGE =
            "Je ne peux pas répondre à cette question à partir du contenu de ce chapitre.";
    public static final String GENERIC_HINT =
            "Je peux t'aider à comprendre ce concept. Relis le chapitre et essaie de reformuler la question.";

    private static final double EPSILON_FLOOR = 1e-9;
    private static final Pattern NUMBER_PATTERN =
            Pattern.compile("(?<![\\w,])(-?\\d+(?:[.,]\\d+)?)(?![\\w])");

    private final AnthropicClient anthropicClient;
    private final ChapitreContentApi chapitreContentApi;
    private final ExerciceContentApi exerciceContentApi;
    private final ObjectMapper objectMapper;
    private final String systemPrompt;

    public TuteurService(
            AnthropicClient anthropicClient,
            ChapitreContentApi chapitreContentApi,
            ExerciceContentApi exerciceContentApi,
            ObjectMapper objectMapper) {
        this.anthropicClient = anthropicClient;
        this.chapitreContentApi = chapitreContentApi;
        this.exerciceContentApi = exerciceContentApi;
        this.objectMapper = objectMapper;
        this.systemPrompt = loadSystemPrompt();
    }

    public TuteurResult ask(String niveau, String matiere, String slug, String question, UUID exerciceId) {
        ChapitreDocument doc = chapitreContentApi.findByTriplet(niveau, matiere, slug)
                .orElseThrow(() -> new ChapitreNotFoundException(niveau, matiere, slug));

        String chapterContext = buildChapterContext(doc);
        String userContent = buildUserContent(question, exerciceId, doc);

        TuteurModelResponse response = anthropicClient.ask(systemPrompt, chapterContext, userContent);

        // Gate 1: model says it cannot answer
        if (!response.repondable()) {
            return new TuteurResult(REFUSAL_MESSAGE, List.of());
        }

        // Gate 3: empty citation list
        if (response.citations() == null || response.citations().isEmpty()) {
            return new TuteurResult(REFUSAL_MESSAGE, List.of());
        }

        // Gate 2: invalid citations — one regeneration attempt
        if (!allCitationsValid(response.citations(), doc)) {
            String hardenedContent = userContent
                    + "\n\nAttention : ta réponse précédente contenait des citations invalides."
                    + " Ne cite que des blocs présents dans le chapitre, au format sectionId/blockId.";
            response = anthropicClient.ask(systemPrompt, chapterContext, hardenedContent);
            if (!response.repondable() || response.citations() == null
                    || response.citations().isEmpty()
                    || !allCitationsValid(response.citations(), doc)) {
                return new TuteurResult(REFUSAL_MESSAGE, List.of());
            }
        }

        // Gate 4: disclosure filter (only when an exercise is active)
        if (exerciceId != null) {
            Optional<ExerciceDefinition> def = exerciceContentApi.findById(exerciceId);
            if (def.isPresent() && disclosesAnswer(response.reponse(), def.get())) {
                String hardenedContent = userContent
                        + "\n\nAttention : ta réponse précédente divulguait la réponse de l'exercice."
                        + " Guide l'élève par des questions sans jamais donner le résultat ni la computation.";
                response = anthropicClient.ask(systemPrompt, chapterContext, hardenedContent);
                if (def.isPresent() && disclosesAnswer(response.reponse(), def.get())) {
                    return new TuteurResult(GENERIC_HINT, List.of());
                }
            }
        }

        return new TuteurResult(response.reponse(), response.citations());
    }

    private String buildChapterContext(ChapitreDocument doc) {
        StringBuilder sb = new StringBuilder("<CHAPITRE>\n");
        for (var section : doc.sections()) {
            for (var block : section.blocks()) {
                sb.append("[section:").append(section.id())
                        .append(" block:").append(block.id()).append("] ");
                switch (block) {
                    case ExerciseBlock ex -> sb.append("(exercice) ").append(ex.prompt());
                    case fr.brio.contenu.api.TextBlock tb -> sb.append(tb.text());
                }
                sb.append('\n');
            }
        }
        sb.append("</CHAPITRE>");
        return sb.toString();
    }

    private String buildUserContent(String question, UUID exerciceId, ChapitreDocument doc) {
        StringBuilder sb = new StringBuilder();
        if (exerciceId != null) {
            findExerciseBlock(doc, exerciceId).ifPresent(ex ->
                    sb.append("<EXERCICE_EN_COURS>").append(ex.prompt()).append("</EXERCICE_EN_COURS>\n")
                            .append("Guide l'élève sur cet exercice par des questions et des pistes.")
                            .append(" Ne donne jamais le résultat final ni la computation complète.\n\n"));
        }
        sb.append("<QUESTION>").append(question).append("</QUESTION>");
        return sb.toString();
    }

    private Optional<ExerciseBlock> findExerciseBlock(ChapitreDocument doc, UUID exerciceId) {
        return doc.sections().stream()
                .flatMap(s -> s.blocks().stream())
                .filter(b -> b instanceof ExerciseBlock)
                .map(b -> (ExerciseBlock) b)
                .filter(b -> exerciceId.equals(b.exerciceId()))
                .findFirst();
    }

    private boolean allCitationsValid(List<String> citations, ChapitreDocument doc) {
        return citations.stream().allMatch(c -> doc.findBlock(c).isPresent());
    }

    boolean disclosesAnswer(String reponse, ExerciceDefinition def) {
        try {
            JsonNode eval = objectMapper.readTree(def.evaluationJson());
            String type = def.type();

            if ("numeric".equals(type)) {
                JsonNode answerNode = eval.path("answer");
                if (answerNode.isMissingNode()) return false;
                double expected = Double.parseDouble(answerNode.asText());
                double tolerance = eval.path("tolerance").asDouble(0.0);
                return containsNumericAnswer(reponse, expected, tolerance);
            }

            if ("multiple-choice".equals(type)) {
                for (JsonNode choice : eval.path("choices")) {
                    if (choice.path("correct").asBoolean(false)) {
                        String correctText = choice.path("text").asText("");
                        if (!correctText.isBlank()
                                && reponse.toLowerCase().contains(correctText.toLowerCase())) {
                            return true;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // Malformed evaluation JSON — fail open (don't block the response)
        }
        return false;
    }

    private boolean containsNumericAnswer(String reponse, double expected, double tolerance) {
        double effective = Math.max(tolerance, EPSILON_FLOOR);
        Matcher m = NUMBER_PATTERN.matcher(reponse);
        while (m.find()) {
            try {
                double value = Double.parseDouble(m.group(1).replace(',', '.'));
                if (Math.abs(value - expected) <= effective) {
                    return true;
                }
            } catch (NumberFormatException ignored) {}
        }
        return false;
    }

    private String loadSystemPrompt() {
        try (InputStream is = new ClassPathResource("ia/system-prompt-v1.txt").getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot load ia/system-prompt-v1.txt", e);
        }
    }
}
