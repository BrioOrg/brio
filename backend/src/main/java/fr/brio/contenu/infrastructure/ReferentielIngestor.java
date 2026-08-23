package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import fr.brio.contenu.domain.Competence;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

// Runs in every profile before chapter ingestion (@Order(2)) so that competency
// validation in ChapitreIngestionTx always has a populated referential to check against.
// A missing or invalid referential fails startup: better no boot than a database that
// silently accepts codes outside the official curriculum.
@Component
@Order(1)
class ReferentielIngestor implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ReferentielIngestor.class);
    private static final String SCHEMA_FILE = "/contenu/referentiel/competency.schema.json";
    private static final String REFERENTIEL_FILE = "/contenu/referentiel/mathematiques-college.json";

    private final CompetenceRepository competenceRepository;
    private final ObjectMapper objectMapper;

    ReferentielIngestor(CompetenceRepository competenceRepository, ObjectMapper objectMapper) {
        this.competenceRepository = competenceRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        JsonNode referentiel = readClasspathJson(REFERENTIEL_FILE);
        validateAgainstSchema(referentiel);

        int created = 0;
        int updated = 0;
        List<Competence> toSave = new ArrayList<>();
        for (JsonNode entry : referentiel.get("competences")) {
            String code = entry.get("code").asText();
            String intitule = entry.get("intitule").asText();
            int cycle = entry.get("cycle").asInt();
            String domaine = entry.get("domaine").asText();
            String referenceOfficielle = entry.get("referenceOfficielle").asText();

            List<String> niveaux = new ArrayList<>();
            entry.get("niveaux").forEach(n -> niveaux.add(n.asText()));

            String deprecatedSince = entry.has("deprecatedSince")
                    ? entry.get("deprecatedSince").asText() : null;
            List<String> remplacePar = null;
            if (entry.has("remplacePar")) {
                remplacePar = new ArrayList<>();
                for (JsonNode c : entry.get("remplacePar")) remplacePar.add(c.asText());
            }

            Competence competence = competenceRepository.findById(code).orElse(null);
            if (competence == null) {
                competence = new Competence(code, intitule, cycle, niveaux, domaine, referenceOfficielle);
                created++;
            } else {
                updated++;
            }
            competence.update(intitule, cycle, niveaux, domaine, referenceOfficielle, deprecatedSince, remplacePar);
            toSave.add(competence);
        }
        competenceRepository.saveAll(toSave);
        log.info("Competency referential ingested: {} created, {} updated", created, updated);
    }

    private JsonNode readClasspathJson(String path) throws Exception {
        try (InputStream is = getClass().getResourceAsStream(path)) {
            if (is == null) {
                throw new IllegalStateException(path + " not found on classpath — "
                        + "the Maven build copies it from content/referentiel/ and docs/schema/");
            }
            return objectMapper.readTree(is);
        }
    }

    private void validateAgainstSchema(JsonNode referentiel) throws Exception {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        JsonSchema schema;
        try (InputStream is = getClass().getResourceAsStream(SCHEMA_FILE)) {
            if (is == null) {
                throw new IllegalStateException(SCHEMA_FILE + " not found on classpath");
            }
            schema = factory.getSchema(is);
        }
        Set<ValidationMessage> errors = schema.validate(referentiel);
        if (!errors.isEmpty()) {
            String details = errors.stream()
                    .map(ValidationMessage::getMessage)
                    .collect(Collectors.joining("; "));
            throw new IllegalStateException("Competency referential does not conform to schema: " + details);
        }
    }
}
