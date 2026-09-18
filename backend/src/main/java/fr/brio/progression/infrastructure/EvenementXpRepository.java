package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.EvenementXp;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EvenementXpRepository extends JpaRepository<EvenementXp, UUID> {

    boolean existsByEleveIdAndSourceTypeAndSourceRef(UUID eleveId, String sourceType, String sourceRef);

    @Query("select coalesce(sum(e.points), 0) from EvenementXp e where e.eleveId = :eleveId")
    int sommePointsPourEleve(@Param("eleveId") UUID eleveId);

    @Query("select coalesce(sum(e.points), 0) from EvenementXp e "
            + "where e.eleveId = :eleveId and e.createdAt >= :depuis")
    int sommePointsDepuis(@Param("eleveId") UUID eleveId, @Param("depuis") Instant depuis);
}
