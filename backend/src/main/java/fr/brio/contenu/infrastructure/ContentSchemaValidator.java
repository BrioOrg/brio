package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import fr.brio.contenu.ContentViolation;
import fr.brio.contenu.InvalidContentException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class ContentSchemaValidator {

    // "$.sections[0].blocks[2].choices[0].text" → section 0, block 2, field "choices[0].text".
    private static final Pattern INSTANCE = Pattern.compile(
            "^\\$(?:\\.sections\\[(\\d+)](?:\\.blocks\\[(\\d+)])?)?(?:\\.(.+))?$");
    // The block union branch a message was produced under: "…blocks.items.$ref.oneOf[7]…".
    private static final Pattern BRANCH = Pattern.compile("\\.blocks\\.items\\.\\$ref\\.oneOf\\[(\\d+)]");

    private final JsonSchema schema;
    /** Block {@code type} → index of its branch in {@code $defs/block/oneOf}. */
    private final Map<String, Integer> branchByType;

    public ContentSchemaValidator() {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        try (InputStream is = getClass().getResourceAsStream("/contenu/course-content.schema.json")) {
            if (is == null) {
                throw new IllegalStateException("course-content.schema.json not found on classpath");
            }
            JsonNode tree = new ObjectMapper().readTree(is);
            this.schema = factory.getSchema(tree);
            this.branchByType = branchesByType(tree);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load content schema", e);
        }
    }

    public void validate(JsonNode document) {
        Set<ValidationMessage> errors = schema.validate(document);
        if (errors.isEmpty()) {
            return;
        }
        List<ValidationMessage> relevant = errors.stream()
                .filter(error -> isRelevant(error, document))
                .toList();
        // Every message belonged to a branch we discarded: keep them all rather than hide the failure.
        List<ValidationMessage> reported = relevant.isEmpty() ? List.copyOf(errors) : relevant;

        Set<ContentViolation> violations = new LinkedHashSet<>();
        for (ValidationMessage error : reported) {
            violations.add(toViolation(error, document));
        }
        String details = reported.stream()
                .map(ValidationMessage::getMessage)
                .collect(Collectors.joining("; "));
        throw new InvalidContentException(
                "Content does not conform to schema: " + details, new ArrayList<>(violations));
    }

    /**
     * The block union is a {@code oneOf}: a single faulty block yields a message from every
     * branch ("not a heading", "not a formula"…). Only the branch matching the block's own
     * {@code type} explains what the author has to fix; the aggregate oneOf message adds nothing.
     */
    private boolean isRelevant(ValidationMessage error, JsonNode document) {
        if ("oneOf".equals(error.getType()) && error.getEvaluationPath().toString().endsWith("blocks.items.$ref.oneOf")) {
            return false;
        }
        Matcher branch = BRANCH.matcher(error.getEvaluationPath().toString());
        if (!branch.find()) {
            return true;
        }
        Matcher instance = INSTANCE.matcher(error.getInstanceLocation().toString());
        if (!instance.matches() || instance.group(2) == null) {
            return true;
        }
        JsonNode block = document.path("sections").path(Integer.parseInt(instance.group(1)))
                .path("blocks").path(Integer.parseInt(instance.group(2)));
        Integer expected = branchByType.get(block.path("type").asText());
        return expected != null && expected == Integer.parseInt(branch.group(1));
    }

    private ContentViolation toViolation(ValidationMessage error, JsonNode document) {
        Matcher instance = INSTANCE.matcher(error.getInstanceLocation().toString());
        String sectionId = null;
        String blockId = null;
        String field = null;
        if (instance.matches()) {
            JsonNode section = null;
            if (instance.group(1) != null) {
                section = document.path("sections").path(Integer.parseInt(instance.group(1)));
                sectionId = section.path("id").asText(null);
            }
            if (section != null && instance.group(2) != null) {
                blockId = section.path("blocks").path(Integer.parseInt(instance.group(2))).path("id").asText(null);
            }
            field = instance.group(3);
        }
        // "required" and "additionalProperties" are reported on the parent object; the property
        // they are about is the field to fix.
        if (error.getProperty() != null) {
            field = field == null ? error.getProperty() : field + "." + error.getProperty();
        }
        return new ContentViolation(codeFor(error.getType()), sectionId, blockId, field);
    }

    private static String codeFor(String keyword) {
        return switch (keyword) {
            case "required" -> ContentViolation.REQUIRED;
            case "minLength", "minItems" -> ContentViolation.EMPTY;
            default -> ContentViolation.INVALID_FORMAT;
        };
    }

    private static Map<String, Integer> branchesByType(JsonNode schemaTree) {
        Map<String, Integer> byType = new HashMap<>();
        JsonNode defs = schemaTree.path("$defs");
        JsonNode branches = defs.path("block").path("oneOf");
        for (int i = 0; i < branches.size(); i++) {
            String ref = branches.get(i).path("$ref").asText();
            String def = ref.substring(ref.lastIndexOf('/') + 1);
            JsonNode type = defs.path(def).path("properties").path("type").path("const");
            if (type.isTextual()) {
                byType.put(type.asText(), i);
            }
        }
        return byType;
    }
}
