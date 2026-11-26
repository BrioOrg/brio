package fr.brio.contenu.infrastructure;

import fr.brio.contenu.CoursLectureService;
import fr.brio.contenu.api.AccesCours;
import fr.brio.contenu.api.CoursAccesApi;
import fr.brio.contenu.domain.Cours;
import fr.brio.identite.api.InscriptionsQuery;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class CoursAccesApiImpl implements CoursAccesApi {

    private final CoursLectureService coursLectureService;
    private final InscriptionsQuery inscriptionsQuery;

    private final CoursRepository coursRepository;

    CoursAccesApiImpl(
            CoursLectureService coursLectureService, InscriptionsQuery inscriptionsQuery, CoursRepository coursRepository) {
        this.coursLectureService = coursLectureService;
        this.inscriptionsQuery = inscriptionsQuery;
        this.coursRepository = coursRepository;
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
    public Map<UUID, String> titresVisiblesPourEleve(UUID eleveId, Set<UUID> coursIds) {
        if (coursIds.isEmpty()) {
            return Map.of();
        }
        return coursLectureService.titresVisibles(coursIds, inscriptionsQuery.classesDeLEleve(eleveId));
    }
}
