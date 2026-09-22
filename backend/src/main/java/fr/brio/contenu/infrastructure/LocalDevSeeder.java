package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.CoursEditionService;
import fr.brio.contenu.api.CreerBrouillonCommand;
import fr.brio.contenu.api.PublicationResult;
import fr.brio.identite.ClasseService;
import fr.brio.identite.api.CodeClasseCreee;
import fr.brio.identite.api.EleveInscritInfo;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Local-only fixture so a developer can log in and click through the whole authenticated app —
 * including a published teacher course (there is no authoring UI yet, F3/#123). Runs after the
 * referential (@Order 1) and catalogue (@Order 2) seeders so exercise competencies validate at
 * publish time. Idempotent: keyed on {@link #DEMO_AUTEUR_ID}, it seeds once and re-logs nothing
 * it can't recover. Never active outside the {@code local} profile, so production is untouched.
 *
 * Lives in contenu (which already depends on identite) — not identite — to avoid a module cycle:
 * it creates the student through identite's public {@link ClasseService} and the course through
 * contenu's own {@link CoursEditionService}.
 */
@Component
@Profile("local")
@Order(3)
class LocalDevSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LocalDevSeeder.class);

    // Fake teacher id (auteur_id has no FK to identite — ADR 0007). Doubles as the idempotency key.
    private static final UUID DEMO_AUTEUR_ID = UUID.fromString("d0000000-0000-0000-0000-00000000da7a");
    private static final String DEMO_PASSWORD = "demodemo";

    private final ClasseService classeService;
    private final CoursEditionService coursEditionService;
    private final CoursRepository coursRepository;
    private final ObjectMapper objectMapper;

    LocalDevSeeder(
            ClasseService classeService,
            CoursEditionService coursEditionService,
            CoursRepository coursRepository,
            ObjectMapper objectMapper) {
        this.classeService = classeService;
        this.coursEditionService = coursEditionService;
        this.coursRepository = coursRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<?> existing = coursRepository.findByAuteurId(DEMO_AUTEUR_ID);
        if (!existing.isEmpty()) {
            log.info("Dev demo already seeded — student login: eleve.demo* / {} (see first-seed log for the exact identifiant, or reset the DB)", DEMO_PASSWORD);
            return;
        }
        try {
            var etab = classeService.creerEtablissement(
                    "Collège Démo", null, "college", LocalDate.now().minusYears(1), "CONV-DEMO");
            var classe = classeService.creerClasse(etab.id(), "3e", "3e Démo", "2025-2026");
            CodeClasseCreee code = classeService.genererCode(classe.id(), DEMO_AUTEUR_ID, 60, 1000);
            EleveInscritInfo eleve = classeService.rejoindreParCode(code.code(), DEMO_PASSWORD, "Élève Démo");

            UUID coursId = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                    DEMO_AUTEUR_ID, etab.id(), "Cours de démonstration",
                    "3e", "mathematiques", demoContent()));
            coursEditionService.definirPortees(coursId, Set.of(classe.id()));
            PublicationResult published = coursEditionService.publier(coursId);

            log.info("""

                    ============================ DEV DEMO SEEDED ============================
                     Student login  ->  identifiant: {}   password: {}
                     Teacher course ->  /cours/{}  (v{}, scoped to classe {})
                    ========================================================================""",
                    eleve.identifiantConnexion(), DEMO_PASSWORD,
                    coursId, published.version(), classe.id());
        } catch (Exception e) {
            log.error("Dev demo seeding failed: {} — app starts without it", e.getMessage(), e);
        }
    }

    private JsonNode demoContent() throws Exception {
        return objectMapper.readTree("""
                {
                  "schemaVersion": 1,
                  "id": "cours-demo",
                  "title": "Cours de démonstration",
                  "sections": [
                    { "id": "s1", "title": "Le théorème de Pythagore", "kind": "lesson", "blocks": [
                      { "id": "p1", "type": "prose",
                        "text": "Dans un **triangle rectangle**, le carré de l'hypoténuse est égal à la somme des carrés des deux autres côtés." },
                      { "id": "f1", "type": "formula", "latex": "BC^2 = AB^2 + AC^2", "display": "block" },
                      { "id": "c1", "type": "callout", "variant": "definition",
                        "text": "L'hypoténuse est le côté opposé à l'angle droit — le plus grand des trois." },
                      { "id": "ex-num", "type": "exercise", "exerciseType": "numeric",
                        "prompt": "Un triangle rectangle a deux côtés de l'angle droit de 3 cm et 4 cm. Quelle est la longueur de l'hypoténuse ?",
                        "competencies": ["c4.geo.pythagore.calculer"], "unit": "cm",
                        "answer": 5, "tolerance": 0.01 },
                      { "id": "ex-qcm", "type": "exercise", "exerciseType": "multiple-choice",
                        "prompt": "Dans le triangle RST rectangle en S, quel côté est l'hypoténuse ?",
                        "competencies": ["c4.geo.pythagore.calculer"], "multiple": false,
                        "choices": [
                          { "id": "a", "text": "Le côté [RS]", "correct": false },
                          { "id": "b", "text": "Le côté [RT]", "correct": true },
                          { "id": "c", "text": "Le côté [ST]", "correct": false }
                        ] }
                    ] }
                  ]
                }
                """);
    }
}
