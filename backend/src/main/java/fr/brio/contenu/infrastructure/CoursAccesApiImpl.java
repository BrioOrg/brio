package fr.brio.contenu.infrastructure;

import fr.brio.contenu.CoursLectureService;
import fr.brio.contenu.api.AccesCours;
import fr.brio.contenu.api.CoursAccesApi;
import fr.brio.identite.api.InscriptionsQuery;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class CoursAccesApiImpl implements CoursAccesApi {

    private final CoursLectureService coursLectureService;
    private final InscriptionsQuery inscriptionsQuery;

    CoursAccesApiImpl(CoursLectureService coursLectureService, InscriptionsQuery inscriptionsQuery) {
        this.coursLectureService = coursLectureService;
        this.inscriptionsQuery = inscriptionsQuery;
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
    public Map<UUID, String> titresVisiblesPourEleve(UUID eleveId, Set<UUID> coursIds) {
        if (coursIds.isEmpty()) {
            return Map.of();
        }
        return coursLectureService.titresVisibles(coursIds, inscriptionsQuery.classesDeLEleve(eleveId));
    }
}
