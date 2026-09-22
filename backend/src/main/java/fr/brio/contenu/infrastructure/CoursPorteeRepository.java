package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.CoursPortee;
import fr.brio.contenu.domain.CoursPorteeId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoursPorteeRepository extends JpaRepository<CoursPortee, CoursPorteeId> {

    List<CoursPortee> findByIdCoursId(UUID coursId);

    void deleteByIdCoursId(UUID coursId);
}
