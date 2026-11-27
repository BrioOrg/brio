package fr.brio.contenu.infrastructure;

import fr.brio.contenu.CoursLectureService;
import fr.brio.contenu.api.AccesCours;
import fr.brio.contenu.api.CoursAccesApi;
import fr.brio.contenu.domain.Cours;
import fr.brio.contenu.domain.CoursPortee;
import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.api.InscriptionsQuery;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class CoursAccesApiImpl implements CoursAccesApi {

    private final CoursLectureService coursLectureService;
    private final InscriptionsQuery inscriptionsQuery;
    private final CoursRepository coursRepository;
    private final CoursPorteeRepository portees;
    private final EnseignantContexteQuery enseignants;

    CoursAccesApiImpl(
            CoursLectureService coursLectureService,
            InscriptionsQuery inscriptionsQuery,
            CoursRepository coursRepository,
            CoursPorteeRepository portees,
            EnseignantContexteQuery enseignants) {
        this.coursLectureService = coursLectureService;
        this.inscriptionsQuery = inscriptionsQuery;
        this.coursRepository = coursRepository;
        this.portees = portees;
        this.enseignants = enseignants;
    }

    @Override
    public boolean estVisiblePour(UUID coursId, Set<UUID> classesEleve) {
        return coursLectureService.estVisiblePour(coursId, classesEleve);
    }

    @Override
    public AccesCours accesPourEleve(UUID eleveId, UUID coursId) {
        return coursLectureService.acces(coursId, inscriptionsQuery.classesDeLEleve(eleveId));
    }

    @Override
    public boolean estAuteur(UUID coursId, UUID auteurId) {
        return coursRepository.existsByIdAndAuteurId(coursId, auteurId);
    }

    @Override
    public boolean estPublie(UUID coursId) {
        return coursRepository.existsByIdAndStatutAndVersionPublieeIsNotNull(coursId, Cours.STATUT_PUBLIE);
    }

    @Override
    public Map<UUID, String> elevesDuCoursPourRevue(UUID coursId, UUID auteurId) {
        if (!estAuteur(coursId, auteurId) || !estPublie(coursId)) {
            return Map.of();
        }
        Set<UUID> classesEnseignees = enseignants.classesEnseignees(auteurId);
        if (classesEnseignees.isEmpty()) {
            return Map.of();
        }
        var eleves = new HashMap<UUID, String>();
        portees.findByIdCoursId(coursId).stream()
                .map(CoursPortee::getClasseId)
                .filter(classesEnseignees::contains)
                .sorted()
                .forEach(classe -> inscriptionsQuery.elevesDeLaClasse(classe)
                        .forEach(eleve -> eleves.putIfAbsent(eleve.compteId(), eleve.nomAffiche())));
        return Map.copyOf(eleves);
    }

    @Override
    public Map<UUID, String> titresVisiblesPourEleve(UUID eleveId, Set<UUID> coursIds) {
        if (coursIds.isEmpty()) {
            return Map.of();
        }
        return coursLectureService.titresVisibles(coursIds, inscriptionsQuery.classesDeLEleve(eleveId));
    }
}
