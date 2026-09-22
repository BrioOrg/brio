package fr.brio.contenu.infrastructure;

import fr.brio.contenu.CoursLectureService;
import fr.brio.contenu.api.CoursAccesApi;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class CoursAccesApiImpl implements CoursAccesApi {

    private final CoursLectureService coursLectureService;

    CoursAccesApiImpl(CoursLectureService coursLectureService) {
        this.coursLectureService = coursLectureService;
    }

    @Override
    public boolean estVisiblePour(UUID coursId, Set<UUID> classesEleve) {
        return coursLectureService.estVisiblePour(coursId, classesEleve);
    }
}
