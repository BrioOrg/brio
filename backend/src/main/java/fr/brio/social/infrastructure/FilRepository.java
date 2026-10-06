package fr.brio.social.infrastructure;

import fr.brio.social.domain.Fil;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FilRepository extends JpaRepository<Fil, UUID> {

    List<Fil> findByClasseIdAndPorteeAndPorteeRefOrderByCreatedAtDesc(
            UUID classeId, String portee, String porteeRef);
}
