package fr.brio.ia.infrastructure;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.ia.domain.TuteurModelResponse;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Thin HTTP wrapper around the Anthropic Messages API.
 * Forces the repondre tool on every call; callers receive a parsed
 * TuteurModelResponse directly.
 */
@Component
public class AnthropicClient {

    private static final String MESSAGES_PATH = "/v1/messages";
    private static final int MAX_TOKENS = 1024;

    private final RestClient restClient;
    private final AnthropicProperties properties;
    private final ObjectMapper objectMapper;

    public AnthropicClient(AnthropicProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .defaultHeader("x-api-key", properties.getApiKey())
                .defaultHeader("anthropic-version", "2023-06-01")
                .defaultHeader("anthropic-beta", "prompt-caching-2024-07-31")
                .build();
    }

    public TuteurModelResponse ask(String systemPrompt, String chapterContext, String userContent) {
        MessagesRequest request = buildRequest(systemPrompt, chapterContext, userContent);
        String responseBody = restClient.post()
                .uri(MESSAGES_PATH)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(String.class);
        return parseResponse(responseBody);
    }

    private MessagesRequest buildRequest(String systemPrompt, String chapterContext, String userContent) {
        List<SystemBlock> system = List.of(
                new SystemBlock("text", systemPrompt, new CacheControl("ephemeral")));

        List<ContentBlock> userBlocks = List.of(
                new ContentBlock("text", chapterContext, new CacheControl("ephemeral")),
                new ContentBlock("text", userContent, null));

        return new MessagesRequest(
                properties.getModel(),
                MAX_TOKENS,
                system,
                List.of(buildRepondreTool()),
                new ToolChoice("tool", "repondre"),
                List.of(new MessageBlock("user", userBlocks)));
    }

    private TuteurModelResponse parseResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            for (JsonNode part : root.path("content")) {
                if ("tool_use".equals(part.path("type").asText())
                        && "repondre".equals(part.path("name").asText())) {
                    return objectMapper.treeToValue(part.path("input"), TuteurModelResponse.class);
                }
            }
            throw new IllegalStateException("Anthropic response contained no repondre tool_use block");
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse Anthropic response: " + e.getMessage(), e);
        }
    }

    private ToolDefinition buildRepondreTool() {
        Map<String, Object> repondableSchema = Map.of(
                "type", "boolean",
                "description", "true si la question est répondable à partir du contenu du chapitre, false sinon");
        Map<String, Object> reponseSchema = Map.of(
                "type", "string",
                "description", "Réponse pédagogique à la question de l'étudiant");
        Map<String, Object> citationsSchema = Map.of(
                "type", "array",
                "items", Map.of("type", "string"),
                "description", "Liste des blocs cités, chacun au format sectionId/blockId");

        InputSchema inputSchema = new InputSchema(
                "object",
                Map.of("repondable", repondableSchema, "reponse", reponseSchema, "citations", citationsSchema),
                List.of("repondable", "reponse", "citations"));

        return new ToolDefinition(
                "repondre",
                "Fournit une réponse structurée à la question de l'étudiant à partir du contenu du chapitre.",
                inputSchema);
    }

    // ── Request record types ────────────────────────────────────────────────

    record MessagesRequest(
            String model,
            @JsonProperty("max_tokens") int maxTokens,
            List<SystemBlock> system,
            List<ToolDefinition> tools,
            @JsonProperty("tool_choice") ToolChoice toolChoice,
            List<MessageBlock> messages) {}

    record SystemBlock(
            String type,
            String text,
            @JsonProperty("cache_control") CacheControl cacheControl) {}

    record CacheControl(String type) {}

    record ToolDefinition(
            String name,
            String description,
            @JsonProperty("input_schema") InputSchema inputSchema) {}

    record InputSchema(
            String type,
            Map<String, Object> properties,
            List<String> required) {}

    record ToolChoice(String type, String name) {}

    record MessageBlock(String role, List<ContentBlock> content) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record ContentBlock(
            String type,
            String text,
            @JsonProperty("cache_control") CacheControl cacheControl) {}
}
