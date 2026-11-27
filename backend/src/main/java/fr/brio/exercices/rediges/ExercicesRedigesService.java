package fr.brio.exercices.rediges;

import fr.brio.contenu.api.ChapitreContentApi;
import fr.brio.contenu.api.CoursAccesApi;
import fr.brio.exercices.domain.PolynomialFormula;
import fr.brio.exercices.domain.PolynomialFormula.FormulaException;
import fr.brio.exercices.rediges.ExerciceRedige.ModeCorrection;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.CopieExerciceRedige;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.CopiePourRevue;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.EcritureExerciceRedige;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.ExerciceRedigeEleve;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.ExerciceRedigeProf;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.ExerciceRedigeResume;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.RemiseExerciceRedige;
import fr.brio.exercices.rediges.ExercicesRedigesRepository.Copie;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

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
        return soumettre(id, eleveId, remise.version(), remise.reponse(), null);
    }

    @Transactional
    public ExerciceRedigeEleve soumettreAvecPhoto(
            UUID id, UUID eleveId, int version, String reponse, MultipartFile photo) {
        return soumettre(id, eleveId, version, reponse, photo);
    }

    private ExerciceRedigeEleve soumettre(
            UUID id, UUID eleveId, int version, String reponse, MultipartFile fichier) {
        // For teacher definitions both clock acceptance and the write happen under the same lock
        // as early closure, so a submission and a closure cannot be observed out of order.
        var definition = verifierAcces(definition(id, true), eleveId);
        if (fichier != null && !definition.photoAutorisee()) {
            throw invalide("PHOTO_NON_AUTORISEE", "Une photo n’est pas autorisée pour cet exercice.");
        }
        Instant now = clock.instant();
        var saved = repository.copie(id, eleveId);
        if (saved.isPresent()) {
            return vueEleve(definition, saved.get(), now);
        }
        if (version != definition.version()) {
            throw conflit("VERSION_OBSOLETE", "L’exercice a changé. Recharge la page.");
        }
        if (definition.closA(now)) {
            throw conflit("EXERCICE_CLOS", "L’exercice est clos.");
        }
        Boolean correct = null;
        PhotoCopie photo = null;
        if (definition.modeCorrection() == ModeCorrection.automatique) {
            correct = formule(reponse).equals(formule(definition.reponseAttendue()));
        } else {
            if (reponse.length() > ExercicesRedigesContrats.MAX_REPONSE_TEXTE) {
                throw invalide("REPONSE_TROP_LONGUE", "La réponse dépasse 12 000 caractères.");
            }
            if (reponse.isBlank()) {
                if (fichier == null) {
                    throw invalide("REPONSE_VIDE", "Écris une réponse ou joins une photo si elle est autorisée.");
                }
                reponse = "";
            }
            if (fichier != null) {
                photo = PhotoCopie.nettoyer(fichier);
            }
        }
        repository.soumettre(definition, eleveId, reponse, correct, now, photo);
        return vueEleve(definition, repository.copie(id, eleveId).orElseThrow(), now);
    }

    @Transactional(readOnly = true)
    public PhotoCopie photoDeLEleve(UUID id, UUID eleveId) {
        verifierAcces(definition(id, false), eleveId);
        var copie = repository.copie(id, eleveId).orElseThrow(ExercicesRedigesService::introuvable);
        return chargerPhoto(id, copie);
    }

    @Transactional(readOnly = true)
    public List<CopiePourRevue> listerCopies(UUID id, UUID auteurId) {
        var definition = verifierPourRevue(id, auteurId, false);
        var eleves = cours.elevesDuCoursPourRevue(definition.coursId(), auteurId);
        return repository.copiesPourRevue(id, definition.version(), eleves.keySet()).stream()
                .map(copie -> vueRevue(copie, eleves.get(copie.eleveId()))).toList();
    }

    @Transactional
    public CopiePourRevue publierRetour(UUID id, UUID auteurId, UUID eleveId, String commentaire) {
        var definition = verifierPourRevue(id, auteurId, true);
        String nomAffiche = nomPourRevue(definition, auteurId, eleveId);
        var copie = copiePourRevue(definition, eleveId);
        if (copie.retour() == null || !commentaire.equals(copie.retour().commentaire())) {
            repository.publierRetour(id, copie.version(), eleveId, commentaire, clock.instant());
            copie = copiePourRevue(definition, eleveId);
        }
        return vueRevue(copie, nomAffiche);
    }

    @Transactional(readOnly = true)
    public PhotoCopie photoPourRevue(UUID id, UUID auteurId, UUID eleveId) {
        var definition = verifierPourRevue(id, auteurId, false);
        nomPourRevue(definition, auteurId, eleveId);
        return chargerPhoto(id, copiePourRevue(definition, eleveId));
    }

    private static CopiePourRevue vueRevue(Copie copie, String nomAffiche) {
        return new CopiePourRevue(copie.eleveId(), nomAffiche, copie.reponse(), copie.remisAt(),
                copie.photo(), copie.retour());
    }

    private PhotoCopie chargerPhoto(UUID id, Copie copie) {
        return repository.photo(id, copie.version(), copie.eleveId()).orElseThrow(ExercicesRedigesService::introuvable);
    }

    private Copie copiePourRevue(ExerciceRedige definition, UUID eleveId) {
        return repository.copie(definition.id(), eleveId)
                .filter(copie -> copie.version() == definition.version())
                .orElseThrow(ExercicesRedigesService::introuvable);
    }

    private String nomPourRevue(ExerciceRedige definition, UUID auteurId, UUID eleveId) {
        String nom = cours.elevesDuCoursPourRevue(definition.coursId(), auteurId).get(eleveId);
        if (nom == null) {
            throw interdit();
        }
        return nom;
    }

    private ExerciceRedige verifierPourRevue(UUID id, UUID auteurId, boolean lock) {
        var definition = verifierExerciceDeLAuteur(id, auteurId, lock);
        if (!definition.publie() || definition.modeCorrection() != ModeCorrection.enseignant) {
            throw introuvable();
        }
        return definition;
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
        var actuelle = verifierExerciceDeLAuteur(id, auteurId, true);
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
        var definition = verifierExerciceDeLAuteur(id, auteurId, true);
        Instant now = clock.instant();
        if (definition.publie()) {
            return vueProf(definition, now);
        }
        if (!cours.estPublie(definition.coursId())) {
            throw conflit("COURS_NON_PUBLIE", "Publiez d’abord la leçon.");
        }
        boolean automatique = definition.modeCorrection() == ModeCorrection.automatique;
        if (definition.titre().isBlank() || definition.enonce().isBlank() || definition.corrige().isBlank()
                || (automatique && definition.reponseAttendue().isBlank())) {
            throw invalide("CORRIGE_INCOMPLET", automatique
                    ? "Renseignez le titre, l’énoncé, la réponse attendue et le corrigé."
                    : "Renseignez le titre, l’énoncé et une grille ou une solution.");
        }
        if (definition.closA(now)) {
            throw invalide("ECHEANCE_PASSEE", "Choisissez une échéance future.");
        }
        if (automatique) {
            formule(definition.reponseAttendue());
        }
        repository.publier(id, now);
        return vueProf(repository.trouver(id).orElseThrow(), now);
    }

    @Transactional
    public ExerciceRedigeProf cloturer(UUID id, UUID auteurId) {
        var definition = verifierExerciceDeLAuteur(id, auteurId, true);
        Instant now = clock.instant();
        if (!definition.publie() || definition.echeance() == null) {
            throw conflit("CLOTURE_IMPOSSIBLE", "Seul un exercice publié avec une échéance peut être clos.");
        }
        if (definition.closA(now)) {
            return vueProf(definition, now);
        }
        // PostgreSQL stores microseconds. Round down so the saved cutoff is never after now.
        repository.cloturer(id, now.truncatedTo(ChronoUnit.MICROS));
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

    private ExerciceRedige verifierExerciceDeLAuteur(UUID id, UUID auteurId, boolean lock) {
        var definition = (lock ? repository.verrouiller(id) : repository.trouver(id))
                .orElseThrow(ExercicesRedigesService::introuvable);
        if (!auteurId.equals(definition.auteurId())) {
            throw interdit();
        }
        verifierAuteur(definition.coursId(), auteurId);
        return definition;
    }

    private static ExerciceRedige brouillon(UUID id, int version, UUID auteurId, EcritureExerciceRedige entree) {
        var mode = entree.modeCorrection() == null ? ModeCorrection.automatique : entree.modeCorrection();
        boolean automatique = mode == ModeCorrection.automatique;
        String attendu = automatique && entree.reponseAttendue() != null ? entree.reponseAttendue() : "";
        String copieModele = entree.copieModele() == null || entree.copieModele().isBlank() ? null : entree.copieModele();
        if (automatique && (entree.photoAutorisee() || copieModele != null)) {
            throw invalide("OPTIONS_REVUE_RESERVEES", "La photo et la copie modèle sont réservées à la revue par l’enseignant.");
        }
        return new ExerciceRedige(id, version, entree.coursId(), auteurId, null, null, null,
                entree.titre().strip(), entree.enonce(), attendu, entree.corrige(), mode, entree.photoAutorisee(), copieModele,
                entree.echeance(), null, null);
    }

    private static ExerciceRedigeProf vueProf(ExerciceRedige e, Instant now) {
        return new ExerciceRedigeProf(e.id(), e.coursId(), e.version(), e.titre(), e.enonce(), e.reponseAttendue(),
                e.corrige(), e.modeCorrection(), e.photoAutorisee(), e.copieModele(),
                e.echeanceEffective(), e.publie(), e.publie() && e.closA(now));
    }

    private static ExerciceRedigeEleve vueEleve(ExerciceRedige e, Copie copie, Instant now) {
        if (copie != null) {
            var soumission = new CopieExerciceRedige(copie.reponse(), copie.correct(), copie.remisAt(),
                    copie.photo(), copie.retour());
            return new ExerciceRedigeEleve(e.id(), copie.version(), copie.titre(), copie.enonce(), e.coursId(),
                    e.niveau(), e.matiere(), e.slug(), e.echeanceEffective(), e.closA(now), copie.corrige(),
                    e.modeCorrection(), e.photoAutorisee(), copie.copieModele(), soumission);
        }
        boolean cloture = e.closA(now);
        return new ExerciceRedigeEleve(e.id(), e.version(), e.titre(), e.enonce(), e.coursId(), e.niveau(),
                e.matiere(), e.slug(), e.echeanceEffective(), cloture, cloture ? e.corrige() : null,
                e.modeCorrection(), e.photoAutorisee(), cloture ? e.copieModele() : null, null);
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
