package fr.brio.exercices.rediges;

import fr.brio.contenu.api.ChapitreContentApi;
import fr.brio.contenu.api.CoursAccesApi;
import fr.brio.exercices.domain.PolynomialFormula;
import fr.brio.exercices.domain.PolynomialFormula.FormulaException;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.CopieExerciceRedige;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.EcritureExerciceRedige;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.ExerciceRedigeEleve;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.ExerciceRedigeProf;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.ExerciceRedigeResume;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.RemiseExerciceRedige;
import fr.brio.exercices.rediges.ExercicesRedigesRepository.Copie;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ExercicesRedigesService {
    private final CoursAccesApi cours;
    private final ChapitreContentApi chapitres;
    private final CatalogueExercicesRediges catalogue;
    private final ExercicesRedigesRepository repository;
    private final Clock clock;

    ExercicesRedigesService(CoursAccesApi cours, ChapitreContentApi chapitres,
            CatalogueExercicesRediges catalogue, ExercicesRedigesRepository repository, Clock clock) {
        this.cours = cours;
        this.chapitres = chapitres;
        this.catalogue = catalogue;
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ExerciceRedigeResume> listerEleve(UUID eleveId, UUID coursId, String niveau, String matiere, String slug) {
        List<ExerciceRedige> definitions;
        if (coursId != null && niveau == null && matiere == null && slug == null) {
            verifierAccesCours(eleveId, coursId);
            definitions = repository.pourCours(coursId);
        } else if (coursId == null && identifiantValide(niveau) && identifiantValide(matiere) && identifiantValide(slug)) {
            verifierChapitre(niveau, matiere, slug);
            definitions = catalogue.pourLecon(niveau, matiere, slug);
        } else {
            throw new ExerciceRedigeException(HttpStatus.BAD_REQUEST, "LECON_INVALIDE", "Choisis une leçon.");
        }
        return definitions.stream().map(e -> new ExerciceRedigeResume(e.id(), e.titre())).toList();
    }

    @Transactional(readOnly = true)
    public ExerciceRedigeEleve lire(UUID id, UUID eleveId) {
        var definition = verifierAcces(definition(id, false), eleveId);
        return vueEleve(definition, repository.copie(id, eleveId).orElse(null), clock.instant());
    }

    @Transactional
    public ExerciceRedigeEleve soumettre(UUID id, UUID eleveId, RemiseExerciceRedige remise) {
        // For teacher definitions both clock acceptance and the write happen under the same lock
        // as early closure, so a submission and a closure cannot be observed out of order.
        var definition = verifierAcces(definition(id, true), eleveId);
        Instant now = clock.instant();
        Optional<Copie> saved = repository.copie(id, eleveId);
        if (saved.isPresent()) {
            return vueEleve(definition, saved.get(), now);
        }
        if (remise.version() != definition.version()) {
            throw conflit("VERSION_OBSOLETE", "L’exercice a changé. Recharge la page.");
        }
        if (definition.closA(now)) {
            throw conflit("EXERCICE_CLOS", "L’exercice est clos.");
        }
        boolean correct = formule(remise.reponse()).equals(formule(definition.reponseAttendue()));
        repository.soumettre(definition, eleveId, remise.reponse(), correct, now);
        return vueEleve(definition, repository.copie(id, eleveId).orElseThrow(), now);
    }

    @Transactional(readOnly = true)
    public List<ExerciceRedigeProf> listerProf(UUID auteurId) {
        Instant now = clock.instant();
        return repository.pourAuteur(auteurId).stream()
                .filter(e -> cours.estAuteur(e.coursId(), auteurId))
                .map(e -> vueProf(e, now)).toList();
    }

    @Transactional
    public ExerciceRedigeProf creer(UUID auteurId, EcritureExerciceRedige entree) {
        verifierAuteur(entree.coursId(), auteurId);
        Instant now = clock.instant();
        var definition = brouillon(UUID.randomUUID(), 1, auteurId, entree);
        repository.creer(definition, now);
        return vueProf(definition, now);
    }

    @Transactional
    public ExerciceRedigeProf enregistrer(UUID id, UUID auteurId, EcritureExerciceRedige entree) {
        var actuelle = verrouillerPourAuteur(id, auteurId);
        if (actuelle.publie()) {
            throw conflit("EXERCICE_PUBLIE", "Cet exercice est déjà publié.");
        }
        verifierAuteur(entree.coursId(), auteurId);
        Instant now = clock.instant();
        var definition = brouillon(id, actuelle.version(), auteurId, entree);
        repository.enregistrer(definition, now);
        return vueProf(definition, now);
    }

    @Transactional
    public ExerciceRedigeProf publier(UUID id, UUID auteurId) {
        var definition = verrouillerPourAuteur(id, auteurId);
        Instant now = clock.instant();
        if (definition.publie()) {
            return vueProf(definition, now);
        }
        if (!cours.estPublie(definition.coursId())) {
            throw conflit("COURS_NON_PUBLIE", "Publiez d’abord la leçon.");
        }
        if (definition.titre().isBlank() || definition.enonce().isBlank()
                || definition.reponseAttendue().isBlank() || definition.corrige().isBlank()) {
            throw invalide("CORRIGE_INCOMPLET", "Renseignez le titre, l’énoncé, la réponse attendue et le corrigé.");
        }
        if (definition.closA(now)) {
            throw invalide("ECHEANCE_PASSEE", "Choisissez une échéance future.");
        }
        formule(definition.reponseAttendue());
        repository.publier(id, now);
        return vueProf(repository.trouver(id).orElseThrow(), now);
    }

    @Transactional
    public ExerciceRedigeProf cloturer(UUID id, UUID auteurId) {
        var definition = verrouillerPourAuteur(id, auteurId);
        Instant now = clock.instant();
        if (!definition.publie() || definition.echeance() == null) {
            throw conflit("CLOTURE_IMPOSSIBLE", "Seul un exercice publié avec une échéance peut être clos.");
        }
        if (definition.closA(now)) {
            return vueProf(definition, now);
        }
        repository.cloturer(id, now);
        return vueProf(repository.trouver(id).orElseThrow(), now);
    }

    private static boolean identifiantValide(String id) {
        return id != null && !id.isBlank() && id.length() <= 128;
    }

    private ExerciceRedige definition(UUID id, boolean lock) {
        return catalogue.trouver(id)
                .or(() -> lock ? repository.verrouiller(id) : repository.trouver(id))
                .orElseThrow(ExercicesRedigesService::introuvable);
    }

    private ExerciceRedige verifierAcces(ExerciceRedige e, UUID eleveId) {
        if (!e.publie()) {
            throw introuvable();
        }
        if (e.coursId() == null) {
            verifierChapitre(e.niveau(), e.matiere(), e.slug());
        } else {
            verifierAccesCours(eleveId, e.coursId());
        }
        return e;
    }

    private void verifierChapitre(String niveau, String matiere, String slug) {
        if (!chapitres.estPublie(niveau, matiere, slug)) {
            throw introuvable();
        }
    }

    private void verifierAccesCours(UUID eleveId, UUID coursId) {
        switch (cours.accesPourEleve(eleveId, coursId)) {
            case VISIBLE -> { }
            case INTROUVABLE -> throw introuvable();
            case HORS_PORTEE -> throw interdit();
        }
    }

    private void verifierAuteur(UUID coursId, UUID auteurId) {
        if (!cours.estAuteur(coursId, auteurId)) {
            throw interdit();
        }
    }

    private ExerciceRedige verrouillerPourAuteur(UUID id, UUID auteurId) {
        var definition = repository.verrouiller(id).orElseThrow(ExercicesRedigesService::introuvable);
        if (!auteurId.equals(definition.auteurId())) {
            throw interdit();
        }
        verifierAuteur(definition.coursId(), auteurId);
        return definition;
    }

    private static ExerciceRedige brouillon(UUID id, int version, UUID auteurId, EcritureExerciceRedige entree) {
        return new ExerciceRedige(id, version, entree.coursId(), auteurId, null, null, null,
                entree.titre().strip(), entree.enonce(), entree.reponseAttendue(), entree.corrige(),
                entree.echeance(), null, null);
    }

    private static ExerciceRedigeProf vueProf(ExerciceRedige e, Instant now) {
        return new ExerciceRedigeProf(e.id(), e.coursId(), e.version(), e.titre(), e.enonce(), e.reponseAttendue(),
                e.corrige(), e.echeanceEffective(), e.publie(), e.publie() && e.closA(now));
    }

    private static ExerciceRedigeEleve vueEleve(ExerciceRedige e, Copie copie, Instant now) {
        if (copie != null) {
            var soumission = new CopieExerciceRedige(copie.reponse(), copie.correct(), copie.remisAt());
            return new ExerciceRedigeEleve(e.id(), copie.version(), copie.titre(), copie.enonce(), e.coursId(),
                    e.niveau(), e.matiere(), e.slug(), e.echeanceEffective(), e.closA(now), copie.corrige(), soumission);
        }
        boolean cloture = e.closA(now);
        return new ExerciceRedigeEleve(e.id(), e.version(), e.titre(), e.enonce(), e.coursId(), e.niveau(),
                e.matiere(), e.slug(), e.echeanceEffective(), cloture, cloture ? e.corrige() : null, null);
    }

    private static PolynomialFormula formule(String raw) {
        try {
            return PolynomialFormula.parse(raw);
        } catch (FormulaException e) {
            throw switch (e.kind()) {
                case SYNTAX -> invalide("FORMULE_ILLISIBLE", "La formule est illisible.");
                case UNSUPPORTED -> invalide("FORMULE_HORS_DOMAINE", "La formule n’est pas prise en charge.");
            };
        }
    }

    private static ExerciceRedigeException introuvable() {
        return new ExerciceRedigeException(HttpStatus.NOT_FOUND, "EXERCICE_INTROUVABLE", "Exercice introuvable.");
    }

    private static ExerciceRedigeException interdit() {
        return new ExerciceRedigeException(HttpStatus.FORBIDDEN, "ACCES_REFUSE", "Cet exercice n’est pas accessible.");
    }

    private static ExerciceRedigeException invalide(String code, String message) {
        return new ExerciceRedigeException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }

    private static ExerciceRedigeException conflit(String code, String message) {
        return new ExerciceRedigeException(HttpStatus.CONFLICT, code, message);
    }
}
