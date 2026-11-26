package fr.brio.exercices.rediges;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.exercices.domain.PolynomialFormula;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
class CatalogueExercicesRediges {
    private final Map<UUID, ExerciceRedige> exercices;

    CatalogueExercicesRediges(ObjectMapper mapper) throws IOException {
        var resource = new ClassPathResource("exercices-rediges/catalogue.json");
        var definitions = new HashMap<UUID, ExerciceRedige>();
        try (var input = resource.getInputStream()) {
            List<LigneCatalogue> lines = mapper.readValue(input, new TypeReference<>() {});
            for (LigneCatalogue line : lines) {
                ExerciceRedige definition = line.definition();
                if (definitions.putIfAbsent(definition.id(), definition) != null) {
                    throw new IllegalStateException("Duplicate written exercise ID: " + definition.id());
                }
            }
        }
        this.exercices = Map.copyOf(definitions);
    }

    Optional<ExerciceRedige> trouver(UUID id) {
        return Optional.ofNullable(exercices.get(id));
    }

    List<ExerciceRedige> pourLecon(String niveau, String matiere, String slug) {
        return exercices.values().stream()
                .filter(e -> e.niveau().equals(niveau) && e.matiere().equals(matiere) && e.slug().equals(slug))
                .sorted(java.util.Comparator.comparing(ExerciceRedige::titre).thenComparing(ExerciceRedige::id))
                .toList();
    }

    private record LigneCatalogue(
            UUID id,
            int version,
            String niveau,
            String matiere,
            String slug,
            String titre,
            String enonce,
            String reponseAttendue,
            String corrige) {

        ExerciceRedige definition() {
            if (id == null || version <= 0 || absent(niveau) || absent(matiere) || absent(slug)
                    || absent(titre) || titre.length() > 160 || absent(enonce) || enonce.length() > 8_000
                    || absent(corrige) || corrige.length() > 8_000 || absent(reponseAttendue)) {
                throw new IllegalStateException("Incomplete catalogue written exercise: " + id);
            }
            PolynomialFormula.parse(reponseAttendue);
            return new ExerciceRedige(id, version, null, null, niveau, matiere, slug, titre, enonce,
                    reponseAttendue, corrige, null, null, null);
        }

        private static boolean absent(String value) {
            return value == null || value.isBlank();
        }
    }
}
