package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import fr.brio.contenu.InvalidContentException;
import java.io.InputStream;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class ContentSchemaValidator {

    private final JsonSchema schema;

    public ContentSchemaValidator() {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        try (InputStream is = getClass().getResourceAsStream("/contenu/course-content.schema.json")) {
            if (is == null) {
                throw new IllegalStateException("course-content.schema.json not found on classpath");
            }
            this.schema = factory.getSchema(is);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load content schema", e);
        }
    }

    public void validate(JsonNode document) {
        Set<ValidationMessage> errors = schema.validate(document);
        if (!errors.isEmpty()) {
            String details = errors.stream()
                    .map(ValidationMessage::getMessage)
                    .collect(Collectors.joining("; "));
            throw new InvalidContentException("Content does not conform to schema: " + details);
        }
    }
}
